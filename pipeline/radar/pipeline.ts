
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { z } from "zod";
import { callStructuredModel } from "./openaiStructured";
import { CLUSTERS, filterSchema, matchesFilter, ONTOLOGY_VERSION, TAG_IDS, TAG_REGISTRY, tagIdSchema, type RadarFilter, type RadarPersona } from "../../src/lib/radar/ontology";
import { normalizeFilter, pruneSpuriousGaps, SINGLE_VALUED_FAMILIES, splitMeasurementGaps } from "./filters";
import { buildGeographyResolver, type GeographyEntry } from "../../src/lib/radar/geography";

const eventSchema = z.object({
  title: z.string().trim().min(8).max(180),
  description: z.string().trim().min(30).max(7000),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUrl: z.string().url(),
});
export type RadarEvent = z.infer<typeof eventSchema>;

const segmentProposalSchema = z.object({
  name: z.string(),
  mechanism: z.string(),
  reason: z.string(),
  all: z.array(tagIdSchema),
  any: z.array(tagIdSchema),
  none: z.array(tagIdSchema),
  place: z.object({ commune: z.string(), department: z.string() }),
  membershipGaps: z.array(z.string()),
  measurementNeeds: z.array(z.string()),
  counterfactual: z.object({ intervention: z.string(), comparator: z.string(), outcomeToMeasure: z.string() }),
});
const eventMapSchema = z.object({
  globalScenarios: z.array(z.object({ intervention: z.string(), comparator: z.string(), outcomeToMeasure: z.string(), reason: z.string() })),
  segments: z.array(segmentProposalSchema),
});

type SegmentProposal = z.infer<typeof segmentProposalSchema>;
export type SegmentPreview = SegmentProposal & {
  id: string;
  resolvedPlace: { communeCode: string | null; departmentCode: string } | null;
  count: number;
  countIncludingNarrativeRules: number;
  distinctCommunes: number;
  samplePersonaIds: string[];
  status: "filterable_discovery_sample" | "insufficient_sample" | "incomplete_membership" | "invalid_filter";
  issue?: string;
  /** Deterministic repairs applied to the model's proposal (union regrouping, dropped spurious gaps). */
  repairs?: string[];
};

function personaPath() {
  return process.env.RADAR_PERSONA_INDEX || path.join(process.cwd(), "data/radar/personas.jsonl");
}

async function eachPersona(visitor: (persona: RadarPersona) => void) {
  const stream = readline.createInterface({ input: createReadStream(personaPath()), crlfDelay: Infinity });
  for await (const line of stream) if (line.trim()) visitor(JSON.parse(line) as RadarPersona);
}

async function tagCoverage() {
  const coverage: Record<string, number> = Object.fromEntries(TAG_IDS.map((id) => [id, 0]));
  let rows = 0;
  await eachPersona((persona) => {
    rows += 1;
    for (const tag of persona.tags) if (tag.source !== "narrative_rule") coverage[tag.id] += 1;
  });
  return { coverage, rows };
}

// The calibrated persona index is large and immutable during normal app use.
// Keep its coverage in memory so each event analysis does not rescan ~115k rows.
let tagCoveragePromise: ReturnType<typeof tagCoverage> | undefined;
const eventAnalysisCache = new Map<string, ReturnType<typeof analyzeRadarEventUncached>>();

function cachedTagCoverage() {
  tagCoveragePromise ??= tagCoverage().catch((error) => {
    tagCoveragePromise = undefined;
    throw error;
  });
  return tagCoveragePromise;
}

function validFilter(proposal: SegmentProposal): RadarFilter {
  const filter = filterSchema.parse({ all: proposal.all, any: proposal.any, none: proposal.none });
  const requiredFamilies = new Map<string, string>();
  for (const id of filter.all) {
    const family = id.split(".")[0];
    if (["age", "sex", "education", "occupation", "household", "marital", "geo", "commune_size"].includes(family)) {
      const previous = requiredFamilies.get(family);
      if (previous && previous !== id) throw new Error(`Conflicting required tags: ${previous}, ${id}`);
      requiredFamilies.set(family, id);
    }
  }
  for (const id of filter.all) if (filter.none.includes(id)) throw new Error(`Tag both required and excluded: ${id}`);
  for (const id of filter.none) if (["profession", "former_profession"].includes(id.split(".")[0])) {
    throw new Error(`Cannot prove absence of open-ended attribute: ${id}`);
  }
  return filter;
}

