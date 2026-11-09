// Method v2: per-persona vote distributions with and without the event (not just a direction), so the effect
// is a quantity with an interval, on bigger samples, repeated to measure stability. Hypothesis only (see docs/radar-trust.md).
import { createHash } from "node:crypto";
import { z } from "zod";
import { callStructuredModel } from "./openaiStructured";
import { hydrate, loadPersonas } from "./personaIndex";
import { sampleSegmentPersonas } from "./relativeResponse";
import type { RadarEvent, SegmentPreview } from "./pipeline";
import type { RadarPersona } from "../../src/lib/radar/ontology";

export const OPTIONS = ["radical_left", "left", "center", "right", "far_right", "abstention"] as const;
type Option = (typeof OPTIONS)[number];
type Dist = Record<Option, number>;

const dist = z.object({ radical_left: z.number(), left: z.number(), center: z.number(), right: z.number(), far_right: z.number(), abstention: z.number() });
const responseSchema = z.object({ responses: z.array(z.object({ personaId: z.string(), ifEvent: dist, ifNoEvent: dist, mechanism: z.string() })) });

// 2022 first-round candidates -> bloc (deterministic; blank votes and Lassalle are left out of the baseline).
const BLOC_OF: [RegExp, Option][] = [[/ARTHAUD|POUTOU|MÉLENCHON/, "radical_left"], [/ROUSSEL|HIDALGO|JADOT/, "left"], [/MACRON/, "center"], [/PÉCRESSE/, "right"], [/LE PEN|ZEMMOUR|DUPONT/, "far_right"]];

/** The persona's survey-model baseline over the six options, normalised. Null when the row has no calibrated prior. */
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

const normalise = (d: Dist): Dist => {
  const total = OPTIONS.reduce((sum, key) => sum + Math.max(0, d[key]), 0) || 1;
  return Object.fromEntries(OPTIONS.map((key) => [key, Math.max(0, d[key]) / total])) as Dist;
};

