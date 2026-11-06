import snapshot from "../../data/generated/snapshot.json";

// Set by next.config.ts from the GitHub Pages project path (empty at the site root).
const SITE_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Real first-round polls from the validated snapshot (`npm run data:collect && npm run data:prepare`).
const firstRoundPolls = snapshot.polls.filter((poll) => poll.round === "first");
const fieldworkEnds = firstRoundPolls.map((poll) => poll.fieldworkEnd).sort();
export const POLL_START = fieldworkEnds[0] ?? "2026-02-27";
export const POLL_END = fieldworkEnds[fieldworkEnds.length - 1] ?? POLL_START;
export const POLL_DAYS = Math.round((Date.parse(POLL_END) - Date.parse(POLL_START)) / 86_400_000);

const MONTHS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];
const dayMs = 86_400_000;

/** Days elapsed since POLL_START for an ISO date (YYYY-MM-DD). */
export const dayOffset = (iso: string) => Math.round((Date.parse(iso) - Date.parse(POLL_START)) / dayMs);
export const dayToIso = (day: number) => new Date(Date.parse(POLL_START) + day * dayMs).toISOString().slice(0, 10);
export function formatShortDate(iso: string) {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}
export const pollWindowLabel = `${formatShortDate(POLL_START)} — ${formatShortDate(POLL_END)} ${POLL_END.slice(0, 4)}`;

// Candidates with first-round polls in the retained scenario (see data/candidates.json, the validator's allow-list).
// Bardella was the RN line until June 2026, Le Pen from July: the two are never tested in the same poll.
export const pollCandidates = [
  { id: "le-pen", name: "Marine Le Pen", short: "Le Pen", party: "RN", color: "#2b5a8c" },
  { id: "bardella", name: "Jordan Bardella", short: "Bardella", party: "RN", color: "#6f9bc7" },
  { id: "philippe", name: "Édouard Philippe", short: "Philippe", party: "Horizons", color: "#577572" },
  { id: "attal", name: "Gabriel Attal", short: "Attal", party: "Renaissance", color: "#e08a3c" },
  { id: "glucksmann", name: "Raphaël Glucksmann", short: "Glucksmann", party: "Place publique", color: "#8e7b5e" },
  { id: "melenchon", name: "Jean-Luc Mélenchon", short: "Mélenchon", party: "LFI", color: "#a95a56" },
  { id: "tondelier", name: "Marine Tondelier", short: "Tondelier", party: "Les Écologistes", color: "#6aa36b" },
  { id: "roussel", name: "Fabien Roussel", short: "Roussel", party: "PCF", color: "#c0392b" },
  { id: "retailleau", name: "Bruno Retailleau", short: "Retailleau", party: "LR", color: "#9c8d6a" },
  { id: "lisnard", name: "David Lisnard", short: "Lisnard", party: "LR", color: "#c9b458" },
  { id: "zemmour", name: "Éric Zemmour", short: "Zemmour", party: "Reconquête", color: "#273033" },
  { id: "dupont-aignan", name: "Nicolas Dupont-Aignan", short: "Dupont-Aignan", party: "DLF", color: "#5f6b8a" },
  { id: "arthaud", name: "Nathalie Arthaud", short: "Arthaud", party: "LO", color: "#7a2e4f" },
] as const;

export type CandidateId = (typeof pollCandidates)[number]["id"];
export type PollValues = Partial<Record<CandidateId, number>>;

export type RadarEvent = {
  id: string;
  /** ISO date, YYYY-MM-DD; `date`, `shortDate` and `pollDay` are derived from it. */
  isoDate: string;
  date: string;
  shortDate: string;
  pollDay: number;
  tag: string;
  filter: "budget" | "coalition" | "foreign" | "programme";
  title: string;
  summary: string;
  image: string;
  color: string;
  chartX: number;
  chartY: number;
  sources: string;
};

