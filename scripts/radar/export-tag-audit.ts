import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import readline from "node:readline";
import type { RadarPersona } from "../../src/lib/radar/ontology";
import { ONTOLOGY_VERSION } from "../../src/lib/radar/ontology";

function arg(name: string, fallback = "") { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1] ?? fallback; }
const indexPath = arg("--index", "data/radar/personas.jsonl");
const outputPath = arg("--out", "data/radar/narrative-tag-audit.jsonl");
const perTag = Number(arg("--per-tag", "50"));
if (!Number.isInteger(perTag) || perTag < 1 || perTag > 500) throw new Error("--per-tag must be 1 to 500");
type Candidate = { personaId: string; tagId: string; evidence: string; professionalNarrative: string; approved: null; reviewer: string; reviewedAt: string; ontologyVersion: string; rank: string };
const selected = new Map<string, Candidate[]>();
const stream = readline.createInterface({ input: createReadStream(indexPath), crlfDelay: Infinity });
for await (const line of stream) {
  if (!line.trim()) continue;
  const persona = JSON.parse(line) as RadarPersona;
  for (const tag of persona.tags) {
    if (tag.source !== "narrative_rule") continue;
    const rank = createHash("sha256").update(`${tag.id}:${persona.id}`).digest("hex");
    const row: Candidate = { personaId: persona.id, tagId: tag.id, evidence: tag.evidence ?? "", professionalNarrative: persona.professionalNarrative,
      approved: null, reviewer: "", reviewedAt: "", ontologyVersion: ONTOLOGY_VERSION, rank };
    const list = selected.get(tag.id) ?? [];
    list.push(row);
    list.sort((a, b) => a.rank.localeCompare(b.rank));
    if (list.length > perTag) list.pop();
    selected.set(tag.id, list);
  }
}
const rows = [...selected.values()].flat().sort((a, b) => a.tagId.localeCompare(b.tagId) || a.rank.localeCompare(b.rank));
await writeFile(outputPath, rows.map(({ rank: _rank, ...row }) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""));
process.stdout.write(`${JSON.stringify({ candidateTags: rows.length, tagFamilies: selected.size, outputPath })}\n`);