async function analyzeRadarEventUncached(rawEvent: unknown) {
  const event = eventSchema.parse(rawEvent);
  const { coverage, rows } = await cachedTagCoverage();
  if (rows === 0) throw new Error("Persona index is empty. Run scripts/radar/build-personas.ts first.");
  const manifest = JSON.parse(await readFile(`${personaPath()}.manifest.json`, "utf8")) as { frame: string; rowCount: number; datasetRevision?: string; geographyYear?: number; ontologyVersion?: string };
  if (manifest.ontologyVersion !== ONTOLOGY_VERSION) throw new Error("Persona index ontology is stale; rebuild the index");
  const geoPath = process.env.RADAR_GEOGRAPHY_INDEX || path.join(process.cwd(), "data/radar/geography-2026.json");
  const geographyData = JSON.parse(await readFile(geoPath, "utf8")) as { records: GeographyEntry[] };
  const resolveCommune = buildGeographyResolver(geographyData.records);
  const departmentCodes = new Map<string, string>();
  for (const row of geographyData.records) departmentCodes.set(row.department.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(), row.departmentCode);
  const available = TAG_REGISTRY.map((tag) => ({ ...tag, count: coverage[tag.id] })).filter((tag) => tag.count > 0).sort((a, b) => b.count - a.count);
  const clusters = CLUSTERS.filter((cluster) => coverage[cluster.id] > 0).map(({ id, label, description }) => ({ id, label, description, count: coverage[id] }));
  const result = await callStructuredModel({
    schema: eventMapSchema,
    schemaName: "radar_event_map_v1",
    stageName: "radar_event_map",
    system: `Vous proposez des hypothèses testables sur les publics concernés, jamais des estimations d’effet électoral. Utilisez UNIQUEMENT les identifiants de tags fournis. Les effectifs indiquent la couverture dans un échantillon synthétique de communes sélectionnées, comprenant beaucoup de Paris, Lyon et Marseille ; ils ne représentent NI la population nationale NI des tailles d’effet. Ne classez pas les groupes selon ces effectifs. Un segment correspond à l’intersection des tags de « all », à au moins un tag de « any » si la liste n’est pas vide, et à l’exclusion des tags de « none ». Les familles age, sex, education, occupation, household, marital, geo et commune_size sont à valeur unique : une personne n’a qu’une seule valeur par famille. « all » contient donc au plus un tag par famille ; pour « 35 à 64 ans » ou « employés et ouvriers », placez les valeurs alternatives dans « any ». « any » est UNE seule liste d’alternatives : n’y mélangez pas plusieurs familles et ne l’utilisez pas pour deux unions à la fois. Une liste de « clusters » (publics nommés, déjà définis par des règles sur les tags) est fournie : utilisez un cluster dès qu’il correspond au public visé, seul ou combiné à d’autres tags. Pour un lieu précis, utilisez son nom officiel et son département tels qu’ils figurent dans l’événement ; sinon laissez ces champs vides. Une vérification COG distincte valide le lieu : n’en inventez aucun. Dans « membershipGaps », indiquez UNIQUEMENT un attribut nécessaire pour définir le groupe nommé qu’AUCUN tag ni cluster fourni ne peut représenter (revenu, pension, vote passé, statut de sortant…) ; un attribut déjà couvert par une famille de tags (âge, foyer, statut matrimonial, densité…) n’est jamais une lacune, choisissez simplement la valeur voulue. Laissez ce champ vide si les tags et le lieu suffisent. Placez les variables de résultat, mécanisme, exposition et enquête dans « measurementNeeds », jamais dans « membershipGaps ». N’utilisez pas de substitut approximatif pour une caractéristique absente. Proposez 2 à 4 segments distincts, un scénario contrefactuel précis par segment et 1 à 2 scénarios globaux. Distinguez l’événement réel de l’alternative hypothétique. N’affirmez aucune variation chiffrée du vote et ne traitez jamais les biographies synthétiques comme des données d’enquête humaine. Rédigez tous les champs en langage naturel en français.`,
    user: JSON.stringify({ event, ontologyVersion: ONTOLOGY_VERSION, singleValuedFamilies: SINGLE_VALUED_FAMILIES, clusters, tagCoverage: available, sampleSize: rows }),
  });
  const proposals = result.data.segments.slice(0, 4);
  const segments: SegmentPreview[] = proposals.map((proposal, index) => ({
    ...proposal, id: `segment_${index + 1}`, count: 0, countIncludingNarrativeRules: 0,
    distinctCommunes: 0, samplePersonaIds: [], status: "insufficient_sample", resolvedPlace: null,
  }));
  const filters = segments.map((segment, index) => {
    try {
      const normalized = normalizeFilter(segment);
      if (normalized.error) throw new Error(normalized.error);
      segment.all = normalized.all as typeof segment.all;
      segment.any = normalized.any as typeof segment.any;
      const gaps = pruneSpuriousGaps(segment.membershipGaps);
      const split = splitMeasurementGaps(gaps.kept);
      segment.membershipGaps = split.gaps;
      segment.measurementNeeds = [...segment.measurementNeeds, ...split.measurement];
      segment.repairs = [...normalized.repairs, ...split.measurement.map((gap) => `« ${gap} » déplacé de « lacunes » vers « à mesurer » : variable de résultat, pas critère d’appartenance`), ...gaps.dropped.map((gap) => `Lacune « ${gap} » ignorée : cet attribut existe déjà dans les tags`)];
      const filter = validFilter(segment);
      const place = segment.place;
      if (place.commune && !place.department) throw new Error("Named commune needs its department");
      if (place.department) {
        const departmentKey = place.department.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const departmentCode = departmentCodes.get(departmentKey);
        if (!departmentCode) throw new Error(`Department not found in INSEE COG: ${place.department}`);
        const communeCode = place.commune ? resolveCommune(place.commune, place.department)?.communeCode : null;
        if (place.commune && !communeCode) throw new Error(`Commune/department not found unambiguously in INSEE COG: ${place.commune}, ${place.department}`);
        segment.resolvedPlace = { communeCode: communeCode ?? null, departmentCode };
      }
      return filter;
    }
    catch (error) {
      segments[index].status = "invalid_filter";
      segments[index].issue = error instanceof Error ? error.message : String(error);
      return null;
    }
  });
  const communes = segments.map(() => new Set<string>());
  await eachPersona((persona) => {
    filters.forEach((filter, index) => {
      if (!filter) return;
      const place = segments[index].resolvedPlace;
      if (place && (!persona.geography || persona.geography.departmentCode !== place.departmentCode ||
        (place.communeCode && persona.geography.communeCode !== place.communeCode && persona.geography.parentCommuneCode !== place.communeCode))) return;
      if (matchesFilter(persona, filter, ["direct", "derived", "official_geo", "narrative_rule", "audited_narrative"])) segments[index].countIncludingNarrativeRules += 1;
      if (!matchesFilter(persona, filter)) return;
      const segment = segments[index];
      segment.count += 1;
      if (persona.geography?.communeCode) communes[index].add(persona.geography.communeCode);
      if (segment.samplePersonaIds.length < 3) segment.samplePersonaIds.push(persona.id);
    });
  });
  segments.forEach((segment, index) => {
    segment.distinctCommunes = communes[index].size;
    if (segment.status === "invalid_filter") return;
    const minCommunes = segment.resolvedPlace?.communeCode ? 1 : 3;
    if (segment.membershipGaps.length > 0 || (segment.count === 0 && segment.countIncludingNarrativeRules > 0)) {
      segment.status = "incomplete_membership";
      segment.issue = segment.membershipGaps.length ? `Attributs absents des tags : ${segment.membershipGaps.join(", ")}` : "Seuls des tags issus du récit (non audités) permettraient de former ce groupe";
    } else if (segment.count < 20 || segment.distinctCommunes < minCommunes) {
      segment.status = "insufficient_sample";
      segment.issue = [segment.count < 20 && `${segment.count} profils (minimum 20)`, segment.distinctCommunes < minCommunes && `${segment.distinctCommunes} communes (minimum ${minCommunes})`].filter(Boolean).join(" · ");
    } else segment.status = "filterable_discovery_sample";
  });
  return {
    event, ontologyVersion: ONTOLOGY_VERSION, index: manifest,
    evidenceGrade: "hypothesis" as const,
    globalScenarios: result.data.globalScenarios.slice(0, 2), segments,
    note: "Ces hypothèses portent sur l’exposition à l’événement de profils synthétiques. Les réactions directionnelles sont exploratoires et doivent être validées auprès de personnes réelles ; aucun déplacement électoral n’est estimé.",
  };
}

export async function analyzeRadarEvent(rawEvent: unknown) {
  const event = eventSchema.parse(rawEvent);
  const key = createHash("sha256").update(JSON.stringify({
    event,
    personaIndex: personaPath(),
    geographyIndex: process.env.RADAR_GEOGRAPHY_INDEX || path.join(process.cwd(), "data/radar/geography-2026.json"),
    ontologyVersion: ONTOLOGY_VERSION,
  })).digest("hex");
  const cached = eventAnalysisCache.get(key);
  if (cached) return cached;

  const pending = analyzeRadarEventUncached(event).catch((error) => {
    eventAnalysisCache.delete(key);
    throw error;
  });
  eventAnalysisCache.set(key, pending);
  // Bound process memory while retaining recent event analyses.
  if (eventAnalysisCache.size > 50) eventAnalysisCache.delete(eventAnalysisCache.keys().next().value!);
  return pending;
}