function rng(seed: string) { // small seeded PRNG so bootstrap intervals are reproducible
  let a = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const SYSTEM = `Vous estimez, pour des profils synthétiques français, leur intention de vote à la présidentielle selon deux mondes : (A) « ifEvent » : l’événement a lieu et le profil en a connaissance ; (B) « ifNoEvent » : le scénario contrefactuel, l’événement n’a pas lieu. Pour chaque monde, donnez une distribution sur cinq blocs et l’abstention (six nombres entre 0 et 1, somme égale à 1). Partez de la distribution de base fournie (modèle d’enquête 2022, contexte faible) et écartez-vous-en seulement pour une raison concrète liée à l’événement ; sans raison concrète, ifEvent et ifNoEvent restent égaux à la base, y compris pour l’abstention. Un déplacement raisonnable est de quelques points, rarement plus de 10 points, et seulement pour les profils réellement concernés. Ne devinez ni parti préféré ni idéologie à partir de la profession, de l’âge ou du lieu. Un même événement peut mobiliser ou démobiliser : estimez aussi l’abstention. Fournissez exactement une réponse par profil, avec les six clés. Expliquez en français, en une phrase, le mécanisme concret ou son absence.`;

const BLOCS_DEF = { radical_left: "LFI et partis à sa gauche", left: "gauche sociale-démocrate et écologiste", center: "centre macroniste ou libéral", right: "droite conservatrice classique", far_right: "RN et extrême droite alliée", abstention: "ne vote pas" };

async function askBatch(event: RadarEvent, segment: SegmentPreview, personas: RadarPersona[], seed: string) {
  const order = [...OPTIONS].sort((a, b) => createHash("sha256").update(`${seed}${a}`).digest("hex").localeCompare(createHash("sha256").update(`${seed}${b}`).digest("hex"))); // blocs shown in a seeded random order: no positional bias
  const view = personas.map((p) => ({
    id: p.id, age: p.age, sex: p.sex, education: p.education, occupation: p.occupation, household: p.household, commune: p.commune, department: p.department,
    baseline: Object.fromEntries(order.map((key) => [key, Number(((baseline(p) ?? { radical_left: .2, left: .2, center: .2, right: .1, far_right: .2, abstention: .1 })[key]).toFixed(3))])),
  }));
  const out = await callStructuredModel({
    schema: responseSchema, schemaName: "radar_probabilistic_response_v2", stageName: "radar_probabilistic_response", system: SYSTEM,
    user: JSON.stringify({ event, intervention: segment.counterfactual.intervention, comparator: segment.counterfactual.comparator, segment: segment.name, blocDefinitions: BLOCS_DEF, personas: view }),
  });
  const wanted = new Set(personas.map((p) => p.id));
  const seen = new Set<string>();
  for (const r of out.data.responses) { if (!wanted.has(r.personaId) || seen.has(r.personaId)) throw new Error("Unexpected or duplicate persona response"); seen.add(r.personaId); }
  if (seen.size !== wanted.size) throw new Error("The model omitted a sampled persona");
  return out.data.responses.map((r) => ({ personaId: r.personaId, ifEvent: normalise(r.ifEvent), ifNoEvent: normalise(r.ifNoEvent), mechanism: r.mechanism }));
}

const retry = async <T>(run: () => Promise<T>) => { try { return await run(); } catch { return run(); } };

/** n personas per run (batches of `batch`, in parallel), `runs` independent samples. Effect = mean(ifEvent - ifNoEvent), bootstrap 95% interval. */
export async function evaluateSegmentEffect(event: RadarEvent, segment: SegmentPreview, { n = 24, batch = 8, runs = 2 } = {}) {
  const perRun: { personaId: string; delta: Dist }[][] = [];
  const mechanisms: string[] = [];
  let matched = 0;
  const runResults = await Promise.all(Array.from({ length: runs }, async (_, run) => {
    const { matches, selected } = await sampleSegmentPersonas(event, segment, n, `run${run}`);
    matched = matches;
    const chunks = Array.from({ length: Math.ceil(selected.length / batch) }, (_, i) => selected.slice(i * batch, (i + 1) * batch));
    const answers = (await Promise.all(chunks.map((chunk, i) => retry(() => askBatch(event, segment, chunk, `${segment.id}|${run}|${i}`))))).flat();
    return answers.map((a) => ({ personaId: a.personaId, delta: Object.fromEntries(OPTIONS.map((key) => [key, a.ifEvent[key] - a.ifNoEvent[key]])) as Dist, mechanism: a.mechanism }));
  }));
  for (const r of runResults) { perRun.push(r); mechanisms.push(...r.slice(0, 2).map((x) => (x as { mechanism?: string }).mechanism ?? "")); }
  const all = perRun.flat();
  const random = rng(`${event.title}|${segment.id}`);
  const mean = (rows: { delta: Dist }[], key: Option) => rows.reduce((sum, r) => sum + r.delta[key], 0) / (rows.length || 1);
  const effect = Object.fromEntries(OPTIONS.map((key) => {
    const boots = Array.from({ length: 400 }, () => mean(Array.from({ length: all.length }, () => all[Math.floor(random() * all.length)]), key)).sort((a, b) => a - b);
    const runMeans = perRun.map((rows) => mean(rows, key));
    const agree = runMeans.every((m) => Math.sign(m) === Math.sign(runMeans[0]) && Math.abs(m) >= 0.005);
    return [key, { mean: mean(all, key), lo: boots[10], hi: boots[389], stable: agree }];
  }));
  // Direction counts kept for the existing UI: |per-persona delta| >= 2 points.
  const summary = Object.fromEntries(OPTIONS.map((key) => [key, {
    toward: all.filter((r) => r.delta[key] >= 0.02).length, away: all.filter((r) => r.delta[key] <= -0.02).length,
    noClearChange: all.filter((r) => Math.abs(r.delta[key]) < 0.02).length,
  }]));
  return { segmentId: segment.id, segmentName: segment.name, matchedCount: matched, sampledCount: all.length, runs, comparator: segment.counterfactual.comparator,
    selection: "deterministic_diversity_sample_by_2022_prior", evidenceGrade: "unvalidated_llm_directional_hypothesis" as const,
    effect, summary, mechanisms: mechanisms.filter(Boolean).slice(0, 3),
    note: "Effet estimé = différence entre deux distributions de vote simulées (avec / sans l’événement) sur des profils synthétiques, avec intervalle de bootstrap. Hypothèse non validée par des réponses humaines ; ce n’est pas une prévision de vote.",
  };
}

export async function evaluateGlobalEffect(event: RadarEvent, scenario: { intervention: string; comparator: string; outcomeToMeasure: string; reason: string }, index: number, opts?: Parameters<typeof evaluateSegmentEffect>[2]) {
  const segment = {
    id: `global_${index + 1}`, name: "Whole-index scenario", mechanism: scenario.reason, reason: scenario.reason, all: [], any: [], none: [], place: { commune: "", department: "" },
    resolvedPlace: null, membershipGaps: [], measurementNeeds: [scenario.outcomeToMeasure],
    counterfactual: { intervention: scenario.intervention, comparator: scenario.comparator, outcomeToMeasure: scenario.outcomeToMeasure },
    count: 0, countIncludingNarrativeRules: 0, distinctCommunes: 0, samplePersonaIds: [], status: "filterable_discovery_sample",
  } as SegmentPreview;
  return { ...(await evaluateSegmentEffect(event, segment, { n: 48, ...opts })), scope: "global_distributed_discovery_sample" as const };
}
