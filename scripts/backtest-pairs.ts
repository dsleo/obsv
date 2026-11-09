// Cleanest backtest we can build from 47 polls: for each pollster, consecutive polls with the IDENTICAL candidate list (so house effect and scenario
// composition cancel); outcome = change in each candidate's share between the two polls; predictor = sum of the predicted effects of the events that
// happened between them, spread over the bloc's candidates. Tested against 2,000 event-shuffles with a max-over-configurations statistic
// (so trying several exposure weightings is paid for). Usage: [BIAS_DIR=<controls>] npx tsx scripts/backtest-pairs.ts <artifactsDir>
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BLOCS: Record<string, string[]> = { radical_left: ["melenchon", "arthaud"], left: ["glucksmann", "tondelier", "roussel"], center: ["attal", "philippe"], right: ["retailleau", "lisnard"], far_right: ["le-pen", "bardella", "zemmour", "dupont-aignan"] };
const blocOf = (c: string) => Object.keys(BLOCS).find((b) => BLOCS[b].includes(c));
const dir = process.argv[2]!, DAY = 86_400_000;
const snap = JSON.parse(readFileSync("data/generated/snapshot.json", "utf8"));
const events: { id: string; t: number; pub: number; cands: string[] }[] = snap.events.map((e: any) => ({ id: e.id, t: Date.parse(e.occurredAt), pub: e.publisherCount ?? 1, cands: e.candidateIds ?? [] }));

const BIAS: Record<string, number> = {};
if (process.env.BIAS_DIR) { const sums: Record<string, number> = {}; let n = 0; for (const f of readdirSync(process.env.BIAS_DIR).filter((x) => x.endsWith(".json"))) for (const c of Object.values<any>(JSON.parse(readFileSync(join(process.env.BIAS_DIR, f), "utf8")).contrasts)) if (c.effect) { n++; for (const [b, e] of Object.entries<any>(c.effect)) sums[b] = (sums[b] ?? 0) + e.mean; } for (const b of Object.keys(sums)) BIAS[b] = sums[b] / n; }
const pred = new Map<string, Record<string, number>>(); // eventId -> bloc -> points (weighted mean over contrasts, bias-corrected)
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const a = JSON.parse(readFileSync(join(dir, f), "utf8")); const cs = Object.values<any>(a.contrasts).filter((c) => c.effect); if (!cs.length) continue;
  const n = cs.reduce((s, c) => s + c.sampledCount, 0);
  pred.set(a.eventId, Object.fromEntries(Object.keys(BLOCS).map((b) => [b, 100 * cs.reduce((s, c) => s + (c.effect[b].mean - (BIAS[b] ?? 0)) * c.sampledCount, 0) / n])));
}

// DEMEAN_BLOC=1: subtract each bloc's average prediction across all events, so only event-to-event differences are tested (a tilt shared by every event cannot score).
if (process.env.DEMEAN_BLOC) for (const b of Object.keys(BLOCS)) { const avg = [...pred.values()].reduce((sum, v) => sum + v[b], 0) / pred.size; for (const v of pred.values()) v[b] -= avg; }
type Pair = { t1: number; t2: number; obs: { c: string; y: number; frac: number }[] };
const polls = snap.polls.filter((p: any) => p.round === "first").map((p: any) => ({ pollster: p.pollster, t: Date.parse(p.fieldworkEnd), s: p.candidateShares as Record<string, number> })).sort((a: any, b: any) => a.t - b.t);
const pairs: Pair[] = [];
for (const name of new Set(polls.map((p: any) => p.pollster))) {
  const list = polls.filter((p: any) => p.pollster === name);
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i], ka = Object.keys(a.s).sort().join(), kb = Object.keys(b.s).sort().join();
    if (ka !== kb || b.t - a.t < 3 * DAY || b.t - a.t > 35 * DAY || b.t < Date.parse("2026-09-01")) continue;
    const obs = Object.keys(a.s).filter((c) => blocOf(c)).map((c) => ({ c, y: b.s[c] - a.s[c], frac: 0 }));
    for (const o of obs) { const tot = obs.filter((x) => blocOf(x.c) === blocOf(o.c)).reduce((s, x) => s + a.s[x.c], 0); o.frac = a.s[o.c] / tot; }
    pairs.push({ t1: a.t, t2: b.t, obs });
  }
}
const W = { one: () => 1, log: (e: any) => Math.log(1 + e.pub), linear: (e: any) => e.pub / 5 };
type Cfg = { name: string; w: (e: any) => number; mention?: boolean };
const cfgs: Cfg[] = [{ name: "LLM x equal weight", w: W.one }, { name: "LLM x log(publishers)", w: W.log }, { name: "LLM x publishers", w: W.linear }];
const mentionCfg: Cfg = { name: "NO-LLM: candidate mentioned (+1) x log(publishers)", w: W.log, mention: true };

