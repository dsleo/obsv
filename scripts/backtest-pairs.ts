// Backtest of the event analysis against real poll CHANGES, built to cancel house effects and scenario composition:
// pairs of consecutive polls from the same pollster with the IDENTICAL candidate list (first round, all configurations) or the same duel
// (second round). Outcome = change in each candidate's share; predictor = sum of the predicted bloc effects of the events between the two
// polls (exposure-weighted). Tested against 2,000 event-shuffles with a max-over-exposure-weightings statistic, bootstrap over pairs,
// early/late stability, a no-LLM "candidate in the news" null model. Reads the full Sondax CSV (data/incoming/sondax.csv, saved by data:collect).
// Usage: [BIAS_DIR=<controls>] [DEMEAN_BLOC=1] npx tsx scripts/backtest-pairs.ts <artifactsDir> [csv]
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const BLOCS: Record<string, string[]> = { radical_left: ["melenchon", "arthaud"], left: ["glucksmann", "tondelier", "roussel"], center: ["attal", "philippe"], right: ["retailleau", "lisnard"], far_right: ["le-pen", "bardella", "zemmour", "dupont-aignan"] };
const blocOf = (c: string) => Object.keys(BLOCS).find((b) => BLOCS[b].includes(c));
const dir = process.argv[2]!, csvPath = process.argv[3] ?? "data/incoming/sondax.csv", DAY = 86_400_000, START = Date.parse("2026-09-01");
const snap = JSON.parse(readFileSync("data/generated/snapshot.json", "utf8"));
const events: { id: string; t: number; pub: number; cands: string[] }[] = snap.events.map((e: any) => ({ id: e.id, t: Date.parse(e.occurredAt), pub: e.publisherCount ?? 1, cands: e.candidateIds ?? [] }));

// ---- predictions (per event, per bloc, in points), optionally bias-corrected and demeaned per bloc
const BIAS: Record<string, number> = {};
if (process.env.BIAS_DIR) { const sums: Record<string, number> = {}; let n = 0; for (const f of readdirSync(process.env.BIAS_DIR).filter((x) => x.endsWith(".json"))) for (const c of Object.values<any>(JSON.parse(readFileSync(join(process.env.BIAS_DIR, f), "utf8")).contrasts)) if (c.effect) { n++; for (const [b, e] of Object.entries<any>(c.effect)) sums[b] = (sums[b] ?? 0) + e.mean; } for (const b of Object.keys(sums)) BIAS[b] = sums[b] / n; }
const pred = new Map<string, Record<string, number>>();
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const a = JSON.parse(readFileSync(join(dir, f), "utf8")); const cs = Object.values<any>(a.contrasts).filter((c) => c.effect); if (!cs.length) continue;
  const n = cs.reduce((s, c) => s + c.sampledCount, 0);
  pred.set(a.eventId, Object.fromEntries(Object.keys(BLOCS).map((b) => [b, 100 * cs.reduce((s, c) => s + (c.effect[b].mean - (BIAS[b] ?? 0)) * c.sampledCount, 0) / n])));
}
if (process.env.DEMEAN_BLOC) for (const b of Object.keys(BLOCS)) { const avg = [...pred.values()].reduce((sum, v) => sum + v[b], 0) / pred.size; for (const v of pred.values()) v[b] -= avg; }

