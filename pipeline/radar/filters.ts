// Deterministic repairs of LLM-proposed segment filters. Pure: no I/O, no model.
export const SINGLE_VALUED_FAMILIES = ["age", "sex", "education", "occupation", "household", "marital", "geo", "commune_size"] as const;

type FilterLists = { all: string[]; any: string[]; none: string[] };
export type NormalizedFilter = FilterLists & { repairs: string[]; error?: string };

const family = (id: string) => id.split(".")[0];
const isSingleValued = (id: string) => (SINGLE_VALUED_FAMILIES as readonly string[]).includes(family(id));

/**
 * A person has ONE value per single-valued family, so two such tags in `all` can never match:
 * the model meant a union. Move that family's tags into `any`. `any` is one OR-list, so this is only
 * possible when nothing else lives in it; otherwise we report an error rather than change the meaning.
 */
export function normalizeFilter(input: FilterLists): NormalizedFilter {
  const distinct = new Map<string, Set<string>>();
  for (const id of [...input.all, ...input.any]) {
    if (!isSingleValued(id)) continue;
    const set = distinct.get(family(id)) ?? new Set<string>();
    set.add(id);
    distinct.set(family(id), set);
  }
  // An all-less union inside `any` is already valid; only a family present in `all` needs repair.
  const unions = [...distinct].filter(([name, ids]) => ids.size > 1 && input.all.some((id) => family(id) === name));
  if (unions.length === 0) return { ...input, repairs: [] };
  if (unions.length > 1) {
    return { ...input, repairs: [], error: `Several unions needed (${unions.map(([name]) => name).join(", ")}) but a filter has a single « any » list` };
  }
  const [[name, ids]] = unions;
  const foreign = input.any.filter((id) => family(id) !== name);
  if (foreign.length) {
    return { ...input, repairs: [], error: `Union of ${name} tags cannot be combined with another « any » list (${foreign.join(", ")}); use a cluster or split the segment` };
  }
  const union = [...ids];
  return {
    all: input.all.filter((id) => family(id) !== name),
    any: union,
    none: input.none,
    repairs: [`${name} : ${union.join(" ou ")} regroupés en union (« any ») ; une personne n’a qu’une seule valeur de ${name}`],
  };
}

const ascii = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Attributes the ontology already represents (tag families, Paris/Lyon/Marseille).
const PRESENT = /\bages?\b|tranche d.age|\bsexe\b|\bgenre\b|\bgender\b|education|diplome|niveau d.etude|scolarite|\boccupation\b|categorie socio|\bcsp\b|socio.?professionnel|household|foyer|menage|composition familiale|type de famille|situation familiale|\benfants?\b|marital|matrimonial|etat civil|statut conjugal|densite|density|\bgeo|urbain|rural|\bzone|classe geographique|type de commune|taille de (?:la )?commune|commune size|habitants|paris|lyon|marseille|metropole/;
// Attributes the ontology does NOT represent: a gap mentioning one is genuine even next to a present one.
const ABSENT = /revenu|income|salaire|pension|patrimoine|niveau de vie|parti|vote|electoral|syndic|religi|nationalite|origine|immigr|handicap|sante|logement|locataire|proprietaire|chomeur|chomage|sortant|incumbent|beneficiaire|affiliation|orientation|opinion|profession exacte|metier/;

/** Drop gaps that only name attributes the ontology already has; keep the rest. */
export function pruneSpuriousGaps(gaps: string[]): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const gap of gaps) {
    const text = ascii(gap);
    (PRESENT.test(text) && !ABSENT.test(text) ? dropped : kept).push(gap);
  }
  return { kept, dropped };
}

// Outcome/mechanism variables are things to measure on a group, not attributes needed to define who belongs to it.
const MEASUREMENT = /attitude|perception|sentiment|exposition|reaction|reponse a|intention de|comportement|confiance|satisfaction|vis.a.vis|position (?:face|envers)/;

/** Split gaps into real membership gaps and outcome variables that belong in measurementNeeds. */
export function splitMeasurementGaps(gaps: string[]): { gaps: string[]; measurement: string[] } {
  const result = { gaps: [] as string[], measurement: [] as string[] };
  for (const gap of gaps) (MEASUREMENT.test(ascii(gap)) && !ABSENT_MEMBERSHIP.test(ascii(gap)) ? result.measurement : result.gaps).push(gap);
  return result;
}
// A gap that also names a genuinely absent membership attribute stays a gap.
const ABSENT_MEMBERSHIP = /revenu|income|salaire|pension|patrimoine|niveau de vie|syndic|religi|nationalite|origine|immigr|handicap|logement|locataire|proprietaire|chomeur|chomage|sortant|incumbent|beneficiaire|affiliation|profession exacte|metier/;
