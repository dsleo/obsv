import { createReadStream, createWriteStream } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import readline from "node:readline";
import { ONTOLOGY_VERSION, tagIdSchema, type RadarPersona } from "../../src/lib/radar/ontology";

function arg(name: string, fallback = "") { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1] ?? fallback; }
const indexPath = arg("--index", "data/radar/personas.jsonl");
const decisionsPath = arg("--decisions");
if (!decisionsPath) throw new Error("Usage: tsx scripts/radar/apply-tag-audit.ts --index data/radar/personas.jsonl --decisions reviewed.jsonl");
type Decision = { personaId: string; tagId: string; approved: boolean; reviewer: string; reviewedAt: string; ontologyVersion: string };
const contents = await readFile(decisionsPath, "utf8");
const auditHash = createHash("sha256").update(contents).digest("hex");
const decisions = new Map<string, Decision>();
for (const line of contents.split(/\r?\n/).filter(Boolean)) {
  const decision = JSON.parse(line) as Decision;
  tagIdSchema.parse(decision.tagId);
  if (typeof decision.approved !== "boolean" || !decision.reviewer?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(decision.reviewedAt) || decision.ontologyVersion !== ONTOLOGY_VERSION) {
    throw new Error("Audit decision requires approved boolean, reviewer, YYYY-MM-DD date, and current ontology version");
  }
  const key = `${decision.personaId}|${decision.tagId}`;
  if (decisions.has(key)) throw new Error(`Duplicate audit decision: ${key}`);
  decisions.set(key, decision);
}
const tempPath = `${indexPath}.${process.pid}.audit.tmp`;
const output = createWriteStream(tempPath, { encoding: "utf8" });
const stream = readline.createInterface({ input: createReadStream(indexPath), crlfDelay: Infinity });
let approved = 0;
let rejected = 0;
for await (const line of stream) {
  if (!line.trim()) continue;
  const persona = JSON.parse(line) as RadarPersona;
  persona.tags = persona.tags.flatMap((tag) => {
    const key = `${persona.id}|${tag.id}`;
    const decision = decisions.get(key);
    if (!decision) return [tag];
    decisions.delete(key);
    if (tag.source !== "narrative_rule") throw new Error(`Audit decision targets a non-candidate tag: ${key}`);
    if (!decision.approved) { rejected += 1; return []; }
    approved += 1;
    return [{ ...tag, source: "audited_narrative" as const, reviewer: decision.reviewer, reviewedAt: decision.reviewedAt }];
  });
  if (!output.write(`${JSON.stringify(persona)}\n`)) await new Promise<void>((resolve) => output.once("drain", resolve));
}
await new Promise<void>((resolve) => output.end(resolve));
if (decisions.size > 0) throw new Error(`${decisions.size} audit decisions did not match candidate tags`);
await rename(tempPath, indexPath);
const manifestPath = `${indexPath}.manifest.json`;
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
await writeFile(manifestPath, JSON.stringify({ ...manifest, auditHash, auditedNarrativeTags: approved, rejectedNarrativeTags: rejected }, null, 2));
process.stdout.write(`${JSON.stringify({ approved, rejected, auditHash })}\n`);