// ---- polls -> pairs
type Obs = { c: string; opp?: string; y: number; frac: number };
type Pair = { kind: "main1" | "all1" | "duel"; t1: number; t2: number; obs: Obs[] };
type Survey = { id: string; pollster: string; t: number; tour: string; principal: boolean; shares: Record<string, number> };
function loadSurveys(): Survey[] {
  if (!existsSync(csvPath)) throw new Error(`${csvPath} missing: run npm run data:collect (it saves the full Sondax CSV)`);
  const [head, ...lines] = readFileSync(csvPath, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/); const H = head.split(",");
  const map = new Map<string, Survey>();
  for (const line of lines) {
    const c = line.split(","), r = Object.fromEntries(H.map((h, i) => [h, c[i] ?? ""]));
    const key = `${r.sondage_id}|${r.tour}|${r.configuration}`;
    if (!map.has(key)) map.set(key, { id: key, pollster: r.institut, t: Date.parse(r.terrain_fin), tour: r.tour, principal: r.configuration_principale === "1", shares: {} });
    map.get(key)!.shares[r.candidat_id] = Number(r.score);
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}
const surveys = loadSurveys();
function makePairs(kind: Pair["kind"]): Pair[] {
  const pool = surveys.filter((s) => (kind === "duel" ? s.tour === "2" : s.tour === "1" && (kind === "all1" || s.principal)));
  const groups = new Map<string, Survey[]>();
  for (const s of pool) { const k = `${s.pollster}|${Object.keys(s.shares).sort().join()}`; groups.set(k, [...(groups.get(k) ?? []), s]); }
  const out: Pair[] = [];
  for (const list of groups.values()) for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    if (b.t - a.t < 3 * DAY || b.t - a.t > 35 * DAY || b.t < START) continue;
    if (kind === "duel") {
      const [A, B] = Object.keys(a.shares).sort(); if (!blocOf(A) || !blocOf(B) || blocOf(A) === blocOf(B)) continue;
      out.push({ kind, t1: a.t, t2: b.t, obs: [{ c: A, opp: B, y: b.shares[A] - a.shares[A], frac: 1 }] });
    } else {
      const obs = Object.keys(a.shares).filter((c) => blocOf(c)).map((c) => ({ c, y: b.shares[c] - a.shares[c], frac: 0 }));
      for (const o of obs) o.frac = a.shares[o.c] / obs.filter((x) => blocOf(x.c) === blocOf(o.c)).reduce((s, x) => s + a.shares[x.c], 0);
      out.push({ kind, t1: a.t, t2: b.t, obs });
    }
  }
  return out;
}

// ---- features
const W = { one: () => 1, log: (e: any) => Math.log(1 + e.pub), linear: (e: any) => e.pub / 5 };
type Cfg = { name: string; w: (e: any) => number; mention?: boolean };
const cfgs: Cfg[] = [{ name: "LLM x equal weight", w: W.one }, { name: "LLM x log(publishers)", w: W.log }, { name: "LLM x publishers", w: W.linear }];
const mentionCfg: Cfg = { name: "NO-LLM: candidate mentioned x log(publishers)", w: W.log, mention: true };
function features(pairs: Pair[], cfg: Cfg, assign: (id: string) => Record<string, number> | undefined) {
  const x: number[] = [], y: number[] = [], grp: number[] = [];
  pairs.forEach((pr, gi) => {
    const inside = events.filter((e) => e.t > pr.t1 && e.t <= pr.t2);
    const eff = (e: any, c: string) => cfg.mention ? (e.cands.includes(c) ? 1 : 0) : (assign(e.id)?.[blocOf(c)!] ?? 0);
    const xs = pr.obs.map((o) => inside.reduce((s, e) => s + (eff(e, o.c) * o.frac - (o.opp ? eff(e, o.opp) : 0)) * cfg.w(e), 0));
    const demean = pr.kind !== "duel"; // first-round shares are zero-sum within a poll; a duel observation is already a difference
    const mx = demean ? xs.reduce((s, v) => s + v, 0) / xs.length : 0, my = demean ? pr.obs.reduce((s, o) => s + o.y, 0) / xs.length : 0;
    xs.forEach((v, i) => { x.push(v - mx); y.push(pr.obs[i].y - my); grp.push(gi); });
  });
  return { x, y, grp };
}
const corr = (x: number[], y: number[]) => { let a = 0, b = 0, c = 0; for (let i = 0; i < x.length; i++) { a += x[i] * y[i]; b += x[i] ** 2; c += y[i] ** 2; } return b && c ? a / Math.sqrt(b * c) : 0; };
const slope = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i], 0) / (x.reduce((s, v) => s + v * v, 0) || 1);
let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const ids = [...pred.keys()];