// Events are still SIMULATED (titles, dates and summaries are placeholders, not sourced news).
const eventSources: Omit<RadarEvent, "date" | "shortDate" | "pollDay">[] = [
  {
    id: "vat", isoDate: "2026-07-08", tag: "BUDGET", filter: "budget",
    title: "La hausse de la TVA transforme le budget en enjeu électoral",
    summary: "Le gouvernement annonce une hausse du taux normal de TVA dans son projet de budget. Dans le panel, la première question n’est pas celle du déficit, mais de savoir qui paiera avant que les salaires ne suivent.",
    image: `${SITE_BASE}/events/vat.svg`, color: "#ec5b34", chartX: 196, chartY: 236,
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ BUDGÉTAIRE / PROFILS SYNTHÉTIQUES",
  },
  {
    id: "left-rupture", isoDate: "2026-07-29", tag: "COALITION", filter: "coalition",
    title: "La rupture à gauche transforme l’alliance en enjeu de participation",
    summary: "Les discussions entre sociaux-démocrates et insoumis échouent. Le premier signal n’est pas la naissance d’un nouveau bloc, mais un risque bien connu : des électeurs qui ne voient plus de raison de choisir.",
    image: `${SITE_BASE}/events/left-rupture.svg`, color: "#718b86", chartX: 360, chartY: 214,
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ DES ALLIANCES / PROFILS SYNTHÉTIQUES",
  },
  {
    id: "ukraine", isoDate: "2026-08-14", tag: "UKRAINE", filter: "foreign",
    title: "Le déploiement en Ukraine ravive le débat entre sécurité et consentement",
    summary: "La France annonce l’envoi d’un contingent de 5 000 personnes dans une force européenne de réassurance. L’annonce fait réagir des électeurs qui s’accordent sur la menace, mais pas sur la réponse à y apporter.",
    image: `${SITE_BASE}/events/ukraine.svg`, color: "#9c8d6a", chartX: 510, chartY: 198,
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ INTERNATIONALE / PROFILS SYNTHÉTIQUES",
  },
  {
    id: "philippe-programme", isoDate: "2026-09-02", tag: "PROGRAMME", filter: "programme",
    title: "Édouard Philippe dévoile son programme : baisse des dépenses et réforme du travail",
    summary: "Édouard Philippe présente un programme fondé sur la baisse des dépenses publiques et une réforme du travail. Son offre se précise, tout comme les arbitrages qu’elle implique.",
    image: `${SITE_BASE}/events/philippe-programme.svg`, color: "#577572", chartX: 648, chartY: 166,
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ PROGRAMMATIQUE / PROFILS SYNTHÉTIQUES",
  },
  {
    id: "pensions", isoDate: "2026-09-22", tag: "RETRAITES", filter: "programme",
    title: "Le Pen promet le retour à 62 ans : les retraites à l’épreuve de la crédibilité",
    summary: "Marine Le Pen promet de rétablir l’âge légal de départ à la retraite à 62 ans dès le début du mandat. L’annonce touche au-delà de son électorat habituel, mais de façon inégale.",
    image: `${SITE_BASE}/events/pensions.svg`, color: "#a95a56", chartX: 790, chartY: 112,
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ DES RETRAITES / PROFILS SYNTHÉTIQUES",
  },
];

const frenchLong = new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: "UTC" });
export const radarEvents: RadarEvent[] = eventSources.map((event) => ({
  ...event,
  shortDate: formatShortDate(event.isoDate),
  date: `${formatShortDate(event.isoDate)} ${frenchLong.format(Date.parse(event.isoDate))}`,
  pollDay: dayOffset(event.isoDate),
}));

export type PollObservation = { day: number; pollster: string; sample: number; values: PollValues };

/** One point per first-round poll (fieldwork end date), real data only. */
export const pollObservations: PollObservation[] = firstRoundPolls
  .map((poll) => ({ day: dayOffset(poll.fieldworkEnd), pollster: poll.pollster, sample: poll.sampleSize, values: poll.candidateShares as PollValues }))
  .sort((a, b) => a.day - b.day);
