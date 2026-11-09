// A persona's starting vote distribution over 5 blocs + abstention, and its re-anchoring on current polls.
import { readFileSync } from "node:fs";
import type { RadarPersona } from "../../src/lib/radar/ontology";

export const OPTIONS = ["radical_left", "left", "center", "right", "far_right", "abstention"] as const;
export type Option = (typeof OPTIONS)[number];
export type Dist = Record<Option, number>;
export const BLOC_KEYS = OPTIONS.slice(0, 5);

// 2022 first-round candidates -> bloc (deterministic; blank votes and Lassalle are left out and the rest renormalised).
const BLOC_OF: [RegExp, Option][] = [[/ARTHAUD|POUTOU|MÉLENCHON/, "radical_left"], [/ROUSSEL|HIDALGO|JADOT/, "left"], [/MACRON/, "center"], [/PÉCRESSE/, "right"], [/LE PEN|ZEMMOUR|DUPONT/, "far_right"]];
// Poll candidates -> bloc (2026 scenario). Same grouping as scripts/backtest-analyses.ts.
const POLL_BLOC: Record<string, Option> = { melenchon: "radical_left", arthaud: "radical_left", glucksmann: "left", tondelier: "left", roussel: "left", attal: "center", philippe: "center", retailleau: "right", lisnard: "right", "le-pen": "far_right", bardella: "far_right", zemmour: "far_right", "dupont-aignan": "far_right" };

/** 2022 survey-model baseline of one persona. Null when the row has no calibrated prior. */
export function baseline(persona: RadarPersona): Dist | null {
  const prior = persona.historicalPropensity;
  if (!prior) return null;
  const out: Dist = { radical_left: 0, left: 0, center: 0, right: 0, far_right: 0, abstention: prior.probabilities.abstention ?? 0 };
  for (const [id, p] of Object.entries(prior.probabilities)) {
    const bloc = BLOC_OF.find(([re]) => re.test(prior.choiceLabels[id] ?? ""))?.[1];
    if (bloc) out[bloc] += p;
  }
  const total = OPTIONS.reduce((sum, key) => sum + out[key], 0);
  return total > 0 ? Object.fromEntries(OPTIONS.map((key) => [key, out[key] / total])) as Dist : null;
}

/** Share of each bloc among expressed votes in the polls of the `days` before `isoDate` (no look-ahead). Null if there is none. */
export function pollTarget(isoDate: string, days = 45, snapshotPath = "data/generated/snapshot.json"): Record<string, number> | null {
  const polls = (JSON.parse(readFileSync(snapshotPath, "utf8")).polls as { fieldworkEnd: string; round: string; candidateShares: Record<string, number> }[]).filter((p) => p.round === "first");
  const t = Date.parse(isoDate), before = polls.filter((p) => Date.parse(p.fieldworkEnd) <= t);
  const recent = before.filter((p) => Date.parse(p.fieldworkEnd) > t - days * 86_400_000);
  const use = recent.length ? recent : before.slice(-5);
  if (!use.length) return null;
  const sums: Record<string, number> = Object.fromEntries(BLOC_KEYS.map((b) => [b, 0]));
  for (const p of use) { for (const [id, share] of Object.entries(p.candidateShares)) if (POLL_BLOC[id]) sums[POLL_BLOC[id]] += share / use.length; }
  const total = BLOC_KEYS.reduce((s, b) => s + sums[b], 0);
  return Object.fromEntries(BLOC_KEYS.map((b) => [b, sums[b] / total]));
}

/**
 * Re-anchor a persona's baseline so that the index-wide bloc mix equals the polls' (survey prior x target / index mean), keeping its own
 * abstention. `priorMass` = index-wide sum of the 5 bloc probabilities (computed once when the slim index is built).
 */
export function anchored(persona: RadarPersona, target: Record<string, number>, priorMass: number[]): Dist | null {
  const base = baseline(persona);
  if (!base) return null;
  const mass = priorMass.reduce((s, x) => s + x, 0);
  const weights = BLOC_KEYS.map((b, i) => base[b] * (target[b] / (priorMass[i] / mass)));
  const total = weights.reduce((s, x) => s + x, 0) || 1, voters = 1 - base.abstention;
  const out = { abstention: base.abstention } as Dist;
  BLOC_KEYS.forEach((b, i) => { out[b] = (weights[i] / total) * voters; });
  return out;
}
