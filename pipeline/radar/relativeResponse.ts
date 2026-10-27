
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { z } from "zod";
import { callStructuredModel } from "./openaiStructured";
import { filterSchema, matchesFilter, type RadarPersona } from "../../src/lib/radar/ontology";
import type { RadarEvent, SegmentPreview } from "./pipeline";

export const BLOCS = ["radical_left", "left", "center", "right", "far_right"] as const;
const blocSchema = z.enum(BLOCS);
const directionSchema = z.enum(["toward", "away", "no_clear_change"]);
export type Direction = z.infer<typeof directionSchema>;
const responseSchema = z.object({
  responses: z.array(z.object({
    personaId: z.string(),
    blocs: z.array(z.object({ bloc: blocSchema, direction: directionSchema })),
    abstention: directionSchema,
    mechanism: z.string(),
    uncertainty: z.string(),
  })),
});

function rank(seed: string, personaId: string) {
  return createHash("sha256").update(`${seed}|${personaId}`).digest("hex");
}

function priorAnchor(persona: RadarPersona) {
  const prior = persona.historicalPropensity;
  if (!prior || !prior.pilotHeldoutGainPositive) return null;
  const top = Object.entries(prior.probabilities)
    .filter(([id]) => id.startsWith("choice_"))
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([id, probability]) => ({ choice: prior.choiceLabels[id] ?? id, probability }));
  return { election: prior.electionId, scope: prior.scope, top,
    abstentionProbability: prior.probabilities.abstention, source: prior.surveySource };
}

function localAnchor(persona: RadarPersona) {
  return (persona.historicalContext ?? [])
    .filter((row) => ["2022_pres_t1", "2024_euro_t1", "2026_muni_t1"].includes(row.electionId))
    .map((row) => ({ election: row.electionId, scope: row.scope,
      abstentionShare: row.abstentionShare,
      topChoices: row.voteVectorEligible ? row.choices.slice(0, 3).map((choice) => ({ label: choice.label, shareOfRegistered: choice.shareOfRegistered })) : [],
    }));
}

function snapshot(persona: RadarPersona) {
  return {
    id: persona.id, age: persona.age, sex: persona.sex, education: persona.education,
    occupation: persona.occupation, household: persona.household, maritalStatus: persona.maritalStatus,
    commune: persona.commune, department: persona.department,
    syntheticProfessionalNarrative: persona.professionalNarrative.slice(0, 360),
    tags: persona.tags.filter((tag) => tag.source !== "narrative_rule").map((tag) => tag.id),
    surveyInformedHistoricalPropensity: priorAnchor(persona),
    observedLocalElectionContext: localAnchor(persona),
  };
}

