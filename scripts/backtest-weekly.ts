// Aggregate backtest: per ISO-ish week and bloc, sum of predicted event effects vs the week-over-week change in the bloc's poll average.
// Also compares the CUMULATIVE predicted drift per bloc with the real poll drift (scale sanity check). Usage: npx tsx scripts/backtest-weekly.ts <artifactsDir>
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BLOCS: Record<string, string[]> = { radical_left: ["melenchon", "arthaud"], left: ["glucksmann", "tondelier", "roussel"], center: ["attal", "philippe"], right: ["retailleau", "lisnard"], far_right: ["le-pen", "bardella", "zemmour", "dupont-aignan"] };

// Placebo correction: BIAS_DIR=<artifacts of control events> subtracts the mean effect the model produces on neutral events, per bloc.
const BIAS: Record<string, number> = {};
if (process.env.BIAS_DIR) {
  const sums: Record<string, number> = {}; let count = 0;
  for (const f of readdirSync(process.env.BIAS_DIR).filter((n) => n.endsWith(".json"))) for (const c of Object.values<any>(JSON.parse(readFileSync(join(process.env.BIAS_DIR, f), "utf8")).contrasts)) if (c.effect) { count++; for (const [b, e] of Object.entries<any>(c.effect)) sums[b] = (sums[b] ?? 0) + e.mean; }
  for (const b of Object.keys(sums)) BIAS[b] = sums[b] / count;
}
const debiased = (b: string, mean: number) => mean - (BIAS[b] ?? 0);

const WEEK = 7 * 86400000, START = Date.parse("2026-09-01T00:00:00Z");
const dir = process.argv[2] ?? "data/generated/analyses";
const snap = JSON.parse(readFileSync("data/generated/snapshot.json", "utf8"));
const polls = snap.polls.map((p: any) => ({ w: Math.floor((Date.parse(p.fieldworkEnd) - START) / WEEK), shares: p.candidateShares as Record<string, number> })).filter((p: any) => p.w >= 0);
const weeks = Math.max(...polls.map((p: any) => p.w)) + 1;
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const pearson = (x: number[], y: number[]) => { const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0; x.forEach((v, i) => { a += (v - mx) * (y[i] - my); b += (v - mx) ** 2; c += (y[i] - my) ** 2; }); return a / Math.sqrt(b * c); };

const eventDate = new Map<string, number>(snap.events.map((e: any) => [e.id, Date.parse(e.occurredAt)]));
const predicted: Record<string, number[]> = Object.fromEntries(Object.keys(BLOCS).map((b) => [b, new Array(weeks).fill(0)]));
for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
  const a = JSON.parse(readFileSync(join(dir, f), "utf8")); const t = eventDate.get(a.eventId); if (t == null) continue;
  const w = Math.floor((t - START) / WEEK); if (w < 0 || w >= weeks) continue;
  const cs = Object.values<any>(a.contrasts).filter((c) => c.effect); if (!cs.length) continue;
  const n = cs.reduce((s, c) => s + c.sampledCount, 0);
  for (const b of Object.keys(BLOCS)) predicted[b][w] += cs.reduce((s, c) => s + debiased(b, c.effect[b].mean) * c.sampledCount, 0) / n * 100; // points, one event's average effect
}
const level = (b: string, w: number) => { const v = polls.filter((p: any) => p.w === w).flatMap((p: any) => BLOCS[b].filter((c) => p.shares[c] != null).map((c) => p.shares[c])); return v.length ? mean(v) : null; };
const xs: number[] = [], ys: number[] = [];
console.log("| bloc | cumulative predicted drift (pts) | real poll drift first→last week (pts) |\n|---|---|---|");
for (const b of Object.keys(BLOCS)) {
  const lv = Array.from({ length: weeks }, (_, w) => level(b, w));
  for (let w = 1; w < weeks; w++) if (lv[w] != null && lv[w - 1] != null) { xs.push(predicted[b][w]); ys.push(lv[w]! - lv[w - 1]!); }
  const first = lv.find((v) => v != null)!, last = [...lv].reverse().find((v) => v != null)!;
  console.log(`| ${b} | ${predicted[b].reduce((s, x) => s + x, 0).toFixed(1)} | ${(last - first).toFixed(1)} |`);
}
console.log(`\nweekly: n=${xs.length} (bloc, week) pairs, Pearson(predicted week effect, poll change) = ${pearson(xs, ys).toFixed(3)}`);
