import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { enrichNemotronRow, ONTOLOGY_VERSION, type GeoRecord, type RadarPersona } from "../../src/lib/radar/ontology";
import { withParentGeography, type GeographyEntry } from "../../src/lib/radar/geography";

try { process.loadEnvFile(".env.local"); } catch { /* optional */ }

// Rebuilds tags/missingFamilies/geography of an existing index from its stored raw fields,
// leaving ids and every other field (history, propensities) untouched.
const geographyPath = process.env.RADAR_GEOGRAPHY_INDEX || "data/radar/geography-2026.json";
const jobs: Array<{ input: string; output: string }> = [
  { input: process.argv[2] || process.env.RADAR_PERSONA_INDEX || "", output: "data/radar/complete-communes-calibrated-v5.jsonl" },
  { input: process.argv[3] || process.env.RADAR_GLOBAL_PERSONA_INDEX || "", output: "data/radar/personas-v5.jsonl" },
].filter((job) => job.input);
if (!jobs.length) throw new Error("Pass input index paths or set RADAR_PERSONA_INDEX / RADAR_GLOBAL_PERSONA_INDEX");

const { records } = JSON.parse(await readFile(geographyPath, "utf8")) as { records: GeographyEntry[] };
const byCode = new Map<string, GeoRecord>(records.map((record) => [record.communeCode, record]));

async function retag(input: string, output: string) {
  await mkdir(path.dirname(output), { recursive: true });
  const temp = `${output}.${process.pid}.tmp`;
  const out = createWriteStream(temp, { encoding: "utf8" });
  const hash = createHash("sha256");
  let rows = 0;
  for await (const line of readline.createInterface({ input: createReadStream(input), crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const persona = JSON.parse(line) as RadarPersona;
    const geography = withParentGeography(persona.geography, byCode);
    const fresh = enrichNemotronRow({
      uuid: persona.sourceRowId, age: persona.age, sex: persona.sex, education_level: persona.education,
      occupation: persona.occupation, household_type: persona.household, marital_status: persona.maritalStatus,
      commune: persona.commune, departement: persona.department,
      professional_persona: persona.professionalNarrative, persona: persona.profileNarrative,
    }, geography);
    const text = `${JSON.stringify({ ...persona, tags: fresh.tags, missingFamilies: fresh.missingFamilies, geography })}\n`;
    hash.update(text);
    if (!out.write(text)) await new Promise<void>((resolve) => out.once("drain", resolve));
    rows += 1;
  }
  await new Promise<void>((resolve, reject) => out.end((error?: Error | null) => (error ? reject(error) : resolve())));
  await rename(temp, output);
  const source = JSON.parse(await readFile(`${input}.manifest.json`, "utf8")) as Record<string, unknown>;
  await writeFile(`${output}.manifest.json`, `${JSON.stringify({
    ...source, ontologyVersion: ONTOLOGY_VERSION, rowCount: rows,
    retag: { note: "Tags rebuilt from stored raw fields (ontology fixes, clusters, arrondissement geography inherited from parent commune)", at: new Date().toISOString(), sourceIndex: path.basename(input), outputSha256: hash.digest("hex") },
  }, null, 2)}\n`);
  console.log(`${output}: ${rows} rows`);
}

for (const job of jobs) await retag(job.input, job.output);
