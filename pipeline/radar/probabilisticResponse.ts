// Method v2: per-persona vote distributions in several worlds, so the effect is a quantity with an interval, on bigger samples,
// repeated to measure stability. Worlds: ifNoEvent (nothing happened), ifEvent (the real event), optionally ifAlternative (a close
// alternative version of the event, one per event). effect = ifEvent - ifNoEvent (backtestable); altEffect = ifEvent - ifAlternative
// (what in the event matters; interpretive). Hypothesis only (see docs/radar-trust.md).
import { createHash } from "node:crypto";
import { z } from "zod";
import { callStructuredModel } from "./openaiStructured";
import { loadPersonas } from "./personaIndex";
import { sampleSegmentPersonas } from "./relativeResponse";
import { OPTIONS, anchored, baseline, pollTarget, type Dist, type Option } from "./baseline";
import type { RadarEvent, SegmentPreview } from "./pipeline";
import type { RadarPersona } from "../../src/lib/radar/ontology";
import { pollCandidates, pollObservations } from "../../src/data/chartData";
import { candidateBloc } from "../../src/lib/radar/highlights";
export { OPTIONS, baseline };

const CANDIDATE_IDS = pollCandidates.map((candidate) => candidate.id) as string[];
const candidateShape = Object.fromEntries([
  ...CANDIDATE_IDS.map((id) => [id, z.number()]),
  ["abstention", z.number()],
]);
const dist = z.object(candidateShape as Record<string, z.ZodNumber>);
const base = { personaId: z.string(), ifNoEvent: dist, ifEvent: dist };
const plain = z.object({ responses: z.array(z.object({ ...base, mechanism: z.string() })) });
const plainAlt = z.object({ responses: z.array(z.object({ ...base, ifAlternative: dist, mechanism: z.string() })) });
// Role-play: the persona's own words first (a short first-person reaction), then the numbers.
const roleplay = z.object({ responses: z.array(z.object({ personaId: z.string(), reaction: z.string(), ifNoEvent: dist, ifEvent: dist })) });
const roleplayAlt = z.object({ responses: z.array(z.object({ personaId: z.string(), reaction: z.string(), ifNoEvent: dist, ifEvent: dist, ifAlternative: dist })) });

// Baseline: "survey" = 2022 survey-model prior; "poll" (default) = the same prior re-anchored on the polls of the 45 days before the event.
export const BASELINE_MODE = process.env.ANALYZE_BASELINE === "survey" ? "survey" : "poll";
// Persona view: "roleplay" (default) = the model plays the person from the full profile; "demographic" = a few demographic fields + baseline.
export const PERSONA_MODE = process.env.ANALYZE_PERSONA === "demographic" ? "demographic" : "roleplay"; // role-play is the default: on 30 neutral controls it cut false positives 4.5 % -> 0 % and the far-right bias 4x (docs/radar-trust.md section 9)

const normalise = (d: Dist): Dist => {
  const total = OPTIONS.reduce((sum, key) => sum + Math.max(0, d[key]), 0) || 1;
  return Object.fromEntries(OPTIONS.map((key) => [key, Math.max(0, d[key]) / total])) as Dist;
};

type CandidateDist = Record<string, number>;
const normaliseCandidate = (d: CandidateDist): CandidateDist => {
  const total = [...CANDIDATE_IDS, "abstention"].reduce((sum, key) => sum + Math.max(0, Number(d[key] ?? 0)), 0) || 1;
  return Object.fromEntries([...CANDIDATE_IDS, "abstention"].map((key) => [key, Math.max(0, Number(d[key] ?? 0)) / total]));
};

function blocDistribution(d: CandidateDist): Dist {
  const out = Object.fromEntries(OPTIONS.map((key) => [key, 0])) as Dist;
  for (const id of CANDIDATE_IDS) {
    const bloc = candidateBloc[id];
    if (bloc) out[bloc as Option] += d[id] ?? 0;
  }
  out.abstention = d.abstention ?? 0;
  return out;
}

function candidateShares(target: Record<string, number> | null): Record<string, number> {
  const fallback = Object.fromEntries(CANDIDATE_IDS.map((id) => [id, 1 / CANDIDATE_IDS.length]));
  if (!target) return fallback;
  const sums = Object.fromEntries(CANDIDATE_IDS.map((id) => [id, Math.max(0, target[id] ?? 0)]));
  const total = CANDIDATE_IDS.reduce((sum, id) => sum + sums[id], 0);
  return total ? Object.fromEntries(CANDIDATE_IDS.map((id) => [id, sums[id] / total])) : fallback;
}

