import { z } from "zod";

// Only these versioned, inspectable concepts may appear in an event filter.
// Commune and department codes are data values, resolved against COG separately.
export const ONTOLOGY_VERSION = "fr-electorate-5";
export const TAG_IDS = [
  "age.18_24", "age.25_34", "age.35_49", "age.50_64", "age.65_74", "age.75_plus",
  "sex.female", "sex.male",
  "education.no_diploma", "education.brevet", "education.cap_bep", "education.baccalaureate",
  "education.bac_plus_2", "education.bac_plus_3_4", "education.bac_plus_5_plus",
  "occupation.farmer", "occupation.artisan_merchant_owner", "occupation.executive_professional",
  "occupation.intermediate", "occupation.employee", "occupation.worker", "occupation.retired",
  "occupation.other_inactive",
  "household.single", "household.couple_no_children", "household.couple_with_children",
  "household.single_parent", "household.other",
  "marital.single", "marital.married", "marital.civil_union", "marital.cohabiting", "marital.divorced", "marital.widowed",
  "geo.dense", "geo.intermediate", "geo.rural",
  "commune_size.under_1000", "commune_size.1000_plus", "municipal_system.paris_lyon_marseille",
  "profession.teacher", "profession.university_professor", "profession.health",
  "profession.legal", "profession.engineer", "profession.farmer", "profession.artisan",
  "profession.liberal_explicit",
  "former_profession.teacher", "former_profession.university_professor",
  "former_profession.health", "former_profession.legal", "former_profession.engineer",
  "cluster.young_farmer", "cluster.older_farmer", "cluster.rural_retiree", "cluster.retiree_no_diploma",
  "cluster.isolated_senior", "cluster.retired_couple", "cluster.young_urban_graduate",
  "cluster.young_without_activity", "cluster.young_family", "cluster.single_mother",
  "cluster.modest_wage_earner", "cluster.older_worker", "cluster.urban_executive", "cluster.independent",
] as const;

// Named, reusable audiences. Each is a deterministic rule over base tags (never narrative_rule tags),
// stored as a tag at index time so an event segment can simply ask for `cluster.young_farmer`.
export type ClusterDefinition = { id: string; label: string; description: string; all: string[]; anyGroups: string[][]; none: string[] };
export const CLUSTERS: ClusterDefinition[] = [
  { id: "cluster.young_farmer", label: "Jeunes agriculteurs", description: "Agriculteurs exploitants de moins de 35 ans", all: ["occupation.farmer"], anyGroups: [["age.18_24", "age.25_34"]], none: [] },
  { id: "cluster.older_farmer", label: "Agriculteurs de 50 ans et plus", description: "Agriculteurs exploitants de 50 ans et plus, proches de la retraite", all: ["occupation.farmer"], anyGroups: [["age.50_64", "age.65_74", "age.75_plus"]], none: [] },
  { id: "cluster.rural_retiree", label: "Retraités ruraux", description: "Retraités vivant dans une commune rurale", all: ["occupation.retired", "geo.rural"], anyGroups: [], none: [] },
  { id: "cluster.retiree_no_diploma", label: "Retraités peu diplômés", description: "Retraités sans diplôme ou au plus brevet : approximation, pas un niveau de pension", all: ["occupation.retired"], anyGroups: [["education.no_diploma", "education.brevet"]], none: [] },
  { id: "cluster.isolated_senior", label: "Seniors vivant seuls", description: "Personnes de 75 ans et plus vivant seules", all: ["household.single", "age.75_plus"], anyGroups: [], none: [] },
  { id: "cluster.retired_couple", label: "Couples de retraités", description: "Retraités en couple sans enfant au foyer", all: ["occupation.retired", "household.couple_no_children"], anyGroups: [], none: [] },
  { id: "cluster.young_urban_graduate", label: "Jeunes diplômés des villes", description: "Moins de 35 ans, bac+3 ou plus, commune dense", all: ["geo.dense"], anyGroups: [["age.18_24", "age.25_34"], ["education.bac_plus_3_4", "education.bac_plus_5_plus"]], none: [] },
  { id: "cluster.young_without_activity", label: "Jeunes sans activité professionnelle", description: "18-24 ans classés « autres sans activité professionnelle » (étudiants, chômeurs, inactifs)", all: ["age.18_24", "occupation.other_inactive"], anyGroups: [], none: [] },
  { id: "cluster.young_family", label: "Jeunes familles", description: "Couples avec enfants de 25 à 49 ans", all: ["household.couple_with_children"], anyGroups: [["age.25_34", "age.35_49"]], none: [] },
  { id: "cluster.single_mother", label: "Mères seules", description: "Femmes en famille monoparentale", all: ["household.single_parent", "sex.female"], anyGroups: [], none: [] },
  { id: "cluster.modest_wage_earner", label: "Salariés modestes", description: "Employés et ouvriers", all: [], anyGroups: [["occupation.employee", "occupation.worker"]], none: [] },
  { id: "cluster.older_worker", label: "Ouvriers de 50 à 64 ans", description: "Ouvriers de 50 à 64 ans, exposés aux réformes des retraites", all: ["occupation.worker", "age.50_64"], anyGroups: [], none: [] },
  { id: "cluster.urban_executive", label: "Cadres urbains", description: "Cadres et professions intellectuelles supérieures en commune dense", all: ["occupation.executive_professional", "geo.dense"], anyGroups: [], none: [] },
  { id: "cluster.independent", label: "Indépendants", description: "Artisans, commerçants et chefs d’entreprise", all: ["occupation.artisan_merchant_owner"], anyGroups: [], none: [] },
];

