import { z } from "zod";

// Only these versioned, inspectable concepts may appear in an event filter.
// Commune and department codes are data values, resolved against COG separately.
export const ONTOLOGY_VERSION = "fr-electorate-4";
export const TAG_IDS = [
  "age.18_24", "age.25_34", "age.35_49", "age.50_64", "age.65_74", "age.75_plus",
  "sex.female", "sex.male",
  "education.no_diploma", "education.cap_bep", "education.baccalaureate",
  "education.bac_plus_2", "education.bac_plus_3_4", "education.bac_plus_5_plus",
  "occupation.farmer", "occupation.artisan_merchant_owner", "occupation.executive_professional",
  "occupation.intermediate", "occupation.employee", "occupation.worker", "occupation.retired",
  "occupation.other_inactive",
  "household.single", "household.couple_no_children", "household.couple_with_children",
  "household.single_parent", "household.other",
  "marital.single", "marital.married", "marital.civil_union", "marital.divorced", "marital.widowed",
  "geo.dense", "geo.intermediate", "geo.rural",
  "commune_size.under_1000", "commune_size.1000_plus", "municipal_system.paris_lyon_marseille",
  "profession.teacher", "profession.university_professor", "profession.health",
  "profession.legal", "profession.engineer", "profession.farmer", "profession.artisan",
  "profession.liberal_explicit",
  "former_profession.teacher", "former_profession.university_professor",
  "former_profession.health", "former_profession.legal", "former_profession.engineer",
] as const;

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
  if (/sans dipl[oô]me|aucun dipl[oô]me|brevet des coll[eè]ges/.test(v)) return "education.no_diploma";
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
  if (/profession intermediaire/.test(v)) return "occupation.intermediate";
  if (/employe/.test(v)) return "occupation.employee";
  if (/ouvrier/.test(v)) return "occupation.worker";
  if (/retraite/.test(v)) return "occupation.retired";
  if (/sans activite professionnelle/.test(v)) return "occupation.other_inactive";
  return null;
}

function tagFromHousehold(value: string): TagId | null {
  const v = ascii(value);
  if (/monoparent/.test(v)) return "household.single_parent";
  if (/couple.*enfant/.test(v)) return "household.couple_with_children";
  if (/couple.*sans enfant/.test(v)) return "household.couple_no_children";
  if (/seul|single|personne seule/.test(v)) return "household.single";
  return v ? "household.other" : null;
}

function tagFromMarital(value: string): TagId | null {
  const v = ascii(value);
  if (/celibataire/.test(v)) return "marital.single";
  if (/pacs/.test(v)) return "marital.civil_union";
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
  const familyObserved = (id: TagId) => id === "municipal_system.paris_lyon_marseille"
    ? persona.geography !== null
    : [...present].some((tag) => tag.split(".")[0] === id.split(".")[0]);
  return filter.all.every((id) => present.has(id)) &&
    (filter.any.length === 0 || filter.any.some((id) => present.has(id))) &&
    filter.none.every((id) => familyObserved(id) && !present.has(id));
}
