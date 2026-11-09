// Offline backtest: does the subpopulation-impact analysis predict real poll movement?
// Usage: npx tsx scripts/backtest-analyses.ts [artifactsDir]   (default data/generated/analyses)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Single source of truth for bloc -> poll candidate ids (bardella is polled in place of le-pen in some polls).
const BLOCS: Record<string, string[]> = {
  radical_left: ["melenchon", "arthaud"],
  left: ["glucksmann", "tondelier", "roussel"],
  center: ["attal", "philippe"],
  right: ["retailleau", "lisnard"],
  far_right: ["le-pen", "bardella", "zemmour", "dupont-aignan"],
};
const BLOC_NAMES = Object.keys(BLOCS);
const WINDOWS = [7, 14];
const SIGN_MIN_PRED = 0.15, SIGN_MIN_OBS = 0.2, PERMS = 2000;
const DAY = 86400000;

const dir = process.argv[2] ?? "data/generated/analyses";
const snap = JSON.parse(readFileSync("data/generated/snapshot.json", "utf8"));
const polls = snap.polls.map((p: any) => ({ t: Date.parse(p.fieldworkEnd + "T00:00:00Z"), shares: p.candidateShares as Record<string, number> }));

// seeded PRNG (mulberry32)
let seed = 12345;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };
const pearson = (x: number[], y: number[]) => {
  if (x.length < 3) return NaN;
  const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  x.forEach((v, i) => { sxy += (v - mx) * (y[i] - my); sxx += (v - mx) ** 2; syy += (y[i] - my) ** 2; });
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
};
const ranks = (a: number[]) => {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; }
  return r;
};
const spearman = (x: number[], y: number[]) => pearson(ranks(x), ranks(y));
const f = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");

// artifacts
const artifacts = new Map<string, any>();
for (const file of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
  try { const a = JSON.parse(readFileSync(join(dir, file), "utf8")); if (a.eventId) artifacts.set(a.eventId, a); } catch { /* skip */ }
}
const predicted = (a: any): Record<string, number> | null => {
  const out: Record<string, number> = {}; let n = 0;
  for (const c of Object.values<any>(a.contrasts ?? {})) n += c.sampledCount ?? 0;
  if (!n) return null;
  for (const b of [...BLOC_NAMES, "abstention"]) {
    let net = 0;
    for (const c of Object.values<any>(a.contrasts)) { const s = c.summary?.[b]; if (s) net += s.toward - s.away; }
    out[b] = net / n;
  }
  return out;
};

const observed = (t: number, bloc: string, w: number): number | null => {
  const diffs: number[] = [];
  for (const cand of BLOCS[bloc]) {
    const before = polls.filter((p: any) => p.t <= t && p.t > t - w * DAY && p.shares[cand] != null).map((p: any) => p.shares[cand]);
    const after = polls.filter((p: any) => p.t > t && p.t <= t + w * DAY && p.shares[cand] != null).map((p: any) => p.shares[cand]);
    if (before.length && after.length) diffs.push(mean(after) - mean(before));
  }
  return diffs.length ? mean(diffs) : null;
};
const blocOf = (cid: string) => BLOC_NAMES.find((b) => BLOCS[b].includes(cid));

type Ev = { id: string; pred: Record<string, number>; obs: Record<string, number | null>; concerned: Set<string> };
const skips: Record<string, number> = { "no artifact": 0, "artifact without sampled personas": 0 };
const evals = new Map<number, Ev[]>(WINDOWS.map((w) => [w, []]));
const noPolls = new Map<number, number>(WINDOWS.map((w) => [w, 0]));
const pollsAround = new Map<number, number[]>(WINDOWS.map((w) => [w, []]));
for (const e of snap.events) {
  const a = artifacts.get(e.id);
  if (!a) { skips["no artifact"]++; continue; }
  const pred = predicted(a);
  if (!pred) { skips["artifact without sampled personas"]++; continue; }
  const t = Date.parse(e.occurredAt.slice(0, 10) + "T00:00:00Z");
  const concerned = new Set<string>((e.candidateIds as string[]).map(blocOf).filter(Boolean) as string[]);
  for (const w of WINDOWS) {
    pollsAround.get(w)!.push(polls.filter((p: any) => Math.abs(p.t - t) <= w * DAY).length);
    const obs: Record<string, number | null> = {}; let any = false;
    for (const b of BLOC_NAMES) { obs[b] = observed(t, b, w); any ||= obs[b] != null; }
    if (any) evals.get(w)!.push({ id: e.id, pred, obs, concerned }); else noPolls.set(w, noPolls.get(w)! + 1);
  }
}

