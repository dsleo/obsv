export const POLL_START = "2026-06-30";
export const POLL_DAYS = 91;

const MONTHS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];
const dayMs = 86_400_000;

/** Days elapsed since POLL_START for an ISO date (YYYY-MM-DD). */
export const dayOffset = (iso: string) => Math.round((Date.parse(iso) - Date.parse(POLL_START)) / dayMs);
export const dayToIso = (day: number) => new Date(Date.parse(POLL_START) + day * dayMs).toISOString().slice(0, 10);
export function formatShortDate(iso: string) {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

export const pollCandidates = [
  { id: "lepen", name: "Marine Le Pen", short: "Le Pen", party: "RN", color: "#2b5a8c", base: 29 },
  { id: "philippe", name: "Édouard Philippe", short: "Philippe", party: "Horizons", color: "#577572", base: 17.5 },
  { id: "glucksmann", name: "Raphaël Glucksmann", short: "Glucksmann", party: "Place publique", color: "#8e7b5e", base: 13.5 },
  { id: "melenchon", name: "Jean-Luc Mélenchon", short: "Mélenchon", party: "LFI", color: "#a95a56", base: 10.5 },
  { id: "retailleau", name: "Bruno Retailleau", short: "Retailleau", party: "LR", color: "#9c8d6a", base: 10 },
  { id: "zemmour", name: "Éric Zemmour", short: "Zemmour", party: "Reconquête", color: "#273033", base: 5 },
] as const;

export type CandidateId = (typeof pollCandidates)[number]["id"];
export type PollValues = Record<CandidateId, number>;

export type RadarEvent = {
  id: string;
  /** ISO date, YYYY-MM-DD; `date`, `shortDate` and `pollDay` are derived from it. */
  isoDate: string;
  date: string;
  shortDate: string;
  pollDay: number;
  /** Simulated point effect per candidate: the single source for chart steps and candidate pages. */
  effects: Partial<Record<CandidateId, number>>;
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

const eventSources: Omit<RadarEvent, "date" | "shortDate" | "pollDay">[] = [
  {
    id: "vat", isoDate: "2026-07-08", effects: { lepen: 1.5, philippe: -1.5, retailleau: -0.5, melenchon: 0.5 }, tag: "BUDGET", filter: "budget",
    title: "La hausse de la TVA transforme le budget en enjeu électoral",
    summary: "Le gouvernement annonce une hausse du taux normal de TVA dans son projet de budget. Dans le panel, la première question n’est pas celle du déficit, mais de savoir qui paiera avant que les salaires ne suivent.",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=82", color: "#ec5b34", chartX: 196, chartY: 236,
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ BUDGÉTAIRE / PROFILS SYNTHÉTIQUES",
  },
  {
    id: "left-rupture", isoDate: "2026-07-29", effects: { glucksmann: -1, melenchon: 1 }, tag: "COALITION", filter: "coalition",
    title: "La rupture à gauche transforme l’alliance en enjeu de participation",
    summary: "Les discussions entre sociaux-démocrates et insoumis échouent. Le premier signal n’est pas la naissance d’un nouveau bloc, mais un risque bien connu : des électeurs qui ne voient plus de raison de choisir.",
    image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=82", color: "#718b86", chartX: 360, chartY: 214,
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ DES ALLIANCES / PROFILS SYNTHÉTIQUES",
  },
  {
    id: "ukraine", isoDate: "2026-08-14", effects: { melenchon: 2, glucksmann: -2, lepen: 0.5, philippe: 0.5 }, tag: "UKRAINE", filter: "foreign",
    title: "Le déploiement en Ukraine ravive le débat entre sécurité et consentement",
    summary: "La France annonce l’envoi d’un contingent de 5 000 personnes dans une force européenne de réassurance. L’annonce fait réagir des électeurs qui s’accordent sur la menace, mais pas sur la réponse à y apporter.",
    image: "https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=82", color: "#9c8d6a", chartX: 510, chartY: 198,
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ INTERNATIONALE / PROFILS SYNTHÉTIQUES",
  },
  {
    id: "philippe-programme", isoDate: "2026-09-02", effects: { philippe: 2, retailleau: -1.5 }, tag: "PROGRAMME", filter: "programme",
    title: "Édouard Philippe dévoile son programme : baisse des dépenses et réforme du travail",
    summary: "Édouard Philippe présente un programme fondé sur la baisse des dépenses publiques et une réforme du travail. Son offre se précise, tout comme les arbitrages qu’elle implique.",
    image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=82", color: "#577572", chartX: 648, chartY: 166,
    sources: "DONNÉES DE SIMULATION · ACTUALITÉ PROGRAMMATIQUE / PROFILS SYNTHÉTIQUES",
  },
  {
    id: "pensions", isoDate: "2026-09-22", effects: { lepen: 2, retailleau: -1, zemmour: -1 }, tag: "RETRAITES", filter: "programme",
    title: "Le Pen promet le retour à 62 ans : les retraites à l’épreuve de la crédibilité",
    summary: "Marine Le Pen promet de rétablir l’âge légal de départ à la retraite à 62 ans dès le début du mandat. L’annonce touche au-delà de son électorat habituel, mais de façon inégale.",
    image: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=82", color: "#a95a56", chartX: 790, chartY: 112,
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

/** Per-candidate view of `effects`, keyed by event id. */
export const candidateEventImpacts: Record<CandidateId, Record<string, number>> = Object.fromEntries(
  pollCandidates.map((candidate) => [candidate.id, Object.fromEntries(
    radarEvents.flatMap((event) => (event.effects[candidate.id] ? [[event.id, event.effects[candidate.id]!]] : [])),
  )]),
) as Record<CandidateId, Record<string, number>>;

const pollsters: { name: string; every: number; offset: number; bias: Partial<Record<CandidateId, number>> }[] = [
  { name: "Ifop", every: 11, offset: 2, bias: { lepen: 0.8 } },
  { name: "Elabe", every: 13, offset: 5, bias: { lepen: -0.5, melenchon: 0.2 } },
  { name: "Odoxa", every: 14, offset: 8, bias: { melenchon: 0.6, philippe: -0.3 } },
  { name: "OpinionWay", every: 12, offset: 4, bias: { philippe: 0.7, zemmour: 0.3 } },
  { name: "Toluna Harris Interactive", every: 15, offset: 10, bias: {} },
];

function seededRandom(seed: number) {
  let value = seed | 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seededRandom(2027);
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function trend(candidateId: CandidateId, base: number, day: number) {
  let value = base + Math.sin(day / 19 + base) * 0.35;
  for (const event of radarEvents) {
    const effect = event.effects[candidateId];
    if (effect) value += effect * sigmoid((day - event.pollDay) / 1.3);
  }
  return value;
}

export type PollObservation = { day: number; pollster: string; sample: number; values: PollValues };

export const pollObservations: PollObservation[] = pollsters.flatMap((pollster) => {
  const observations: PollObservation[] = [];
  for (let day = pollster.offset; day <= POLL_DAYS; day += pollster.every + Math.floor(random() * 3) - 1) {
    const values = Object.fromEntries(pollCandidates.map((candidate) => [
      candidate.id,
      Math.max(1, Math.round(trend(candidate.id, candidate.base, day) + (pollster.bias[candidate.id] ?? 0) + (random() - 0.5) * 2.2)),
    ])) as PollValues;
    observations.push({ day, pollster: pollster.name, sample: 900 + Math.round(random() * 9) * 100, values });
  }
  return observations;
}).sort((a, b) => a.day - b.day);
