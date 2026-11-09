
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadPersonas } from "./personaIndex";
import { z } from "zod";
import { callStructuredModel } from "./openaiStructured";
import { CLUSTERS, filterSchema, matchesFilter, ONTOLOGY_VERSION, TAG_IDS, TAG_REGISTRY, tagIdSchema, type RadarFilter, type RadarPersona } from "../../src/lib/radar/ontology";
import { normalizeFilter, pruneSpuriousGaps, SINGLE_VALUED_FAMILIES, splitMeasurementGaps } from "./filters";
import {
  DUPLICATE_JACCARD, globalScenario, jaccard, lacksEventSpecificity, Matcher, MAX_REPAIR_ROUNDS, MAX_SEGMENT_SHARE,
  MIN_COMMUNES, MIN_PLACE_SEGMENT_SIZE, MIN_SEGMENT_SIZE, MIN_USABLE_SEGMENTS, narrowings, relaxations, TARGET_SEGMENTS, templateScenario, type Place,
} from "./segmentRepair";
import { buildGeographyResolver, type GeographyEntry } from "../../src/lib/radar/geography";

const eventSchema = z.object({
  title: z.string().trim().min(8).max(180),
  description: z.string().trim().min(30).max(7000),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceUrl: z.string().url(),
});
export type RadarEvent = z.infer<typeof eventSchema>;

// The model no longer proposes a place or a counterfactual (see SegmentPreview): named places hold ~0 personas in the index.
const segmentProposalSchema = z.object({
  name: z.string(),
  mechanism: z.string(),
  reason: z.string(),
  all: z.array(tagIdSchema),
  any: z.array(tagIdSchema),
  none: z.array(tagIdSchema),
  membershipGaps: z.array(z.string()),
  measurementNeeds: z.array(z.string()),
});
const eventMapSchema = z.object({ segments: z.array(segmentProposalSchema) });

