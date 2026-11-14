/**
 * Two-level hierarchy over the free-form, per-event subgroups.
 * Segment names are invented per event; the ontology tags (all/any) are closed and stable,
 * so the family is derived from the tags, never from the name. Level 1 = one family per segment
 * (first matching rule wins), level 2 = a refinement inside it.
 */
export type FilterTags = { all: readonly string[]; any: readonly string[] };
export type GroupFamily = { l1: string; l2: string };

export const L1_ORDER = [
  "Jeunes",
  "Parents et familles",
  "Ouvriers et employés",
  "Cadres et professions intermédiaires",
  "Indépendants et agriculteurs",
  "Retraités et seniors",
  "Autres profils",
] as const; // "Territoires" is still derived by groupFamily but not displayed

export function groupFamily({ all, any }: FilterTags): GroupFamily {
  const tags = new Set([...all, ...any]);
  const has = (...ids: string[]) => ids.some((id) => tags.has(id));
  const sub = (prefix: string) => [...tags].filter((t) => t.startsWith(`${prefix}.`)).map((t) => t.slice(prefix.length + 1));
  const ages = sub("age");
  const young = ages.length > 0 && ages.every((a) => a === "18_24" || a === "25_34");
  const old = ages.length > 0 && ages.every((a) => a === "65_74" || a === "75_plus");
  const rural = has("geo.rural");
  const dense = has("geo.dense");
  const worker = has("occupation.worker");
  const employee = has("occupation.employee");
  const higherEd = has("education.bac_plus_3_4", "education.bac_plus_5_plus");

  if (young || (!ages.length && has("cluster.young_without_activity", "cluster.young_urban_graduate", "cluster.young_farmer"))) {
    const l2 = has("cluster.young_without_activity", "occupation.other_inactive") ? "Sans activité"
      : has("cluster.young_urban_graduate") || higherEd ? "Diplômés"
      : worker || employee ? "Salariés"
      : has("household.couple_with_children", "household.single_parent") ? "Jeunes parents"
      : has("occupation.farmer", "cluster.young_farmer") ? "Agriculteurs"
      : rural ? "Ruraux"
      : dense ? "Urbains"
      : "Ensemble des jeunes";
    return { l1: "Jeunes", l2 };
  }
  if (has("occupation.retired", "cluster.rural_retiree", "cluster.retiree_no_diploma", "cluster.isolated_senior", "cluster.retired_couple") || old) {
    const l2 = has("cluster.isolated_senior", "household.single") ? "Seniors isolés"
      : has("cluster.retired_couple") ? "Couples de retraités"
      : rural ? "Retraités ruraux"
      : has("cluster.retiree_no_diploma", "education.no_diploma", "education.brevet") ? "Retraités peu diplômés"
      : dense ? "Retraités urbains"
      : "Retraités";
    return { l1: "Retraités et seniors", l2 };
  }
  if (worker || employee || has("cluster.modest_wage_earner", "cluster.older_worker")) {
    const l2 = worker && !employee ? "Ouvriers" : employee && !worker ? "Employés" : "Employés et ouvriers";
    return { l1: "Ouvriers et employés", l2 };
  }
  if (has("occupation.executive_professional", "occupation.intermediate", "cluster.urban_executive") || sub("profession").length || sub("former_profession").length) {
    const l2 = has("profession.teacher", "profession.university_professor", "former_profession.teacher", "former_profession.university_professor") ? "Enseignants"
      : has("profession.health", "former_profession.health") ? "Santé"
      : has("profession.legal", "profession.engineer", "profession.liberal_explicit", "former_profession.legal", "former_profession.engineer") ? "Professions libérales et ingénieurs"
      : has("occupation.intermediate") && !has("occupation.executive_professional", "cluster.urban_executive") ? "Professions intermédiaires"
      : "Cadres";
    return { l1: "Cadres et professions intermédiaires", l2 };
  }
  if (has("occupation.artisan_merchant_owner", "occupation.farmer", "cluster.independent", "cluster.older_farmer", "profession.farmer", "profession.artisan")) {
    return { l1: "Indépendants et agriculteurs", l2: has("occupation.farmer", "cluster.older_farmer", "profession.farmer") ? "Agriculteurs" : "Artisans et commerçants" };
  }
  if (has("household.couple_with_children", "household.single_parent", "cluster.young_family", "cluster.single_mother")) {
    return { l1: "Parents et familles", l2: has("household.single_parent", "cluster.single_mother") ? "Familles monoparentales" : "Couples avec enfants" };
  }
  if (higherEd) return { l1: "Cadres et professions intermédiaires", l2: "Diplômés" };
  if (has("geo.rural", "geo.dense", "geo.intermediate", "commune_size.under_1000", "commune_size.1000_plus", "municipal_system.paris_lyon_marseille")) {
    const l2 = has("municipal_system.paris_lyon_marseille") ? "Paris, Lyon, Marseille"
      : rural || has("commune_size.under_1000") ? "Communes rurales"
      : dense ? "Communes denses"
      : "Communes intermédiaires";
    return { l1: "Territoires", l2 };
  }
  return { l1: "Autres profils", l2: "Autres profils" };
}
