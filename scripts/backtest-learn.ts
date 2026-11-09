// What does the backtest teach us? Slices (event,bloc) pairs by event type, importance, bloc, prediction size, scope, poll density,
// and fits observed ~ slope * predicted. Usage: npx tsx scripts/backtest-learn.ts <v2 artifactsDir> [windowDays=14]
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BLOCS: Record<string, string[]> = { radical_left: ["melenchon", "arthaud"], left: ["glucksmann", "tondelier", "roussel"], center: ["attal", "philippe"], right: ["retailleau", "lisnard"], far_right: ["le-pen", "bardella", "zemmour", "dupont-aignan"] };
const DAY = 86400000, W = Number(process.argv[3] ?? 14), dir = process.argv[2]!;
const snap = JSON.parse(readFileSync("data/generated/snapshot.json", "utf8"));
const polls = snap.polls.map((p: any) => ({ t: Date.parse(p.fieldworkEnd), s: p.candidateShares as Record<string, number> }));
const ev = new Map<string, any>(snap.events.map((e: any) => [e.id, e]));
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const observed = (t: number, bloc: string) => {
  const d: number[] = [], n: number[] = [];
  for (const c of BLOCS[bloc]) {
    const b = polls.filter((p: any) => p.t <= t && p.t > t - W * DAY && p.s[c] != null).map((p: any) => p.s[c]);
    const a = polls.filter((p: any) => p.t > t && p.t <= t + W * DAY && p.s[c] != null).map((p: any) => p.s[c]);
    if (b.length && a.length) { d.push(mean(a) - mean(b)); n.push(b.length + a.length); }
  }
  return d.length ? { obs: mean(d), polls: mean(n) } : null;
};
type Row = { id: string; bloc: string; pred: number; predGlobal: number | null; predSeg: number | null; obs: number; polls: number; cat: string; imp: string; concerned: boolean };
const rows: Row[] = [];
for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
  const a = JSON.parse(readFileSync(join(dir, f), "utf8")), e = ev.get(a.eventId); if (!e) continue;
  const cs = Object.entries<any>(a.contrasts).filter(([, c]) => c.effect); if (!cs.length) continue;
  const wmean = (list: [string, any][], b: string) => list.length ? list.reduce((s, [, c]) => s + c.effect[b].mean * c.sampledCount, 0) / list.reduce((s, [, c]) => s + c.sampledCount, 0) * 100 : null;
  for (const bloc of Object.keys(BLOCS)) {
    const o = observed(Date.parse(e.occurredAt), bloc); if (!o) continue;
    rows.push({ id: a.eventId, bloc, pred: wmean(cs, bloc)!, predGlobal: wmean(cs.filter(([k]) => k.startsWith("global")), bloc), predSeg: wmean(cs.filter(([k]) => !k.startsWith("global")), bloc), obs: o.obs, polls: o.polls, cat: e.category ?? "?", imp: e.importance, concerned: (e.candidateIds ?? []).some((c: string) => BLOCS[bloc].includes(c)) });
  }
}
const sign = (x: number) => Math.sign(x);
function agree(rs: Row[], get: (r: Row) => number | null = (r) => r.pred, minPred = 0.5, minObs = 0.2) {
  const used = rs.filter((r) => { const p = get(r); return p != null && Math.abs(p) >= minPred && Math.abs(r.obs) >= minObs; });
  const base = rs.filter((r) => Math.abs(r.obs) >= minObs); // base rate: how often "obs is negative" (a constant guess)
  const neg = base.length ? base.filter((r) => r.obs < 0).length / base.length : NaN;
  return { n: used.length, agree: used.length ? used.filter((r) => sign(get(r)!) === sign(r.obs)).length / used.length : NaN, constantGuess: Math.max(neg, 1 - neg) };
}
const fmt = (x: { n: number; agree: number; constantGuess: number }) => `${(100 * x.agree).toFixed(0)} % of ${x.n}`;
const by = (key: (r: Row) => string) => { const m = new Map<string, Row[]>(); for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]); return [...m.entries()].sort((a, b) => b[1].length - a[1].length); };
const ols = (rs: Row[]) => { const x = rs.map((r) => r.pred), y = rs.map((r) => r.obs), mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; }); return { slope: sxy / sxx, r2: sxy ** 2 / (sxx * syy) }; };