type SegmentProposal = z.infer<typeof segmentProposalSchema>;
export type SegmentPreview = SegmentProposal & {
  /** Kept for artifact compatibility: the model no longer proposes places, always empty. */
  place: { commune: string; department: string };
  /** Per-event template (one counterfactual for the event, not per segment); the model no longer proposes it. */
  counterfactual: { intervention: string; comparator: string; outcomeToMeasure: string };
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

// In-memory slim view (tags, geography): no rescan of the multi-GB file per event. See personaIndex.ts.
async function eachPersona(visitor: (persona: RadarPersona) => void) {
  for (const persona of (await loadPersonas(personaPath())).personas) visitor(persona);
}

let matcherPromise: Promise<Matcher> | undefined;
function cachedMatcher() {
  matcherPromise ??= loadPersonas(personaPath()).then(({ personas }) => new Matcher(personas)).catch((error) => { matcherPromise = undefined; throw error; });
  return matcherPromise;
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

// Illustrations only (checked against the index: each is non-empty and within the size limits). Not to be copied.
const EXAMPLES = `EXEMPLES ILLUSTRATIFS (événements fictifs, à ne PAS recopier : adaptez le raisonnement à l’événement réel) :
Exemple 1 — « Le maire de Lille appelle à rassembler la gauche derrière une candidature unique à la présidentielle »
  • « Cadres des grandes villes » : mécanisme « électorat urbain et diplômé, cœur de cible de l’appel à l’union de la gauche porté par le maire de Lille » ; all [cluster.urban_executive] (un cluster seul, car c’est exactement le bon public).
  • « Femmes cadres intermédiaires des communes denses » : mécanisme « électorat féminin de la gauche modérée, concerné par la question de l’union » ; all [sex.female, occupation.intermediate, geo.dense] (intersection de 3 tags).
  • « Actifs employés des communes intermédiaires » : mécanisme « base populaire de la gauche, à convaincre de se ranger derrière une candidature unique » ; all [geo.intermediate, occupation.employee], any [age.25_34, age.35_49] (tags obligatoires + liste d’alternatives).
Exemple 2 — « Le gouvernement propose de désindexer les pensions de retraite de l’inflation en 2027 »
  • « Retraités de 75 ans et plus ne vivant pas seuls » : mécanisme « premiers touchés par la désindexation des pensions, avec peu de marge d’adaptation » ; all [occupation.retired], any [age.75_plus], none [household.single] (usage d’un « none »).
  • « Ouvriers de 50 à 64 ans » : mécanisme « proches de la retraite, ils anticipent l’effet de la désindexation sur leur future pension » ; all [cluster.older_worker].
  • « Retraités ruraux » : mécanisme « pensions modestes et dépendance à la voiture dans les communes rurales, très sensibles à la perte de pouvoir d’achat » ; all [cluster.rural_retiree].
Exemple 3 — « Le ministre de l’Intérieur annonce 500 policiers supplémentaires après une fusillade à Marseille »
  • « Parents de famille des communes denses » : mécanisme « familles exposées à l’insécurité urbaine, destinataires de l’annonce de renforts policiers » ; all [household.couple_with_children, geo.dense, education.baccalaureate].
  • « Commerçants et artisans » : mécanisme « premiers concernés par la sécurité de leur commerce, sensibles à la présence policière » ; all [cluster.independent].
  • « Femmes de 25 à 49 ans vivant seules en ville » : mécanisme « sentiment d’insécurité dans l’espace public après une fusillade » ; all [sex.female, household.single, geo.dense], any [age.25_34, age.35_49].
Ces exemples montrent des filtres de formes variées (cluster seul, intersection de 3 tags, « any », « none ») ; chaque mécanisme nomme un élément précis de l’événement.`;

const SYSTEM = `Vous proposez des hypothèses testables sur les publics concernés, jamais des estimations d’effet électoral. Utilisez UNIQUEMENT les identifiants de tags fournis. Les effectifs indiquent la couverture dans un échantillon synthétique de communes sélectionnées, comprenant beaucoup de Paris, Lyon et Marseille ; ils ne représentent NI la population nationale NI des tailles d’effet. Ne classez pas les groupes selon ces effectifs. Un segment correspond à l’intersection des tags de « all », à au moins un tag de « any » si la liste n’est pas vide, et à l’exclusion des tags de « none ». Les familles age, sex, education, occupation, household, marital, geo et commune_size sont à valeur unique : une personne n’a qu’une seule valeur par famille. « all » contient donc au plus un tag par famille ; pour « 35 à 64 ans » ou « employés et ouvriers », placez les valeurs alternatives dans « any ». « any » est UNE seule liste d’alternatives : n’y mélangez pas plusieurs familles et ne l’utilisez pas pour deux unions à la fois. Les tags sont des BRIQUES pour COMPOSER des publics sur mesure : construisez l’intersection qui correspond au mécanisme de CET événement, au-delà des publics nommés. Les « clusters » fournis (14 publics déjà définis par des règles sur les tags) ne sont que des raccourcis et des exemples : n’en utilisez un que s’il correspond exactement au public visé, seul ou combiné à d’autres tags ; sinon composez votre propre filtre à partir des tags. Dans « membershipGaps », indiquez UNIQUEMENT un attribut nécessaire pour définir le groupe nommé qu’AUCUN tag ni cluster fourni ne peut représenter (revenu, pension, vote passé, statut de sortant…) ; un attribut déjà couvert par une famille de tags (âge, foyer, statut matrimonial, densité…) n’est jamais une lacune, choisissez simplement la valeur voulue. Laissez ce champ vide si les tags suffisent. Placez les variables de résultat, mécanisme, exposition et enquête dans « measurementNeeds », jamais dans « membershipGaps ». N’utilisez pas de substitut approximatif pour une caractéristique absente.
SPÉCIFICITÉ À L’ÉVÉNEMENT : chaque segment doit être le public plausiblement le plus concerné par le mécanisme PROPRE de CET événement : qui constitue la base de la personne ou du candidat soutenu ou attaqué, qui est visé par la mesure ou la proposition, qui vit là où l’événement s’est produit. « mechanism » : une ou deux phrases qui citent NOMMÉMENT la personne, la mesure, le lieu ou le thème de l’événement (reprenez ses termes) et expliquent pourquoi CE public est concerné ; un mécanisme qui conviendrait à n’importe quel événement politique est insuffisant. N’utilisez PAS les archétypes génériques habituels (jeunes diplômés des villes, salariés modestes, jeunes sans activité, retraités peu diplômés) sauf si l’événement les concerne réellement. Préférez des intersections précises de tags (âge × occupation × densité, sexe × foyer, etc.) à un seul grand groupe. Incluez au moins un segment étroit (moins de 5 % de l’échantillon) lorsque l’événement le permet.
CONTRAINTES DE TAILLE vérifiées après coup : un segment doit compter au moins ${MIN_SEGMENT_SIZE} personnes, au plus ${MAX_SEGMENT_SHARE * 100} % de l’échantillon (« maxSegmentSize » personnes) et couvrir au moins ${MIN_COMMUNES} communes. Un segment trop large (un tag de profession ou d’âge seul, plusieurs unions) sera rejeté : combinez des tags pour le resserrer.
Proposez 3 ou 4 segments distincts, qui ne se recouvrent pas. N’affirmez aucune variation chiffrée du vote et ne traitez jamais les biographies synthétiques comme des données d’enquête humaine. Rédigez tous les champs en langage naturel en français.\n${EXAMPLES}`;

const REPAIR_SYSTEM = `${SYSTEM}
MISSION DE RÉPARATION : une première proposition a été partiellement rejetée. Vous recevez « rejected » (segments refusés, avec la raison précise : tag inconnu, tags en conflit, trop large avec son effectif, trop petit, doublon, générique…), « accepted » (segments déjà retenus : ne les répétez pas et évitez tout recouvrement) et « needed » (nombre de remplaçants à proposer). Proposez des segments de remplacement DIFFÉRENTS et plus étroits (trop large : ajoutez des tags d’intersection ; trop petit : retirez un tag ou prenez un cluster ; conflit : une seule valeur par famille dans « all »), toujours liés au mécanisme de l’événement. Utilisez uniquement les tags et clusters fournis.`;

type Evaluated = { segment: SegmentPreview; filter: RadarFilter | null; members: Int32Array; tooLarge?: boolean };

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
  for (const row of geographyData.records) departmentCodes.set(row.department.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim(), row.departmentCode);
  const matcher = await cachedMatcher();
  const maxSize = Math.floor(rows * MAX_SEGMENT_SHARE);
  const available = TAG_REGISTRY.map((tag) => ({ ...tag, count: coverage[tag.id] })).filter((tag) => tag.count > 0).sort((a, b) => b.count - a.count);
  const clusters = CLUSTERS.filter((cluster) => coverage[cluster.id] > 0).map(({ id, label, description }) => ({ id, label, description, count: coverage[id] }));
  const shared = { ontologyVersion: ONTOLOGY_VERSION, singleValuedFamilies: SINGLE_VALUED_FAMILIES, clusters, tagCoverage: available, sampleSize: rows, maxSegmentSize: maxSize, minSegmentSize: MIN_SEGMENT_SIZE };

  const blank = (proposal: SegmentProposal): SegmentPreview => ({
    ...proposal, place: { commune: "", department: "" }, counterfactual: templateScenario(event), id: "", count: 0, countIncludingNarrativeRules: 0, distinctCommunes: 0, samplePersonaIds: [], status: "insufficient_sample", resolvedPlace: null,
  });
  const placeOf = (segment: SegmentPreview): Place => segment.resolvedPlace;

  /** Normalise, validate and COG-resolve one proposal (no counting). */
  const prepare = (proposal: SegmentProposal): { segment: SegmentPreview; filter: RadarFilter | null } => {
    const segment = blank(proposal);
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
        const departmentKey = place.department.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
        const departmentCode = departmentCodes.get(departmentKey);
        if (!departmentCode) throw new Error(`Department not found in INSEE COG: ${place.department}`);
        const communeCode = place.commune ? resolveCommune(place.commune, place.department)?.communeCode : null;
        if (place.commune && !communeCode) throw new Error(`Commune/department not found unambiguously in INSEE COG: ${place.commune}, ${place.department}`);
        segment.resolvedPlace = { communeCode: communeCode ?? null, departmentCode };
      }
      return { segment, filter };
    } catch (error) {
      segment.status = "invalid_filter";
      segment.issue = error instanceof Error ? error.message : String(error);
      return { segment, filter: null };
    }
  };

  /** Count membership; set status/issue from the size, commune and membership constraints. */
  const measure = ({ segment, filter }: { segment: SegmentPreview; filter: RadarFilter | null }, candidates?: ArrayLike<number>): Evaluated => {
    if (!filter) return { segment, filter, members: new Int32Array() };
    const result = matcher.match(filter, placeOf(segment), candidates);
    segment.count = result.members.length;
    segment.countIncludingNarrativeRules = result.narrativeCount;
    segment.distinctCommunes = result.communes;
    segment.samplePersonaIds = [];
    for (const i of result.members.subarray(0, 3)) segment.samplePersonaIds.push(matcherPersonaId(i));
    const named = Boolean(segment.resolvedPlace?.communeCode);
    const minSize = named ? MIN_PLACE_SEGMENT_SIZE : MIN_SEGMENT_SIZE;
    const minCommunes = named ? 1 : MIN_COMMUNES;
    const evaluated: Evaluated = { segment, filter, members: result.members };
    if (segment.membershipGaps.length > 0 || (segment.count === 0 && segment.countIncludingNarrativeRules > 0)) {
      segment.status = "incomplete_membership";
      segment.issue = segment.membershipGaps.length ? `Attributs absents des tags : ${segment.membershipGaps.join(", ")}` : "Seuls des tags issus du récit (non audités) permettraient de former ce groupe";
    } else if (segment.count > maxSize) {
      segment.status = "invalid_filter"; evaluated.tooLarge = true;
      segment.issue = `Segment trop large : ${segment.count} profils (maximum ${maxSize}, soit ${MAX_SEGMENT_SHARE * 100} % de l’échantillon)`;
    } else if (segment.count < minSize || segment.distinctCommunes < minCommunes) {
      segment.status = "insufficient_sample";
      segment.issue = [segment.count < minSize && `${segment.count} profils (minimum ${minSize})`, segment.distinctCommunes < minCommunes && `${segment.distinctCommunes} communes (minimum ${minCommunes})`].filter(Boolean).join(" · ");
    } else segment.status = "filterable_discovery_sample";
    return evaluated;
  };
  const matcherPersonaId = (index: number) => personaList[index].id;
  const personaList = (await loadPersonas(personaPath())).personas;

  /** Event-specificity and duplicate checks on a segment that already passes the size rules. */
  const judge = (candidate: Evaluated, accepted: Evaluated[], opts: { specificity: boolean }) => {
    const { segment } = candidate;
    if (segment.status !== "filterable_discovery_sample") return;
    if (opts.specificity && lacksEventSpecificity(segment, event)) {
      segment.status = "invalid_filter";
      segment.issue = "Segment générique (archétype habituel) sans lien avec le mécanisme de l’événement";
      return;
    }
    const twin = accepted.find((other) => jaccard(other.members, candidate.members) > DUPLICATE_JACCARD);
    if (twin) {
      segment.status = "invalid_filter";
      segment.issue = `Doublon : même public que « ${twin.segment.name} » (recouvrement > ${DUPLICATE_JACCARD * 100} %)`;
    }
  };

  const accepted: Evaluated[] = [];
  const rejected: Evaluated[] = [];
  const consider = (proposals: SegmentProposal[]) => {
    for (const proposal of proposals) {
      const candidate = measure(prepare(proposal));
      judge(candidate, accepted, { specificity: true });
      if (candidate.segment.status === "filterable_discovery_sample") { if (accepted.length < 4) accepted.push(candidate); } else rejected.push(candidate);
    }
  };
  // The model only sees the title and description (no date, no URL): they would only invite recall of real-world outcomes.
  const user = (extra: object) => JSON.stringify({ event: { title: event.title, description: event.description }, ...shared, ...extra });

  const first = await callStructuredModel({ schema: eventMapSchema, schemaName: "radar_event_map_v2", stageName: "radar_event_map", system: SYSTEM, user: user({}) });
  consider(first.data.segments.slice(0, 5));

  for (let round = 1; round <= MAX_REPAIR_ROUNDS && accepted.length < TARGET_SEGMENTS; round++) {
    const needed = Math.min(4, TARGET_SEGMENTS + 1) - accepted.length;
    const repair = await callStructuredModel({
      schema: eventMapSchema, schemaName: "radar_event_map_repair_v1", stageName: "radar_event_map_repair", system: REPAIR_SYSTEM,
      user: user({
        needed,
        accepted: accepted.map(({ segment, members }) => ({ name: segment.name, all: segment.all, any: segment.any, none: segment.none, count: members.length })),
        rejected: rejected.slice(-6).map(({ segment }) => ({ name: segment.name, all: segment.all, any: segment.any, none: segment.none, count: segment.count, reason: segment.issue })),
      }),
    });
    consider(repair.data.segments.slice(0, 5));
  }

  // Deterministic fallback: relax rejected segments until at least MIN_USABLE_SEGMENTS pass.
  if (accepted.length < MIN_USABLE_SEGMENTS) {
    for (const origin of [...rejected]) {
      if (accepted.length >= MIN_USABLE_SEGMENTS) break;
      const { segment } = origin;
      if (segment.membershipGaps.length > 0) continue; // an absent attribute cannot be repaired by dropping tags
      const lists = { all: [...segment.all], any: [...segment.any], none: [...segment.none] } as RadarFilter;
      const unresolvedPlace = !origin.filter && Boolean(segment.place.department) && !segment.resolvedPlace;
      // Place options, most to least specific: the named commune, its department, then nowhere in particular.
      const placeOptions: { place: Place; note: string }[] = [{ place: unresolvedPlace ? null : segment.resolvedPlace, note: unresolvedPlace ? "lieu non résolu retiré" : "" }];
      if (segment.resolvedPlace?.communeCode) placeOptions.push({ place: { communeCode: null, departmentCode: segment.resolvedPlace.departmentCode }, note: `commune « ${segment.place.commune} » peu ou pas présente dans l’échantillon : périmètre élargi au département` });
      if (segment.resolvedPlace) placeOptions.push({ place: null, note: `lieu « ${segment.place.commune || segment.place.department} » peu ou pas présent dans l’échantillon : périmètre élargi à toute la France` });
      const tryCandidate = (filter: RadarFilter, note: string, option: { place: Place; note: string }, restrict?: ArrayLike<number>, clusterLabel?: string): Evaluated | null => {
        let valid: RadarFilter;
        try {
          const normalized = normalizeFilter(filter);
          if (normalized.error) return null;
          valid = validFilter({ ...segment, all: normalized.all, any: normalized.any, none: normalized.none } as SegmentProposal);
        } catch { return null; }
        const widened = option.place !== segment.resolvedPlace;
        const copy: SegmentPreview = {
          ...segment, ...valid, status: "insufficient_sample", issue: undefined, resolvedPlace: option.place,
          // The filter changed: the name/mechanism must not keep describing the original audience.
          ...(note ? clusterLabel
            ? { name: clusterLabel, mechanism: `Public nommé retenu par repli automatique, en lien avec l’événement : ${event.title}` }
            : { name: `${segment.name} (version élargie)` } : {}),
          ...(widened && segment.place.commune ? { name: `${segment.name.replace(new RegExp(`\\s*(?:à|de|autour d[’']?|près d[’']?)\\s*${segment.place.commune}\\b`, "i"), "")} (lieu « ${segment.place.commune} » absent de l’échantillon, périmètre élargi)` } : {}),
          place: option.place?.communeCode ? segment.place : option.place ? { commune: "", department: segment.place.department } : { commune: "", department: "" },
          repairs: [...(segment.repairs ?? []), `Segment initial rejeté (${segment.issue}) ; repli automatique : ${[note, widened || option.note ? option.note : ""].filter(Boolean).join(" ; ") || "aucun changement de filtre"}`],
        };
        const candidate = measure({ segment: copy, filter: valid }, restrict);
        judge(candidate, accepted, { specificity: false });
        return candidate.segment.status === "filterable_discovery_sample" ? candidate : null;
      };
      const steps: { filter: RadarFilter; note: string; clusterLabel?: string }[] = [];
      let found: Evaluated | null = null;
      if (origin.tooLarge) {
        const options = narrowings(lists).map((step) => tryCandidate(step.filter, step.note, placeOptions[0], origin.members)).filter((c): c is Evaluated => c !== null);
        found = options.sort((a, b) => b.members.length - a.members.length)[0] ?? null;
      } else steps.push({ filter: lists, note: "" });
      if (!found) for (const step of [...steps, ...relaxations(lists)]) {
        for (const option of placeOptions) { found = tryCandidate(step.filter, step.note, option, undefined, step.clusterLabel); if (found) break; }
        if (found) break;
      }
      if (found) accepted.push(found);
    }
  }

  // Unusable proposals are dropped; they are kept (for transparency) only when too few segments are usable.
  const kept = accepted.length >= MIN_USABLE_SEGMENTS ? accepted : [...accepted, ...rejected].slice(0, 4);
  const segments = kept.map(({ segment }, index) => ({ ...segment, id: `segment_${index + 1}` }));
    return {
    event, ontologyVersion: ONTOLOGY_VERSION, index: manifest,
    evidenceGrade: "hypothesis" as const,
    globalScenarios: [globalScenario(event)], segments,
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