const results: Record<string, unknown>[] = [];
function evaluate(label: string, pairs: Pair[]) {
  if (pairs.length < 4) { console.log(`\n### ${label}: only ${pairs.length} pairs, skipped`); return; }
  const stats = cfgs.map((c) => { const f = features(pairs, c, (id) => pred.get(id)); return { c, r: corr(f.x, f.y), k: slope(f.x, f.y) }; });
  const best = stats.reduce((a, b) => (b.r > a.r ? b : a)), N = 2000;
  let ge = 0;
  for (let k = 0; k < N; k++) { const perm = [...ids]; for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } const m = new Map(ids.map((id, i) => [id, pred.get(perm[i])!]));
    if (Math.max(...cfgs.map((c) => { const f = features(pairs, c, (id) => m.get(id)); return corr(f.x, f.y); })) >= best.r) ge++; }
  const f = features(pairs, best.c, (id) => pred.get(id)), bs: number[] = [];
  const byGroup = pairs.map((_, g) => f.grp.map((gg, i) => (gg === g ? i : -1)).filter((i) => i >= 0));
  for (let k = 0; k < 1000; k++) { const idx = Array.from({ length: pairs.length }, () => byGroup[Math.floor(rnd() * pairs.length)]).flat(); bs.push(corr(idx.map((i) => f.x[i]), idx.map((i) => f.y[i]))); }
  bs.sort((a, b) => a - b);
  const order = pairs.map((_, i) => i).sort((a, b) => pairs[a].t2 - pairs[b].t2), early = new Set(order.slice(0, Math.floor(order.length / 2)));
  const part = (keep: (g: number) => boolean) => { const idx = f.grp.map((g, i) => (keep(g) ? i : -1)).filter((i) => i >= 0); return corr(idx.map((i) => f.x[i]), idx.map((i) => f.y[i])); };
  const fm = features(pairs, mentionCfg, (id) => pred.get(id)), resid = (a: number[], b: number[]) => { const k = slope(b, a.length ? b : b); void k; const kk = slope(b, a); return a.map((v, i) => v - kk * b[i]); };
  const partial = corr(resid(f.x, fm.x), resid(f.y, fm.x));
  console.log(`\n### ${label}: ${pairs.length} pairs, ${f.x.length} observations`);
  console.log("| predictor | r | slope |\n|---|---|---|");
  for (const s of stats) console.log(`| ${s.c.name} | ${s.r.toFixed(3)} | ${s.k.toFixed(3)} |`);
  console.log(`| ${mentionCfg.name} | ${corr(fm.x, fm.y).toFixed(3)} | ${slope(fm.x, fm.y).toFixed(3)} |`);
  results.push({ label, pairs: pairs.length, observations: f.x.length, config: best.c.name, r: +best.r.toFixed(3), ciLow: +bs[25].toFixed(3), ciHigh: +bs[974].toFixed(3), permutationP: +((ge + 1) / (N + 1)).toFixed(3), earlyR: +part((g) => early.has(g)).toFixed(3), lateR: +part((g) => !early.has(g)).toFixed(3), partialR: +partial.toFixed(3) });
  console.log(`best: ${best.c.name} r=${best.r.toFixed(3)} CI95 over pairs [${bs[25].toFixed(2)}, ${bs[974].toFixed(2)}], permutation p (max over 3 weightings) = ${((ge + 1) / (N + 1)).toFixed(3)}; early/late half r = ${part((g) => early.has(g)).toFixed(3)} / ${part((g) => !early.has(g)).toFixed(3)}; partial r beyond news volume = ${partial.toFixed(3)}`);
}
console.log(`artifacts ${dir}${process.env.BIAS_DIR ? ` | bias-corrected with ${process.env.BIAS_DIR}` : ""}${process.env.DEMEAN_BLOC ? " | per-bloc mean removed (event-specific part only)" : ""}; events with predictions: ${ids.length}`);
const main1 = makePairs("main1"), all1 = makePairs("all1"), duel = makePairs("duel");
evaluate("first round, main configuration only (the earlier 13-pair test)", main1);
evaluate("first round, ALL configurations", all1);
evaluate("second-round duels", duel);
evaluate("ALL (all first-round configurations + duels)", [...all1, ...duel]);

if (process.env.JSON_OUT) for (const r of results) console.log(`RESULT ${JSON.stringify({ eventSpecific: !!process.env.DEMEAN_BLOC, ...r })}`);
