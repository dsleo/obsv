// Quality check of the alternative scenarios (one per event) before anything built on them (altEffect) is shown.
// Flags: nom_nouveau (a proper noun absent from the event), ton_seul (only the tone changes), vague, meta_media, quasi_copie, hors_sujet, doublon.
// Usage: npx tsx scripts/review-alternatives.ts <artifactsDir> [--regenerate] [--write-doc]   (--regenerate redoes flagged ones, in place)
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { alternativeFlags, proposeAlternative } from "../pipeline/radar/alternative";

for (const file of [".env", ".env.local"]) { try { process.loadEnvFile(file); } catch { /* optional */ } }
const dir = path.resolve(process.argv[2] ?? "data/generated/analyses");
const events = new Map<string, { title: string; summary: string }>(JSON.parse(await readFile("data/incoming/events.json", "utf8")).events.map((e: { id: string; title: string; summary: string }) => [e.id, e]));
const files = (await readdir(dir)).filter((f) => f.startsWith("google-") && f.endsWith(".json")).sort();
const load = async () => Promise.all(files.map(async (f) => ({ f, a: JSON.parse(await readFile(path.join(dir, f), "utf8")) })));
const flagAll = (rows: { f: string; a: any }[]) => {
  const seen = new Map<string, string>();
  return rows.map(({ f, a }) => {
    const e = events.get(a.eventId)!, flags = a.alternative ? alternativeFlags({ title: e.title, description: e.summary }, a.alternative) : ["absente"];
    const key = a.alternative?.description.slice(0, 80) ?? "";
    if (key && seen.has(key)) flags.push(`doublon_de_${seen.get(key)}`); else if (key) seen.set(key, a.eventId);
    return { f, a, e, flags };
  });
};
let rows = flagAll(await load());
const summary = (rs: typeof rows, label: string) => {
  const counts: Record<string, number> = {};
  for (const r of rs) for (const fl of r.flags) { const k = fl.split(":")[0].replace(/_de_.*/, "_de"); counts[k] = (counts[k] ?? 0) + 1; }
  console.log(`${label}: ${rs.length} alternatives, ${rs.filter((r) => r.flags.length).length} flagged (${Math.round(100 * rs.filter((r) => r.flags.length).length / rs.length)} %)`, counts);
};
summary(rows, "before");
if (process.argv.includes("--regenerate")) {
  const todo = rows.filter((r) => r.flags.length);
  for (let i = 0; i < todo.length; i += 6) await Promise.all(todo.slice(i, i + 6).map(async (r) => {
    r.a.alternative = await proposeAlternative({ title: r.e.title, description: r.e.summary });
    await writeFile(path.join(dir, r.f), `${JSON.stringify(r.a, null, 2)}\n`);
  }));
  rows = flagAll(await load());
  summary(rows, "after ");
}
if (process.argv.includes("--write-doc")) {
  const lines = ["# Alternative scenarios: review sheet", "", "One close alternative per event (see `pipeline/radar/alternative.ts`). Automatic flags: `nom_nouveau` (proper noun absent from the event), `ton_seul`, `vague`, `meta_media`, `quasi_copie`, `hors_sujet`, `doublon`. Status column is for the human reviewer (ok / fix / drop).", "", "The alternative is generated from the event title AND description (the description can cover a different angle than the title: judge against both).", "", "| event | title | description | alternative | what changes | flags | status |", "|---|---|---|---|---|---|---|"];
  for (const r of rows) lines.push(`| ${r.a.eventId} | ${r.e.title.replace(/\|/g, "/")} | ${r.e.summary.slice(0, 240).replace(/\|/g, "/")} | ${r.a.alternative?.description.replace(/\|/g, "/")} | ${r.a.alternative?.whatChanges.replace(/\|/g, "/")} | ${r.flags.join(", ")} | |`);
  await writeFile("docs/alternative-review.md", `${lines.join("\n")}\n`);
  console.log("wrote docs/alternative-review.md");
}