export const tagIdSchema = z.enum(TAG_IDS);
export type TagId = z.infer<typeof tagIdSchema>;
export type TagSource = "direct" | "derived" | "official_geo" | "narrative_rule" | "audited_narrative";
export type TaggedValue = { id: TagId; source: TagSource; field: string; ruleVersion: string; evidence?: string; reviewer?: string; reviewedAt?: string };

const FAMILY_DEFINITIONS: Record<string, { definition: string; source: TagSource }> = {
  age: { definition: "Adult age at the Nemotron dataset snapshot; not historical election age", source: "derived" },
  sex: { definition: "Recorded Nemotron sex field", source: "direct" },
  education: { definition: "Grouped Nemotron education level", source: "derived" },
  occupation: { definition: "Grouped Nemotron broad socio-professional category", source: "derived" },
  household: { definition: "Grouped Nemotron household type", source: "derived" },
  marital: { definition: "Grouped Nemotron marital status", source: "derived" },
  geo: { definition: "INSEE commune density class", source: "official_geo" },
  commune_size: { definition: "INSEE municipal population 2023 for current commune geography", source: "official_geo" },
  municipal_system: { definition: "INSEE COG Paris/Lyon/Marseille commune or arrondissement", source: "official_geo" },
  cluster: { definition: "Named audience defined by a deterministic rule over base tags (see CLUSTERS)", source: "derived" },
  profession: { definition: "Explicit specific current profession in synthetic professional narrative; unaudited", source: "narrative_rule" },
  former_profession: { definition: "Explicit former profession in synthetic professional narrative; unaudited", source: "narrative_rule" },
};

export const TAG_REGISTRY = TAG_IDS.map((id) => ({
  id,
  family: id.split(".")[0],
  definition: FAMILY_DEFINITIONS[id.split(".")[0]].definition,
  source: FAMILY_DEFINITIONS[id.split(".")[0]].source,
}));

export const filterSchema = z.object({
  all: z.array(tagIdSchema).max(6),
  any: z.array(tagIdSchema).max(6),
  none: z.array(tagIdSchema).max(6),
}).strict().refine((filter) => filter.all.length + filter.any.length > 0, "At least one positive tag is required");
export type RadarFilter = z.infer<typeof filterSchema>;