function candidatePollTarget(isoDate: string): Record<string, number> | null {
  const t = Date.parse(isoDate);
  const recent = pollObservations.filter((poll) => Date.parse(poll.fieldworkEnd) <= t && Date.parse(poll.fieldworkEnd) > t - 45 * 86_400_000);
  const use = recent.length ? recent : pollObservations.filter((poll) => Date.parse(poll.fieldworkEnd) <= t).slice(-5);
  if (!use.length) return null;
  const sums = Object.fromEntries(CANDIDATE_IDS.map((id) => [id, 0])) as Record<string, number>;
  for (const poll of use) for (const id of CANDIDATE_IDS) sums[id] += (poll.values as Record<string, number>)[id] ?? 0;
  return Object.fromEntries(CANDIDATE_IDS.map((id) => [id, sums[id] / use.length]));
}

function candidateBaseline(persona: RadarPersona, candidateTarget: Record<string, number> | null, blocTarget: Record<string, number> | null, priorMass: number[]): CandidateDist {
  const base = blocTarget ? anchored(persona, blocTarget, priorMass) : baseline(persona);
  const bloc = base ?? { radical_left: .2, left: .2, center: .2, right: .1, far_right: .2, abstention: .1 };
  const shares = candidateShares(candidateTarget);
  const byBloc = Object.fromEntries(OPTIONS.slice(0, 5).map((key) => [key, 0])) as Record<string, number>;
  for (const id of CANDIDATE_IDS) if (candidateBloc[id]) byBloc[candidateBloc[id]] += shares[id];
  return Object.fromEntries([
    ...CANDIDATE_IDS.map((id) => [id, (bloc as Record<string, number>)[candidateBloc[id] ?? "center"] * (shares[id] / (byBloc[candidateBloc[id] ?? "center"] || 1))]),
    ["abstention", bloc.abstention],
  ]);
}