// pairs given a (possibly shuffled) pred assignment
const pairs = (evs: Ev[], perm: number[], onlyConcerned: boolean) => {
  const P: number[] = [], O: number[] = [];
  evs.forEach((ev, i) => { for (const b of BLOC_NAMES) { if (ev.obs[b] == null || (onlyConcerned && !ev.concerned.has(b))) continue; P.push(evs[perm[i]].pred[b]); O.push(ev.obs[b]!); } });
  return { P, O };
};
const signAgree = (P: number[], O: number[]) => {
  let n = 0, ok = 0;
  P.forEach((p, i) => { if (Math.abs(p) < SIGN_MIN_PRED || Math.abs(O[i]) < SIGN_MIN_OBS) return; n++; if (Math.sign(p) === Math.sign(O[i])) ok++; });
  return { n, rate: n ? ok / n : NaN };
};

const rows: string[] = [];
for (const w of WINDOWS) for (const onlyConcerned of [false, true]) {
  const evs = evals.get(w)!; const id = evs.map((_, i) => i);
  const { P, O } = pairs(evs, id, onlyConcerned);
  const real = signAgree(P, O);
  let sum = 0, ge = 0, valid = 0;
  const perm = [...id];
  for (let k = 0; k < PERMS; k++) {
    for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const pp = pairs(evs, perm, onlyConcerned); const s = signAgree(pp.P, pp.O);
    if (!Number.isFinite(s.rate)) continue; valid++; sum += s.rate; if (s.rate >= real.rate) ge++;
  }
  const tag = real.n < 30 ? " (SMALL n)" : "";
  rows.push(`| ${w}d | ${onlyConcerned ? "concerned blocs" : "all blocs"} | ${evs.length} | ${P.length} | ${real.n}${tag} | ${f(real.rate)} | ${f(valid ? sum / valid : NaN)} | ${f((ge + 1) / (valid + 1))} | ${f(pearson(P, O))} | ${f(spearman(P, O))} |`);
}

console.log(`# Backtest of analyses (${dir})\n`);
console.log(`Artifacts: ${artifacts.size}; events in snapshot: ${snap.events.length}; polls: ${polls.length}. Sign agreement ignores |pred|<${SIGN_MIN_PRED} and |obs|<${SIGN_MIN_OBS}pt; ${PERMS} permutations (seed 12345); p = P(chance >= real).\n`);
console.log("| window | scope | events | pairs | pairs for sign | sign agreement | chance | p-value | Pearson | Spearman |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
rows.forEach((r) => console.log(r));
console.log("\nEvents evaluated / skipped:");
console.log(`- skipped, ${Object.entries(skips).map(([k, v]) => `${k}: ${v}`).join("; ")}`);
for (const w of WINDOWS) console.log(`- ${w}d window: ${evals.get(w)!.length} events evaluated; skipped (no bloc with polls on both sides): ${noPolls.get(w)}; median polls within +/-${w}d of an event: ${f(median(pollsAround.get(w)!), 1)}`);

// structure metrics
const segs = [...artifacts.values()].flatMap((a) => a.segments ?? []);
const withSample = [...artifacts.values()].filter((a) => (a.segments ?? []).some((s: any) => s.status === "filterable_discovery_sample")).length;
const byStatus: Record<string, number> = {}; segs.forEach((s) => (byStatus[s.status] = (byStatus[s.status] ?? 0) + 1));
console.log(`\n## Structure\n- events with >=1 filterable_discovery_sample segment: ${withSample}/${artifacts.size} (${f((100 * withSample) / Math.max(1, artifacts.size), 1)}%)`);
console.log(`- segments: ${segs.length}; by status: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(", ")}`);
console.log(`- median segment size (count): ${f(median(segs.map((s) => s.count)), 0)}`);
const names = new Map<string, number[]>(); segs.forEach((s) => names.set(s.name, [...(names.get(s.name) ?? []), s.count]));
console.log("\n| segment name | occurrences | median size |\n|---|---|---|");
[...names.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10).forEach(([n, c]) => console.log(`| ${n} | ${c.length} | ${f(median(c), 0)} |`));
console.log(`\nDistinct segment names: ${names.size} over ${segs.length} segments.`);