function features(cfg: Cfg, assign: (id: string) => Record<string, number> | undefined) {
  const x: number[] = [], y: number[] = [], grp: number[] = [];
  pairs.forEach((pr, gi) => {
    const inside = events.filter((e) => e.t > pr.t1 && e.t <= pr.t2);
    const xs = pr.obs.map((o) => inside.reduce((s, e) => s + (cfg.mention ? (e.cands.includes(o.c) ? 1 : 0) : (assign(e.id)?.[blocOf(o.c)!] ?? 0) * o.frac) * cfg.w(e), 0));
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = pr.obs.reduce((s, o) => s + o.y, 0) / xs.length; // demean within pair (shares are zero-sum)
    xs.forEach((v, i) => { x.push(v - mx); y.push(pr.obs[i].y - my); grp.push(gi); });
  });
  return { x, y, grp };
}
const corr = (x: number[], y: number[]) => { let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { a += x[i] * y[i]; b += x[i] ** 2; c += y[i] ** 2; } return b && c ? a / Math.sqrt(b * c) : 0; };
const slope = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i], 0) / x.reduce((s, v) => s + v * v, 0);

let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const ids = [...pred.keys()];
const real = (id: string) => pred.get(id);
const stats = cfgs.map((c) => { const f = features(c, real); return { c, r: corr(f.x, f.y), k: slope(f.x, f.y), n: f.x.length }; });
const maxReal = Math.max(...stats.map((s) => s.r));
let ge = 0; const N = 2000;
for (let k = 0; k < N; k++) { const perm = [...ids]; for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } const m = new Map(ids.map((id, i) => [id, pred.get(perm[i])!]));
  if (Math.max(...cfgs.map((c) => { const f = features(c, (id) => m.get(id)); return corr(f.x, f.y); })) >= maxReal) ge++; }
// bootstrap over pairs (resample whole polls pairs) for the best config
const best = stats.reduce((a, b) => (b.r > a.r ? b : a));
const f = features(best.c, real); const bs: number[] = [];
for (let k = 0; k < 1000; k++) { const pick = Array.from({ length: pairs.length }, () => Math.floor(rnd() * pairs.length)); const xs: number[] = [], ys: number[] = []; for (const g of pick) f.grp.forEach((gg, i) => { if (gg === g) { xs.push(f.x[i]); ys.push(f.y[i]); } }); bs.push(corr(xs, ys)); }
bs.sort((a, b) => a - b);
const fm = features(mentionCfg, real), rm = corr(fm.x, fm.y);
console.log(`pairs ${pairs.length} (same pollster, identical candidate list, from 2026-09-01), observations ${f.x.length}, events with predictions ${ids.length}`);
console.log("| predictor | correlation with poll change | slope (pt per predicted pt) |\n|---|---|---|");
for (const s of stats) console.log(`| ${s.c.name} | ${s.r.toFixed(3)} | ${s.k.toFixed(3)} |`);
console.log(`| ${mentionCfg.name} | ${rm.toFixed(3)} | ${slope(fm.x, fm.y).toFixed(3)} |`);
console.log(`\nbest LLM config: ${best.c.name}; r=${best.r.toFixed(3)}, 95% bootstrap over pairs [${bs[25].toFixed(2)}, ${bs[974].toFixed(2)}]; permutation p (max over ${cfgs.length} configs, ${N} shuffles) = ${((ge + 1) / (N + 1)).toFixed(3)}`);
// Stability: same frozen predictor on the earlier and the later half of the intervals (by date).
const order = pairs.map((_, i) => i).sort((a, b) => pairs[a].t2 - pairs[b].t2), cut = new Set(order.slice(0, Math.floor(order.length / 2)));
const part = (keep: (g: number) => boolean) => { const xs: number[] = [], ys: number[] = []; f.grp.forEach((g, i) => { if (keep(g)) { xs.push(f.x[i]); ys.push(f.y[i]); } }); return corr(xs, ys); };
console.log(`stability (best config): earlier half of intervals r=${part((g) => cut.has(g)).toFixed(3)}, later half r=${part((g) => !cut.has(g)).toFixed(3)}`);
// Does the LLM add anything beyond 'the candidate was in the news'? Partial correlation of the best LLM predictor with poll change, mention model partialled out.
const resid = (a: number[], b: number[]) => { const k = slope(b, a); return a.map((v, i) => v - k * b[i]); };
console.log(`partial correlation, LLM predictor | mention predictor partialled out: ${corr(resid(f.x, fm.x), resid(f.y, fm.x)).toFixed(3)}`);
// ranking: does the size of predicted impact order the pairs by size of observed movement?
const sz = pairs.map((pr) => { const ins = events.filter((e) => e.t > pr.t1 && e.t <= pr.t2); return { pred: ins.reduce((s, e) => s + Object.values(real(e.id) ?? {}).reduce((a, b) => a + Math.abs(b), 0), 0), pubs: ins.reduce((s, e) => s + e.pub, 0), n: ins.length, move: pr.obs.reduce((s, o) => s + Math.abs(o.y), 0) }; });
const ranks = (a: number[]) => { const o = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length); o.forEach(([, i], k) => { r[i] = k; }); return r; };
const sp = (a: number[], b: number[]) => corr(ranks(a).map((v) => v - (a.length - 1) / 2), ranks(b).map((v) => v - (b.length - 1) / 2));
console.log(`\nranking over ${pairs.length} intervals: Spearman(total |predicted effect|, total |observed move|) = ${sp(sz.map((s) => s.pred), sz.map((s) => s.move)).toFixed(2)}; with number of events = ${sp(sz.map((s) => s.n), sz.map((s) => s.move)).toFixed(2)}; with media volume = ${sp(sz.map((s) => s.pubs), sz.map((s) => s.move)).toFixed(2)}`);
