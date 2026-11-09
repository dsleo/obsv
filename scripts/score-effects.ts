// Scores a directory of method-v2 artifacts: how large and how stable are the effects?
// Run on control events (should be ~0) and on real events (should be larger). `npx tsx scripts/score-effects.ts <dir>`
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? "data/generated/analyses");
const blocs = ["radical_left", "left", "center", "right", "far_right", "abstention"];
let contrasts = 0, effects = 0, significant = 0, absSum = 0, absAbstention = 0, maxAbs = 0;
const events = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
for (const artifact of events) for (const c of Object.values(artifact.contrasts ?? {}) as { effect?: Record<string, { mean: number; lo: number; hi: number; stable: boolean }> }[]) {
  if (!c.effect) continue;
  contrasts += 1;
  for (const bloc of blocs) {
    const e = c.effect[bloc]; effects += 1; absSum += Math.abs(e.mean); maxAbs = Math.max(maxAbs, Math.abs(e.mean));
    if (bloc === "abstention") absAbstention += Math.abs(e.mean);
    if (e.stable && (e.lo > 0 || e.hi < 0) && Math.abs(e.mean) >= 0.01) significant += 1; // stable across runs, CI excludes 0, >= 1 point
  }
}
const pct = (x: number) => `${(100 * x).toFixed(2)} pt`;
console.log(JSON.stringify({ dir, events: events.length, contrasts, meanAbsEffect: pct(absSum / effects), meanAbsAbstention: pct(absAbstention / contrasts), maxAbsEffect: pct(maxAbs), shareStableSignificant: `${(100 * significant / effects).toFixed(1)} % of ${effects} bloc effects` }, null, 1));
