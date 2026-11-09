// Offline step: event -> persona segments -> directional LLM contrasts -> public artifact.
// Needs OPENAI_API_KEY and the provisioned persona index (see .env.example); never runs in the browser or the build.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeRadarEvent } from "../pipeline/radar/pipeline";
import { PINNED_MODEL } from "../pipeline/radar/openaiStructured";
import { evaluateGlobalContrast, evaluateSegmentContrast } from "../pipeline/radar/relativeResponse";
import { ANALYSIS_SCHEMA_VERSION, analysisArtifactSchema, type AnalysisArtifact } from "../src/lib/radar/analysisArtifact";
import { radarEvents } from "../src/data/radarData";

const METHOD_VERSION = "radar-directional-v1";
const force = process.argv.includes("--force");
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex < 0 ? null : process.argv[onlyIndex + 1];
const out = path.join(process.cwd(), "data/generated/analyses");

for (const file of [".env", ".env.local"]) { try { process.loadEnvFile(file); } catch { /* optional: CI passes real env vars */ } }
const concurrencyIndex = process.argv.indexOf("--concurrency");
const concurrency = Math.max(1, Number(concurrencyIndex < 0 ? process.env.ANALYZE_CONCURRENCY ?? 3 : process.argv[concurrencyIndex + 1]) || 3); // events analysed at once
const personaIndex = process.env.RADAR_PERSONA_INDEX || "data/radar/personas.jsonl";
const geographyIndex = process.env.RADAR_GEOGRAPHY_INDEX || "data/radar/geography-2026.json";
const model = process.env.OPENAI_MODEL || PINNED_MODEL;

const missing = [
  !process.env.OPENAI_API_KEY && "OPENAI_API_KEY is not set",
  !existsSync(personaIndex) && `persona index not found: ${personaIndex} (RADAR_PERSONA_INDEX)`,
  !existsSync(`${personaIndex}.manifest.json`) && `persona index manifest not found: ${personaIndex}.manifest.json`,
  !existsSync(geographyIndex) && `geography index not found: ${geographyIndex} (RADAR_GEOGRAPHY_INDEX)`,
].filter(Boolean);
if (missing.length) {
  console.error(`Cannot analyze events:\n${missing.map((item) => `- ${item}`).join("\n")}\nThe persona/geography datasets are not versioned; provision them first (see tweenverse scripts).`);
  process.exit(1);
}

type Input = { id: string; title: string; description: string; occurredAt: string; sourceUrl: string; demo: boolean };

async function loadEvents(): Promise<Input[]> {
  try {
    const payload = JSON.parse(await readFile("data/incoming/events.json", "utf8"));
    return payload.events.map((e: { id: string; title: string; summary: string; occurredAt: string; sources: { url: string }[] }) => ({
      id: e.id, title: e.title, description: e.summary, occurredAt: e.occurredAt.slice(0, 10), sourceUrl: e.sources[0].url, demo: false,
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
    console.warn("data/incoming/events.json missing: analyzing the demonstration events (artifacts flagged demo).");
    return radarEvents.map((e) => ({
      id: e.id, title: e.title, description: e.summary, demo: true,
      occurredAt: new Date(Date.UTC(2026, 5, 30 + e.pollDay)).toISOString().slice(0, 10),
      sourceUrl: "https://example.org/donnees-de-demonstration",
    }));
  }
}

const sources = await Promise.all(["pipeline", "relativeResponse"].map((name) => readFile(`pipeline/radar/${name}.ts`, "utf8")));
const indexManifest = await readFile(`${personaIndex}.manifest.json`, "utf8");
await mkdir(out, { recursive: true });

async function analyzeOne({ id, demo, ...event }: Input) {
  const file = path.join(out, `${id}.json`);
  // ponytail: hashing the prompt-bearing sources means any prompt edit invalidates the cache.
  const inputHash = createHash("sha256").update(JSON.stringify({ event, indexManifest, METHOD_VERSION, model, sources })).digest("hex").slice(0, 16);
  if (!force) {
    const previous = await readFile(file, "utf8").then(JSON.parse, () => null);
    if (previous?.inputHash === inputHash) { console.log(`${id}: up to date (${inputHash})`); return; }
  }
  console.log(`${id}: analyzing…`);
  const analysis = await analyzeRadarEvent(event);
  const contrasts: AnalysisArtifact["contrasts"] = {};
  const retry = async <T>(run: () => Promise<T>) => { try { return await run(); } catch { return run(); } }; // one retry: the model occasionally omits a persona
  const keep = (contrast: Awaited<ReturnType<typeof evaluateSegmentContrast>>) => {
    const { responses: _private, ...publicPart } = contrast; // per-persona answers stay offline
    contrasts[contrast.segmentId] = publicPart;
  };
  const warn = (label: string) => (error: unknown) => console.warn(`${id}/${label}: ${error instanceof Error ? error.message : error}`);
  await Promise.all([ // segments and global scenarios of one event are independent LLM calls
    ...analysis.segments.filter((segment) => segment.status === "filterable_discovery_sample")
      .map((segment) => retry(() => evaluateSegmentContrast(analysis.event, segment)).then(keep, warn(segment.id))),
    ...analysis.globalScenarios.map((scenario, index) => retry(() => evaluateGlobalContrast(analysis.event, scenario, index)).then(keep, warn(`global_${index + 1}`))),
  ]);
  const artifact = analysisArtifactSchema.parse({
    schemaVersion: ANALYSIS_SCHEMA_VERSION, review: { status: "pending" }, eventId: id, methodVersion: METHOD_VERSION, model,
    ontologyVersion: analysis.ontologyVersion, inputHash, computedAt: new Date().toISOString(),
    evidenceGrade: analysis.evidenceGrade, ...(demo ? { demo: true } : {}),
    index: { frame: analysis.index.frame, rowCount: analysis.index.rowCount },
    segments: analysis.segments, globalScenarios: analysis.globalScenarios, contrasts, note: analysis.note,
  });
  await writeFile(file, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`${id}: wrote ${file}`);
}

// Worker pool: `concurrency` events at a time. A failed event never stops the others; the exit code reports it (for CI).
const queue = (await loadEvents()).filter((event) => !only || event.id === only);
const failed: string[] = [];
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
  for (let event = queue.shift(); event; event = queue.shift()) {
    try { await analyzeOne(event); } catch (error) { failed.push(event.id); console.error(`${event.id}: FAILED ${error instanceof Error ? error.message : error}`); }
  }
}));
if (failed.length) { console.error(`${failed.length} event(s) failed: ${failed.join(", ")}`); process.exit(1); }