export type GeoRecord = { communeCode: string; departmentCode: string; density: "dense" | "intermediate" | "rural" | null; sourceYear: number; population2023?: number | null; parentCommuneCode?: string | null };
export type HistoricalContext = {
  electionId: string; scope: "observed_commune_context" | "observed_parent_commune_context"; communeCode: string; registered: number;
  abstentionShare: number; blankNullShare: number; voteVectorEligible: boolean;
  choices: Array<{ id: string; label: string; officialNuance: string | null; votes: number; shareOfRegistered: number }>;
};
export type HistoricalPropensity = {
  electionId: "2022_pres_t1"; scope: "survey_model_national_calibrated";
  modelVersion: string; surveySource: string; pilotHeldoutGainPositive: boolean;
  probabilities: Record<string, number>;
  choiceLabels: Record<string, string>;
};
export type RadarPersona = {
  id: string;
  sourceRowId: string;
  age: number;
  sex: string;
  education: string;
  occupation: string;
  household: string;
  maritalStatus: string;
  commune: string;
  department: string;
  profileNarrative: string;
  professionalNarrative: string;
  tags: TaggedValue[];
  missingFamilies: string[];
  geography: GeoRecord | null;
  historicalContext?: HistoricalContext[];
  historicalPropensity?: HistoricalPropensity;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ascii(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tagFromEducation(value: string): TagId | null {
  const v = ascii(value);
  if (/sans diplome|aucun diplome|certificat d.etudes/.test(v)) return "education.no_diploma";
  if (/^brevet|brevet des colleges/.test(v)) return "education.brevet";
  if (/cap|bep/.test(v)) return "education.cap_bep";
  if (/bac\s*\+\s*[5-9]|master|doctorat|grande ecole/.test(v)) return "education.bac_plus_5_plus";
  if (/bac\s*\+\s*[34]|licence/.test(v)) return "education.bac_plus_3_4";
  if (/bac\s*\+\s*2|bts|dut/.test(v)) return "education.bac_plus_2";
  if (/baccalaureat|\bbac\b/.test(v)) return "education.baccalaureate";
  return null;
}

function tagFromOccupation(value: string): TagId | null {
  const v = ascii(value);
  if (/agriculteur|exploitant agricole/.test(v)) return "occupation.farmer";
  if (/artisan|commercant|chef d.entreprise/.test(v)) return "occupation.artisan_merchant_owner";
  if (/cadre|profession intellectuelle superieure/.test(v)) return "occupation.executive_professional";
  if (/professions? intermediaires?/.test(v)) return "occupation.intermediate";
  if (/employe/.test(v)) return "occupation.employee";
  if (/ouvrier/.test(v)) return "occupation.worker";
  if (/retraite/.test(v)) return "occupation.retired";
  if (/sans activite professionnelle/.test(v)) return "occupation.other_inactive";
  return null;
}

function tagFromHousehold(value: string): TagId | null {
  const v = ascii(value);
  if (/monoparent/.test(v)) return "household.single_parent";
  if (/couple.*sans enfant/.test(v)) return "household.couple_no_children";
  if (/couple.*enfant/.test(v)) return "household.couple_with_children";
  if (/seul|single|personne seule/.test(v)) return "household.single";
  return v ? "household.other" : null;
}

function tagFromMarital(value: string): TagId | null {
  const v = ascii(value);
  if (/celibataire/.test(v)) return "marital.single";
  if (/pacs/.test(v)) return "marital.civil_union";
  if (/concubinage|union libre/.test(v)) return "marital.cohabiting";
  if (/marie/.test(v)) return "marital.married";
  if (/divorce/.test(v)) return "marital.divorced";
  if (/veuf|veuve/.test(v)) return "marital.widowed";
  return null;
}

// High-precision explicit mentions only. These are generated biographies, so
// narrative-derived tags need a separate human audit before quantitative use.
const PROFESSIONS: Array<{ pattern: RegExp; current: TagId; former?: TagId }> = [
  { pattern: /\bprofesseur(?:e)? (?:d['’]universite|universitaire|des universites)\b/i, current: "profession.university_professor", former: "former_profession.university_professor" },
  { pattern: /\b(?:professeur|enseignant|instituteur|institutrice)\b/i, current: "profession.teacher", former: "former_profession.teacher" },
  { pattern: /\b(?:medecin|infirmier|infirmiere|pharmacien)\b/i, current: "profession.health", former: "former_profession.health" },
  { pattern: /\b(?:avocat|notaire|magistrat)\b/i, current: "profession.legal", former: "former_profession.legal" },
  { pattern: /\bingenieur\b/i, current: "profession.engineer", former: "former_profession.engineer" },
  { pattern: /\b(?:agriculteur|agricultrice)\b/i, current: "profession.farmer" },
  { pattern: /\bartisan\b/i, current: "profession.artisan" },
  { pattern: /\bprofession liberale\b/i, current: "profession.liberal_explicit" },
];

export function enrichNemotronRow(row: Record<string, unknown>, geography: GeoRecord | null = null): RadarPersona {
  const sourceRowId = clean(row.uuid);
  const age = Number(row.age);
  if (!sourceRowId || !Number.isInteger(age) || age < 18 || age > 110) throw new Error("Nemotron row lacks a valid ID or adult age");
  const occupation = clean(row.occupation);
  const professionalNarrative = clean(row.professional_persona);
  const tags: TaggedValue[] = [];
  const add = (id: TagId | null, source: TagSource, field: string, evidence?: string) => {
    if (id && !tags.some((tag) => tag.id === id)) tags.push({ id, source, field, ruleVersion: ONTOLOGY_VERSION, ...(evidence ? { evidence } : {}) });
  };
  const ageTag: TagId = age < 25 ? "age.18_24" : age < 35 ? "age.25_34" : age < 50 ? "age.35_49" : age < 65 ? "age.50_64" : age < 75 ? "age.65_74" : "age.75_plus";
  add(ageTag, "derived", "age");
  const sex = clean(row.sex);
  if (ascii(sex) === "femme") add("sex.female", "direct", "sex");
  if (ascii(sex) === "homme") add("sex.male", "direct", "sex");
  const education = clean(row.education_level);
  add(tagFromEducation(education), "derived", "education_level");
  add(tagFromOccupation(occupation), "derived", "occupation");
  const household = clean(row.household_type);
  add(tagFromHousehold(household), "derived", "household_type");
  const maritalStatus = clean(row.marital_status);
  add(tagFromMarital(maritalStatus), "derived", "marital_status");
  if (geography?.density) add(`geo.${geography.density}` as TagId, "official_geo", `INSEE density ${geography.sourceYear}`);
  if (geography?.population2023 != null) add(geography.population2023 < 1000 ? "commune_size.under_1000" : "commune_size.1000_plus", "official_geo", "INSEE municipal population 2023");
  if (geography && [geography.communeCode, geography.parentCommuneCode].some((code) => code && ["75056", "69123", "13055"].includes(code))) {
    add("municipal_system.paris_lyon_marseille", "official_geo", "INSEE COG 2026 commune/arrondissement");
  }
  const base = new Set(tags.map((tag) => tag.id as string));
  for (const cluster of CLUSTERS) {
    if (cluster.all.every((id) => base.has(id)) && cluster.anyGroups.every((group) => group.some((id) => base.has(id))) && cluster.none.every((id) => !base.has(id))) {
      add(cluster.id as TagId, "derived", "cluster", cluster.description);
    }
  }
  const normalizedNarrative = ascii(professionalNarrative);
  const retired = tags.some((tag) => tag.id === "occupation.retired");
  for (const entry of PROFESSIONS) {
    const match = normalizedNarrative.match(entry.pattern);
    if (!match) continue;
    const former = retired && /\b(?:ancien|ancienne|ex[- ]|retraite|a exerce|a enseigne)\b/.test(normalizedNarrative);
    if (retired && !former) continue;
    add(former ? entry.former ?? null : entry.current, "narrative_rule", "professional_persona", match[0]);
  }
  return {
    id: `nemotron-${sourceRowId}`, sourceRowId, age, sex, education, occupation, household, maritalStatus,
    commune: clean(row.commune), department: clean(row.departement), professionalNarrative,
    profileNarrative: clean(row.persona),
    tags,
    missingFamilies: ["sex", "education", "occupation", "household", "marital", "geo", "commune_size"]
      .filter((family) => !tags.some((tag) => tag.id.startsWith(`${family}.`))),
    geography,
  };
}

export function matchesFilter(persona: RadarPersona, input: RadarFilter, allowedSources: readonly TagSource[] = ["direct", "derived", "official_geo", "audited_narrative"]): boolean {
  const filter = filterSchema.parse(input);
  const present = new Set(persona.tags.filter((tag) => allowedSources.includes(tag.source)).map((tag) => tag.id));
  const familyObserved = (id: TagId) => id.startsWith("cluster.") ? true
    : id === "municipal_system.paris_lyon_marseille"
    ? persona.geography !== null
    : [...present].some((tag) => tag.split(".")[0] === id.split(".")[0]);
  return filter.all.every((id) => present.has(id)) &&
    (filter.any.length === 0 || filter.any.some((id) => present.has(id))) &&
    filter.none.every((id) => familyObserved(id) && !present.has(id));
}