console.log(`window ±${W} d, ${rows.length} (event,bloc) pairs, ${new Set(rows.map((r) => r.id)).size} events\n`);
const all = agree(rows); console.log(`overall sign agreement ${fmt(all)}; always-guess-the-majority-sign baseline ${(100 * all.constantGuess).toFixed(0)} %`);
console.log("\nby bloc:"); for (const [k, r] of by((r) => r.bloc)) console.log(`  ${k.padEnd(13)} ${fmt(agree(r))}  (mean predicted ${mean(r.map((x) => x.pred)).toFixed(2)} pt, mean observed ${mean(r.map((x) => x.obs)).toFixed(2)} pt)`);
console.log("\nby importance:"); for (const [k, r] of by((r) => r.imp)) console.log(`  ${k.padEnd(9)} ${fmt(agree(r))}`);
console.log("\nby event category:"); for (const [k, r] of by((r) => r.cat)) console.log(`  ${k.padEnd(14)} ${fmt(agree(r))}`);
console.log("\nby |predicted| size (does a bigger prediction mean a better one?):");
for (const [lo, hi] of [[0.5, 1], [1, 2], [2, 100]] as const) console.log(`  ${lo}-${hi} pt   ${fmt(agree(rows.filter((r) => Math.abs(r.pred) >= lo && Math.abs(r.pred) < hi), (r) => r.pred, lo))}`);
console.log("\nconcerned blocs only:", fmt(agree(rows.filter((r) => r.concerned))), "| other blocs:", fmt(agree(rows.filter((r) => !r.concerned))));
console.log("\nglobal scenario only:", fmt(agree(rows, (r) => r.predGlobal)), "| segments only:", fmt(agree(rows, (r) => r.predSeg)));
const dense = rows.filter((r) => r.polls >= 8); console.log(`\nonly pairs with >= 8 polls around the event: ${fmt(agree(dense))} (n pairs ${dense.length})`);
const fit = ols(rows); console.log(`\nregression observed = slope x predicted: slope ${fit.slope.toFixed(3)}, R² ${fit.r2.toFixed(4)}  (slope 1 = calibrated; slope ~0.02 would mean the predicted effects are ~50x too big)`);
const fitDense = ols(dense); console.log(`  on dense-poll pairs: slope ${fitDense.slope.toFixed(3)}, R² ${fitDense.r2.toFixed(4)}`);

// Detrended: subtract each bloc's own mean predicted and mean observed shift, so a model that merely has the right average drift
// per bloc (e.g. "centre falls over the period") gets no credit.
const blocMeans = Object.fromEntries(Object.keys(BLOCS).map((b) => { const r = rows.filter((x) => x.bloc === b); return [b, { p: mean(r.map((x) => x.pred)), o: mean(r.map((x) => x.obs)) }]; }));
const detr = rows.map((r) => ({ ...r, pred: r.pred - blocMeans[r.bloc].p, obs: r.obs - blocMeans[r.bloc].o }));
console.log("\nDETRENDED (per-bloc mean removed from both sides):");
console.log("  overall", fmt(agree(detr, (r) => r.pred, 0.3, 0.1)));
for (const b of Object.keys(BLOCS)) console.log(`  ${b.padEnd(13)} ${fmt(agree(detr.filter((r) => r.bloc === b), (r) => r.pred, 0.3, 0.1))}`);
const fitD = ols(detr); console.log(`  slope ${fitD.slope.toFixed(3)}, R² ${fitD.r2.toFixed(4)}`);
console.log("  by |pred| size:"); for (const [lo, hi] of [[0.3, 0.6], [0.6, 1.2], [1.2, 100]] as const) console.log(`   ${lo}-${hi} pt  ${fmt(agree(detr.filter((r) => Math.abs(r.pred) >= lo && Math.abs(r.pred) < hi), (r) => r.pred, lo, 0.1))}`);
