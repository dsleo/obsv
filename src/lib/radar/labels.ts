import needFr from "../../data/needLabels.json";
// Human-readable French for the dataset's technical tags ("age.18_24" -> "Âge : 18 à 24 ans").
const dimension: Record<string, string> = {
  age: "Âge", geo: "Territoire", household: "Foyer", cluster: "Profil", commune_size: "Taille de commune",
  education: "Diplôme", marital: "Situation", municipal_system: "Ville", occupation: "Activité", profession: "Métier", sex: "Sexe",
};
const value: Record<string, string> = {
  "age.18_24": "18 à 24 ans", "age.25_34": "25 à 34 ans", "age.35_49": "35 à 49 ans", "age.50_64": "50 à 64 ans", "age.65_74": "65 à 74 ans", "age.75_plus": "75 ans et plus",
  "geo.dense": "ville dense", "geo.intermediate": "ville moyenne", "geo.rural": "rural",
  "household.couple_no_children": "couple sans enfant", "household.couple_with_children": "couple avec enfants", "household.single": "personne seule", "household.single_parent": "famille monoparentale",
  "cluster.independent": "indépendant", "cluster.isolated_senior": "senior isolé", "cluster.modest_wage_earner": "salarié modeste", "cluster.older_farmer": "agriculteur âgé", "cluster.older_worker": "ouvrier âgé",
  "cluster.retired_couple": "couple de retraités", "cluster.retiree_no_diploma": "retraité sans diplôme", "cluster.rural_retiree": "retraité rural", "cluster.single_mother": "mère seule", "cluster.urban_executive": "cadre urbain",
  "cluster.young_family": "jeune famille", "cluster.young_farmer": "jeune agriculteur", "cluster.young_urban_graduate": "jeune diplômé urbain", "cluster.young_without_activity": "jeune sans activité",
  "commune_size.1000_plus": "1 000 habitants et plus", "commune_size.under_1000": "moins de 1 000 habitants",
  "education.bac_plus_2": "bac +2", "education.bac_plus_3_4": "bac +3 / +4", "education.bac_plus_5_plus": "bac +5 et plus", "education.baccalaureate": "baccalauréat", "education.no_diploma": "sans diplôme",
  "marital.cohabiting": "en concubinage", "municipal_system.paris_lyon_marseille": "Paris, Lyon ou Marseille",
  "occupation.artisan_merchant_owner": "artisan, commerçant, chef d’entreprise", "occupation.employee": "employé", "occupation.executive_professional": "cadre ou profession libérale", "occupation.farmer": "agriculteur",
  "occupation.intermediate": "profession intermédiaire", "occupation.other_inactive": "sans activité", "occupation.retired": "retraité", "occupation.worker": "ouvrier",
  "profession.teacher": "enseignant", "sex.female": "femme", "sex.male": "homme",
};
const sentence = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** "age.18_24" -> "Âge : 18 à 24 ans". Unknown tags fall back to a readable sentence, never the raw key. */
export function tagLabel(tag: string) {
  const [dim] = tag.split(".");
  return `${dimension[dim] ?? sentence(dim)} : ${value[tag] ?? sentence(tag.split(".").slice(1).join(" "))}`;
}

/** Measurement needs: French label from the lookup (older analyses carry English snake_case keys), else a readable sentence. */
export const needLabel = (need: string) => (needFr as Record<string, string>)[need] ?? sentence(need);

/** Share of sampled profiles, as a whole percentage. */
export const pct = (count: number, sampled: number) => (sampled ? `${Math.round((100 * count) / sampled)} %` : "—");

/** Article titles from Google clusters can be several concatenated headlines: keep the first, capped. */
export function shortTitle(title: string, max = 140) {
  const t = title.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** Keeps articles mentioning the proper nouns (up to two) of the event title (Google clusters mix in other trials). No proper noun -> keep all. */
export function relatedArticles<T extends { title: string }>(articles: T[], eventTitle: string): T[] {
  const names = [...eventTitle.matchAll(/\p{Lu}[\p{L}'’-]{3,}/gu)].map((m) => fold(m[0]));
  if (!names.length) return articles;
  const need = Math.min(2, names.length); // "Michel Zecler": both words, else any Michel matches
  const kept = articles.filter((a) => names.filter((n) => fold(a.title).includes(n)).length >= need);
  return kept.length ? kept : articles;
}

/** Distinct URLs, ordered so each outlet appears once before any outlet repeats (diversity of media first, original order within). */
export function diverseArticles<T extends { url: string; publisher: string }>(articles: T[]): T[] {
  const seen = new Set<string>(), rounds: T[][] = [], count = new Map<string, number>();
  for (const a of articles) {
    if (seen.has(a.url)) continue;
    seen.add(a.url);
    const key = a.publisher.toLowerCase() || a.url, n = count.get(key) ?? 0;
    count.set(key, n + 1);
    (rounds[n] ??= []).push(a);
  }
  return rounds.flat();
}

const blocFor: Record<string, string> = { radical_left: "la gauche radicale", left: "la gauche", center: "le centre", right: "la droite", far_right: "l’extrême droite" };
/** Predicate completing "21 % … " for the group's profiles; the comparison (vs a world without the event) is stated once next to the list. */
export function reactionText(bloc: string, direction: "toward" | "away") {
  const more = direction === "toward";
  if (bloc === "abstention") return `plus enclins à s’abstenir`.replace("plus", more ? "plus" : "moins");
  return `${more ? "plus" : "moins"} enclins à voter pour ${blocFor[bloc] ?? bloc}`;
}