function rng(seed: string) { // small seeded PRNG so bootstrap intervals are reproducible
  let a = parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const COMMON = (poll: boolean, alt: boolean) => `Pour chaque personne, donnez ${alt ? "trois" : "deux"} distributions d’intention de vote à la présidentielle sur les candidats fournis et l’abstention (un nombre entre 0 et 1 par candidat, somme égale à 1) : « ifNoEvent » : l’événement n’a pas eu lieu ; « ifEvent » : l’événement a eu lieu et la personne en a connaissance${alt ? " ; « ifAlternative » : le scénario alternatif décrit a eu lieu à la place, et la personne en a connaissance" : ""}. Partez de la distribution de base fournie (modèle d’enquête 2022${poll ? " recalé sur le niveau des sondages récents" : ""}, contexte faible) et écartez-vous-en seulement pour une raison concrète liée à ${alt ? "l’événement ou au scénario" : "l’événement"} ; sans raison concrète, les distributions restent égales à la base, y compris pour l’abstention. Un déplacement raisonnable est de quelques points, rarement plus de 10 points, et seulement pour les personnes réellement concernées. Un même événement peut mobiliser ou démobiliser : estimez aussi l’abstention. Fournissez exactement une réponse par personne, avec toutes les clés candidat et abstention.`;

const SYSTEM_DEMOGRAPHIC = (poll: boolean, alt: boolean) => `Vous estimez, pour des profils synthétiques français, leur intention de vote à la présidentielle selon plusieurs mondes. ${COMMON(poll, alt)} Ne devinez ni parti préféré ni idéologie à partir de la profession, de l’âge ou du lieu. Expliquez en français, en une phrase, le mécanisme concret ou son absence (champ « mechanism »).`;

const SYSTEM_ROLEPLAY = (poll: boolean, alt: boolean) => `Vous incarnez des personnes françaises. On vous décrit chacune en détail (âge, métier, lieu, biographie, contexte électoral de sa commune). Pour chaque personne, mettez-vous à sa place : ce que SA situation, SES habitudes et SES valeurs probables lui feraient penser de l’actualité décrite, comme si vous étiez elle, et non comme un analyste politique. Beaucoup de gens suivent peu l’actualité politique : sans lien concret avec sa vie, son quotidien ou ses convictions, la personne ne change rien à son intention de vote. Chaque personne répond indépendamment des autres. Pour chacune, écrivez d’abord « reaction » : une ou deux phrases à la première personne (ce que vous pensez de cette nouvelle, ou si elle vous laisse indifférent), puis les distributions. ${COMMON(poll, alt)}`;

const CANDIDATE_DEF = Object.fromEntries([
  ...pollCandidates.map((candidate) => [candidate.id, candidate.name]),
  ["abstention", "ne vote pas"],
]);

/** Local electoral context of the persona's commune (observed results), compact. */
function localContext(p: RadarPersona) {
  return (p.historicalContext ?? []).filter((row) => ["2022_pres_t1", "2024_euro_t1", "2026_muni_t1"].includes(row.electionId))
    .map((row) => ({ scrutin: row.electionId, abstention_commune: `${Math.round(row.abstentionShare * 100)} %`, premiers_choix_commune: row.voteVectorEligible ? row.choices.slice(0, 2).map((choice) => `${choice.label} ${Math.round(choice.shareOfRegistered * 100)} % des inscrits`) : [] }));
}

type Answer = { personaId: string; ifNoEvent: CandidateDist; ifEvent: CandidateDist; ifAlternative?: CandidateDist; mechanism?: string; reaction?: string };

async function askBatch(event: RadarEvent, alternative: string | null, personas: RadarPersona[], seed: string, candidateTarget: Record<string, number> | null, blocTarget: Record<string, number> | null, priorMass: number[]) {
  const order = [...CANDIDATE_IDS, "abstention"].sort((a, b) => createHash("sha256").update(`${seed}${a}`).digest("hex").localeCompare(createHash("sha256").update(`${seed}${b}`).digest("hex"))); // candidates shown in a seeded random order: no positional bias
  const base0 = (p: RadarPersona) => Object.fromEntries(order.map((key) => [key, Number(candidateBaseline(p, candidateTarget, blocTarget, priorMass)[key].toFixed(3))]));
  const rp = PERSONA_MODE === "roleplay", alt = alternative != null, poll = !!candidateTarget;
  const view = personas.map((p) => rp ? {
    id: p.id, profil: { age: p.age, sexe: p.sex, diplome: p.education, profession: p.occupation, foyer: p.household, situation: p.maritalStatus, commune: p.commune, departement: p.department, densite: p.geography?.density ?? null },
    biographie: p.profileNarrative, parcours_professionnel: p.professionalNarrative, contexte_local: localContext(p), distribution_de_base: base0(p),
  } : {
    id: p.id, age: p.age, sex: p.sex, education: p.education, occupation: p.occupation, household: p.household, commune: p.commune, department: p.department, baseline: base0(p),
  });
  const schema = (rp ? (alt ? roleplayAlt : roleplay) : (alt ? plainAlt : plain)) as unknown as z.ZodType<{ responses: Answer[] }>;
  const out = await callStructuredModel({
    schema, schemaName: `radar_probabilistic_response_v2${rp ? "_roleplay" : ""}${alt ? "_alt" : ""}`, stageName: "radar_probabilistic_response",
    system: rp ? SYSTEM_ROLEPLAY(poll, alt) : SYSTEM_DEMOGRAPHIC(poll, alt),
    user: JSON.stringify({ evenement: { titre: event.title, description: event.description }, ...(alt ? { scenario_alternatif: alternative } : {}), definitions_des_candidats: CANDIDATE_DEF, personnes: view }),
  });
  const wanted = new Set(personas.map((p) => p.id)), seen = new Set<string>();
  for (const r of out.data.responses) { if (!wanted.has(r.personaId) || seen.has(r.personaId)) throw new Error("Unexpected or duplicate persona response"); seen.add(r.personaId); }
  if (seen.size !== wanted.size) throw new Error("The model omitted a sampled persona");
  return out.data.responses.map((r) => ({ personaId: r.personaId, ifNoEvent: normaliseCandidate(r.ifNoEvent), ifEvent: normaliseCandidate(r.ifEvent), ifAlternative: r.ifAlternative ? normaliseCandidate(r.ifAlternative) : null, text: r.mechanism ?? r.reaction ?? "" }));
}

const retry = async <T>(run: () => Promise<T>) => { try { return await run(); } catch { return run(); } };
type Row = { personaId: string; before: CandidateDist; after: CandidateDist; delta: CandidateDist; deltaAlt: CandidateDist | null; text: string };

/** n personas per run (batches of `batch`, in parallel), `runs` independent samples. Effect = mean(ifEvent - ifNoEvent), bootstrap 95% interval. */
export async function evaluateSegmentEffect(event: RadarEvent, segment: SegmentPreview, { n = 24, batch = PERSONA_MODE === "roleplay" ? 4 : 8, runs = 2, alternative = null as string | null } = {}) {
  const { priorMass } = await loadPersonas(process.env.RADAR_PERSONA_INDEX || "data/radar/personas.jsonl");
  const candidateTarget = BASELINE_MODE === "poll" ? candidatePollTarget(event.occurredAt.slice(0, 10)) : null;
  const blocTarget = BASELINE_MODE === "poll" ? pollTarget(event.occurredAt.slice(0, 10)) : null;
  let matched = 0;
  const diff = (a: CandidateDist, b: CandidateDist) => Object.fromEntries([...CANDIDATE_IDS, "abstention"].map((key) => [key, a[key] - b[key]]));
  const perRun: Row[][] = await Promise.all(Array.from({ length: runs }, async (_, run) => {
    const { matches, selected } = await sampleSegmentPersonas(event, segment, n, `run${run}`);
    matched = matches;
    const chunks = Array.from({ length: Math.ceil(selected.length / batch) }, (_, i) => selected.slice(i * batch, (i + 1) * batch));
    const answers = (await Promise.all(chunks.map((chunk, i) => retry(() => askBatch(event, alternative, chunk, `${segment.id}|${run}|${i}`, candidateTarget, blocTarget, priorMass))))).flat();
    return answers.map((a) => ({ personaId: a.personaId, before: a.ifNoEvent, after: a.ifEvent, delta: diff(a.ifEvent, a.ifNoEvent), deltaAlt: a.ifAlternative ? diff(a.ifEvent, a.ifAlternative) : null, text: a.text }));
  }));
  const all = perRun.flat();
  const random = rng(`${event.title}|${segment.id}`);
  const mean = (rows: CandidateDist[], key: string) => rows.reduce((sum, r) => sum + r[key], 0) / (rows.length || 1);
  const summarise = (keys: string[], pick: (r: Row) => Record<string, number> | null) => {
    const sets = perRun.map((rows) => rows.map(pick).filter((d): d is Dist => d != null)), flat = sets.flat();
    if (!flat.length) return undefined;
    return Object.fromEntries(keys.map((key) => {
      const boots = Array.from({ length: 400 }, () => mean(Array.from({ length: flat.length }, () => flat[Math.floor(random() * flat.length)]), key)).sort((a, b) => a - b);
      const runMeans = sets.map((rows) => mean(rows, key));
      return [key, { mean: mean(flat, key), lo: boots[10], hi: boots[389], stable: runMeans.every((m) => Math.sign(m) === Math.sign(runMeans[0]) && Math.abs(m) >= 0.005) }];
    }));
  };
  const candidateKeys = [...CANDIDATE_IDS, "abstention"];
  const candidateEffect = summarise(candidateKeys, (r) => r.delta);
  const candidateLevels = Object.fromEntries(candidateKeys.map((key) => {
    const before = mean(all.map((row) => row.before), key);
    const after = mean(all.map((row) => row.after), key);
    return [key, { before, after, change: after - before }];
  }));
  const argmax = (distribution: CandidateDist) => candidateKeys.reduce((best, key) => distribution[key] > distribution[best] ? key : best, candidateKeys[0]);
  const candidateTransitions: Record<string, Record<string, number>> = Object.fromEntries(candidateKeys.map((key) => [key, {}]));
  for (const row of all) {
    const from = argmax(row.before), to = argmax(row.after);
    candidateTransitions[from][to] = (candidateTransitions[from][to] ?? 0) + 1;
  }
  // Preserve the original bloc-level contract for backtests and consumers that
  // still expect `effect`/`altEffect` to be keyed by the five blocs + abstention.
  const toBloc = (candidate: CandidateDist | null): Dist | null => candidate ? blocDistribution(candidate) : null;
  const blocKeys = [...OPTIONS];
  const effect = summarise(blocKeys, (r) => toBloc(r.delta));
  const altEffect = summarise(blocKeys, (r) => toBloc(r.deltaAlt));
  // Direction counts kept for the existing UI: |per-persona delta| >= 2 points.
  const summary = Object.fromEntries(OPTIONS.map((key) => [key, {
    toward: all.filter((r) => blocDistribution(r.delta)[key] >= 0.02).length,
    away: all.filter((r) => blocDistribution(r.delta)[key] <= -0.02).length,
    noClearChange: all.filter((r) => Math.abs(blocDistribution(r.delta)[key]) < 0.02).length,
  }]));
  const candidateSummary = Object.fromEntries([...CANDIDATE_IDS, "abstention"].map((key) => [key, {
    toward: all.filter((r) => r.delta[key] >= 0.02).length,
    away: all.filter((r) => r.delta[key] <= -0.02).length,
    noClearChange: all.filter((r) => Math.abs(r.delta[key]) < 0.02).length,
  }]));
  return { segmentId: segment.id, segmentName: segment.name, matchedCount: matched, sampledCount: all.length, runs, comparator: segment.counterfactual.comparator,
    selection: "deterministic_diversity_sample_by_2022_prior", evidenceGrade: "unvalidated_llm_directional_hypothesis" as const,
    effect, ...(altEffect ? { altEffect } : {}), ...(candidateEffect ? { candidateEffect } : {}), summary, candidateSummary, candidateLevels, candidateTransitions, mechanisms: all.slice(0, 3).map((r) => r.text).filter(Boolean),
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
