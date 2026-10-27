// Offline step: event -> persona segments -> directional LLM contrasts -> public artifact.
// Needs OPENAI_API_KEY and the provisioned persona index (see .env.example); never runs in the browser or the build.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeRadarEvent } from "../pipeline/radar/pipeline";
import { evaluateGlobalContrast, evaluateSegmentContrast } from "../pipeline/radar/relativeResponse";
import { ANALYSIS_SCHEMA_VERSION, analysisArtifactSchema, type AnalysisArtifact } from "../src/lib/radar/analysisArtifact";
import { radarEvents } from "../src/data/radarData";

const METHOD_VERSION = "radar-directional-v1";
const force = process.argv.includes("--force");
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex < 0 ? null : process.argv[onlyIndex + 1];
const out = path.join(process.cwd(), "data/generated/analyses");

try { process.loadEnvFile(".env.local"); } catch { /* optional */ }
const personaIndex = process.env.RADAR_PERSONA_INDEX || "data/radar/personas.jsonl";
const geographyIndex = process.env.RADAR_GEOGRAPHY_INDEX || "data/radar/geography-2026.json";
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

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

for (const { id, demo, ...event } of await loadEvents()) {
  if (only && id !== only) continue;
  const file = path.join(out, `${id}.json`);
  // ponytail: hashing the prompt-bearing sources means any prompt edit invalidates the cache.
  const inputHash = createHash("sha256").update(JSON.stringify({ event, indexManifest, METHOD_VERSION, model, sources })).digest("hex").slice(0, 16);
  if (!force) {
    const previous = await readFile(file, "utf8").then(JSON.parse, () => null);
    if (previous?.inputHash === inputHash) { console.log(`${id}: up to date (${inputHash})`); continue; }
  }
  console.log(`${id}: analyzing…`);
  const analysis = await analyzeRadarEvent(event);
  const contrasts: AnalysisArtifact["contrasts"] = {};
  const keep = (contrast: Awaited<ReturnType<typeof evaluateSegmentContrast>>) => {
    const { responses: _private, ...publicPart } = contrast; // per-persona answers stay offline
    contrasts[contrast.segmentId] = publicPart;
  };
  for (const segment of analysis.segments) {
    if (segment.status !== "filterable_discovery_sample") continue;
    try { keep(await evaluateSegmentContrast(analysis.event, segment)); }
    catch (error) { console.warn(`${id}/${segment.id}: ${error instanceof Error ? error.message : error}`); }
  }
  for (const [index, scenario] of analysis.globalScenarios.entries()) {
    try { keep(await evaluateGlobalContrast(analysis.event, scenario, index)); }
    catch (error) { console.warn(`${id}/global_${index + 1}: ${error instanceof Error ? error.message : error}`); }
  }
  const artifact = analysisArtifactSchema.parse({
    schemaVersion: ANALYSIS_SCHEMA_VERSION, eventId: id, methodVersion: METHOD_VERSION, model,
    ontologyVersion: analysis.ontologyVersion, inputHash, computedAt: new Date().toISOString(),
    evidenceGrade: analysis.evidenceGrade, ...(demo ? { demo: true } : {}),
    index: { frame: analysis.index.frame, rowCount: analysis.index.rowCount },
    segments: analysis.segments, globalScenarios: analysis.globalScenarios, contrasts, note: analysis.note,
  });
  await writeFile(file, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`${id}: wrote ${file}`);
}
