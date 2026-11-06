import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { enrichNemotronRow, ONTOLOGY_VERSION, type RadarPersona } from "../../src/lib/radar/ontology";
import { buildGeographyResolver, type GeographyEntry } from "../../src/lib/radar/geography";

function arg(name: string, fallback = "") {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1] ?? fallback;
}

const outputPath = arg("--out", "data/radar/personas.jsonl");
const geographyPath = arg("--geography", "data/radar/geography-2026.json");
const rawInput = arg("--raw-input");
const requestedFrame = arg("--frame", rawInput ? "full_export" : "distributed_pages");
if (!["full_export", "distributed_pages", "complete_communes"].includes(requestedFrame)) throw new Error("Invalid frame");
if (requestedFrame === "complete_communes" && !rawInput) throw new Error("Complete-commune frame requires --raw-input");
const pages = Number(arg("--pages", "20"));
if (!Number.isInteger(pages) || pages < 1 || pages > 100) throw new Error("--pages must be 1 to 100");
const geographyData = JSON.parse(await readFile(geographyPath, "utf8")) as { records: GeographyEntry[] };
const resolveGeography = buildGeographyResolver(geographyData.records);
await mkdir(path.dirname(outputPath), { recursive: true });
const tempPath = `${outputPath}.${process.pid}.tmp`;
const output = createWriteStream(tempPath, { encoding: "utf8" });
let count = 0;
let unresolvedGeography = 0;
let narrativeRuleTags = 0;
let invalidRows = 0;
async function fetchJsonWithRetry<T>(url: string): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json() as T;
      if (response.status < 500 && response.status !== 429) throw new Error(`Hugging Face HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 4) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new Error(`Hugging Face request failed after retries: ${url}`);
}
const addRow = async (row: Record<string, unknown>) => {
  try {
    const geo = resolveGeography(String(row.commune ?? ""), String(row.departement ?? ""));
    const persona: RadarPersona = enrichNemotronRow(row, geo);
    if (!geo) unresolvedGeography += 1;
    narrativeRuleTags += persona.tags.filter((tag) => tag.source === "narrative_rule").length;
    if (!output.write(`${JSON.stringify(persona)}\n`)) await new Promise<void>((resolve) => output.once("drain", resolve));
    count += 1;
  } catch {
    invalidRows += 1;
  }
};

let datasetRevision: string | null = null;
let frame: "full_export" | "distributed_pages" | "complete_communes";
if (rawInput) {
  frame = requestedFrame as "full_export" | "complete_communes";
  if (frame === "complete_communes") {
    const sourceManifest = JSON.parse(await readFile(`${rawInput}.manifest.json`, "utf8")) as { datasetRevision?: string; personaRows?: number };
    datasetRevision = sourceManifest.datasetRevision ?? null;
  }
  const stream = readline.createInterface({ input: createReadStream(rawInput), crlfDelay: Infinity });
  for await (const line of stream) if (line.trim()) await addRow(JSON.parse(line) as Record<string, unknown>);
} else {
  frame = "distributed_pages";
  const info = await fetchJsonWithRetry<{ sha?: string }>("https://huggingface.co/api/datasets/nvidia/Nemotron-Personas-France");
  datasetRevision = String(info.sha ?? "unknown");
  const endpoint = "https://datasets-server.huggingface.co/rows?dataset=nvidia%2FNemotron-Personas-France&config=default&split=train";
  type Page = { num_rows_total: number; rows: Array<{ row: Record<string, unknown> }> };
  const initial = await fetchJsonWithRetry<Page>(`${endpoint}&offset=0&length=100`);
  const total = initial.num_rows_total;
  // Systematic pages spread across the entire source; this is only a discovery
  // sample, never a substitute for a calibrated population frame.
  for (let index = 0; index < pages; index += 1) {
    const offset = index === 0 ? 0 : Math.floor(index * (total - 100) / pages);
    const body = index === 0 ? initial : await fetchJsonWithRetry<Page>(`${endpoint}&offset=${offset}&length=100`);
    for (const item of body.rows) await addRow(item.row);
  }
}
await new Promise<void>((resolve, reject) => output.end((error?: Error | null) => error ? reject(error) : resolve()));
await rename(tempPath, outputPath);
const manifest = {
  source: "nvidia/Nemotron-Personas-France", datasetRevision,
  ontologyVersion: ONTOLOGY_VERSION, geographyYear: 2026, frame, fetchedAt: new Date().toISOString(),
  rowCount: count, unresolvedGeography, narrativeRuleTags, invalidRows,
  rawInputManifest: frame === "complete_communes" ? `${rawInput}.manifest.json` : null,
  warning: frame === "distributed_pages" ? "Distributed discovery sample only; local cells are mostly sparse."
    : frame === "complete_communes" ? "Clustered selected-commune sample; no national representativeness implied." : null,
};
await writeFile(`${outputPath}.manifest.json`, JSON.stringify(manifest, null, 2));
process.stdout.write(`${JSON.stringify(manifest)}\n`);