export async function sampleSegmentPersonas(event: RadarEvent, segment: SegmentPreview, limit = 6) {
  const global = segment.id.startsWith("global_") && segment.all.length === 0 && segment.any.length === 0 && segment.none.length === 0;
  const filter = global ? null : filterSchema.parse({ all: segment.all, any: segment.any, none: segment.none });
  if (segment.status === "invalid_filter" || segment.membershipGaps.length > 0) {
    throw new Error("Segment membership is not fully filterable");
  }
  if (filter?.none.some((tag) => tag.startsWith("profession.") || tag.startsWith("former_profession."))) {
    throw new Error("Open-ended narrative professions cannot be excluded");
  }
  type Candidate = { persona: RadarPersona; score: string };
  const keep = (bucket: Candidate[], candidate: Candidate, capacity: number) => {
    bucket.push(candidate);
    bucket.sort((a, b) => a.score.localeCompare(b.score));
    if (bucket.length > capacity) bucket.pop();
  };
  const byAnchor = new Map<string, Candidate[]>();
  const byDensity = new Map<string, Candidate[]>();
  const byCommune = new Map<string, Candidate>();
  const overall: Candidate[] = [];
  let matches = 0;
  const seed = `${event.title}|${event.occurredAt}|${segment.id}`;
  const index = global
    ? process.env.RADAR_GLOBAL_PERSONA_INDEX || path.join(process.cwd(), "data/radar/personas.jsonl")
    : process.env.RADAR_PERSONA_INDEX || path.join(process.cwd(), "data/radar/personas.jsonl");
  const lines = readline.createInterface({ input: createReadStream(index), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const persona = JSON.parse(line) as RadarPersona;
    const place = segment.resolvedPlace;
    if (place && (!persona.geography || persona.geography.departmentCode !== place.departmentCode ||
      (place.communeCode && persona.geography.communeCode !== place.communeCode && persona.geography.parentCommuneCode !== place.communeCode))) continue;
    if (!(global || (filter && matchesFilter(persona, filter)))) continue;
    matches += 1;
    const candidate = { persona, score: rank(seed, persona.id) };
    keep(overall, candidate, 40);
    if (global) {
      const commune = persona.geography?.communeCode ?? "unknown";
      const current = byCommune.get(commune);
      if (!current || candidate.score < current.score) byCommune.set(commune, candidate);
    }
    const top = Object.entries(persona.historicalPropensity?.probabilities ?? {})
      .filter(([id]) => id.startsWith("choice_"))
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
    const anchorBucket = byAnchor.get(top) ?? [];
    keep(anchorBucket, candidate, 8);
    byAnchor.set(top, anchorBucket);
    if (global) {
      const density = persona.geography?.density ?? "unknown";
      const densityBucket = byDensity.get(density) ?? [];
      keep(densityBucket, candidate, 8);
      byDensity.set(density, densityBucket);
    }
  }
  const selected: RadarPersona[] = [];
  if (global) for (const density of ["rural", "intermediate", "dense"]) {
    const candidate = byDensity.get(density)?.find(({ persona }) =>
      !selected.some((row) => row.geography?.communeCode === persona.geography?.communeCode));
    if (candidate && selected.length < limit) selected.push(candidate.persona);
  }
  const groups = [...byAnchor.values()].sort((a, b) => a[0].persona.id.localeCompare(b[0].persona.id));
  for (const group of groups) {
    const candidate = group.find(({ persona }) => !selected.some((row) => row.id === persona.id ||
      (global && row.geography?.communeCode === persona.geography?.communeCode)));
    if (candidate && selected.length < limit) selected.push(candidate.persona);
  }
  for (const { persona } of overall) if (selected.length < limit && !selected.some((row) => row.id === persona.id ||
    (global && row.geography?.communeCode === persona.geography?.communeCode))) selected.push(persona);
  if (global) for (const { persona } of [...byCommune.values()].sort((a, b) => a.score.localeCompare(b.score))) {
    if (selected.length >= limit) break;
    if (!selected.some((row) => row.geography?.communeCode === persona.geography?.communeCode)) selected.push(persona);
  }
  if (selected.length < 3) throw new Error("Fewer than three supported personas match this segment");
  return { matches, selected: selected.slice(0, limit) };
}

export async function evaluateSegmentContrast(event: RadarEvent, segment: SegmentPreview) {
  const { matches, selected } = await sampleSegmentPersonas(event, segment);
  const output = await callStructuredModel({
    schema: responseSchema, schemaName: "radar_relative_group_response_v1", stageName: "radar_relative_group_response",
    system: `Vous comparez une intervention précise à son scénario contrefactuel pour des profils synthétiques français. Pour chaque profil, indiquez uniquement la DIRECTION de son inclination de vote vers chacun des cinq blocs politiques et l’abstention, en supposant qu’il ait connaissance de l’intervention. Par défaut, utilisez « no_clear_change », sauf si l’événement ou l’intervention comporte un élément concret pertinent pour un parti et qu’une réaction différenciée soit plausible pour ce profil. Une modification procédurale ou d’une règle électorale locale ne permet pas, à elle seule, de conclure quel parti national en bénéficierait. N’inventez ni avantage partisan, ni statut de sortant, ni idéologie privée, ni exposition personnelle à partir de la profession, de l’âge, des résultats électoraux locaux ou d’une biographie synthétique. N’utilisez les propensions issues de l’enquête de 2022 que comme contexte historique faible ; les résultats locaux observés ne décrivent que le lieu et ne révèlent pas le vote de cette personne. N’inférez ni vote actuel pour 2027, ni variation en points, ni effet causal, ni prévision pour la population. Ne forcez pas un changement pour chaque bloc. Fournissez exactement une réponse par profil et exactement une entrée par bloc. Expliquez brièvement le mécanisme concret — ou son absence — ainsi que la principale incertitude. Rédigez ces explications en français.`,
    user: JSON.stringify({ event, intervention: segment.counterfactual.intervention,
      comparator: segment.counterfactual.comparator, segment: segment.name,
      blocDefinitions: { radical_left: "LFI and parties to its left", left: "social democratic and green left",
        center: "macronist or liberal center", right: "mainstream conservative right", far_right: "RN and allied far right" },
      personas: selected.map(snapshot) }),
  });
  const expected = new Set(selected.map((persona) => persona.id));
  const received = new Set<string>();
  for (const response of output.data.responses) {
    if (!expected.has(response.personaId) || received.has(response.personaId)) throw new Error("Unexpected or duplicate persona response");
    received.add(response.personaId);
    if (response.blocs.length !== BLOCS.length || new Set(response.blocs.map((item) => item.bloc)).size !== BLOCS.length) {
      throw new Error("The model must answer for each bloc exactly once");
    }
  }
  if (received.size !== expected.size) throw new Error("The model omitted a sampled persona");
  const summary = Object.fromEntries([...BLOCS, "abstention"].map((bloc) => {
    const directions = output.data.responses.map((response) => bloc === "abstention" ? response.abstention : response.blocs.find((item) => item.bloc === bloc)!.direction);
    return [bloc, {
      toward: directions.filter((direction) => direction === "toward").length,
      away: directions.filter((direction) => direction === "away").length,
      noClearChange: directions.filter((direction) => direction === "no_clear_change").length,
    }];
  }));
  return { segmentId: segment.id, segmentName: segment.name, matchedCount: matches,
    sampledCount: selected.length, selection: segment.id.startsWith("global_")
      ? "deterministic_sample_across_density_and_communes" : "deterministic_diversity_sample_by_2022_prior",
    evidenceGrade: "unvalidated_llm_directional_hypothesis" as const,
    comparator: segment.counterfactual.comparator,
    responses: output.data.responses,
    summary,
    note: "Les effectifs décrivent uniquement les profils synthétiques échantillonnés, sous condition d’exposition. Ils ne représentent ni des parts de vote, ni des variations de probabilité, ni des effets causaux estimés. Cette méthode directionnelle n’a pas encore été validée par comparaison à des réponses humaines.",
  };
}

/** Global contrasts use the same response prompt and evidence grade as group
 * contrasts; an empty filter addresses the distributed discovery index. */
export async function evaluateGlobalContrast(event: RadarEvent, scenario: {
  intervention: string; comparator: string; outcomeToMeasure: string; reason: string;
}, index: number) {
  if (!Number.isInteger(index) || index < 0 || index > 1) throw new Error("Invalid global scenario index");
  const segment: SegmentPreview = {
    id: `global_${index + 1}`, name: "Whole-index scenario", mechanism: scenario.reason,
    reason: scenario.reason, all: [], any: [], none: [], place: { commune: "", department: "" },
    resolvedPlace: null, membershipGaps: [], measurementNeeds: [scenario.outcomeToMeasure],
    counterfactual: { intervention: scenario.intervention, comparator: scenario.comparator,
      outcomeToMeasure: scenario.outcomeToMeasure },
    count: 0, countIncludingNarrativeRules: 0, distinctCommunes: 0,
    samplePersonaIds: [], status: "filterable_discovery_sample",
  };
  const response = await evaluateSegmentContrast(event, segment);
  return { ...response, scope: "global_distributed_discovery_sample" as const };
}
