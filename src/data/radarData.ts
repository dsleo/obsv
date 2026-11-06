import snapshot from "../../data/generated/snapshot.json";

// Real first-round polls from the validated snapshot (`npm run data:collect && npm run data:prepare`).
// The collector backfills from February 2026; the site only shows polls from SHOW_FROM onward.
export const POLL_START = "2026-09-01";
const firstRoundPolls = snapshot.polls.filter((poll) => poll.round === "first" && poll.fieldworkEnd >= POLL_START);
const fieldworkEnds = firstRoundPolls.map((poll) => poll.fieldworkEnd).sort();
const lastPollDate = fieldworkEnds[fieldworkEnds.length - 1] ?? POLL_START;
/** The axis runs to the current date (build day, rebuilt daily) so a gap since the last poll stays visible. */
export const POLL_END = [lastPollDate, new Date().toISOString().slice(0, 10)].sort().pop() as string;
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

// Candidates polled in the retained first-round scenario since September (data/candidates.json is the wider collection allow-list;
// Bardella was the RN line only until June, so he is collected but not shown).
export const pollCandidates = [
  { id: "le-pen", name: "Marine Le Pen", short: "Le Pen", party: "RN", color: "#2b5a8c" },
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

export type EventFilter = "candidacy" | "endorsement" | "campaign" | "justice" | "programme" | "context";
export const eventFilters: Record<EventFilter, string> = { candidacy: "Candidatures", endorsement: "Soutiens", campaign: "Campagne", justice: "Justice", programme: "Propositions", context: "Contexte" };

export type RadarEvent = {
  id: string;
  /** ISO date, YYYY-MM-DD; `date`, `shortDate` and `pollDay` are derived from it. */
  isoDate: string;
  date: string;
  shortDate: string;
  pollDay: number;
  tag: string;
  filter: EventFilter;
  /** "major" events get a vertical line on the chart; "notable" ones only appear in the lists. */
  importance: "major" | "notable";
  title: string;
  summary: string;
  /** CSS `background-image` value: the API events have no illustration. */
  image: string;
  color: string;
  sources: string;
  sourceUrl: string;
};

// Real events from the election-tracker API, selected by rules in scripts/lib/events-api.mjs
// (`npm run data:collect && npm run data:prepare`). event_type -> display tag, filter and colour.
const EVENT_TYPES: Record<string, { tag: string; filter: EventFilter; color: string }> = {
  candidacy: { tag: "CANDIDATURE", filter: "candidacy", color: "#577572" },
  primary_result: { tag: "PRIMAIRE", filter: "candidacy", color: "#577572" },
  endorsement: { tag: "SOUTIEN", filter: "endorsement", color: "#e08a3c" },
  debate: { tag: "DÉBAT", filter: "campaign", color: "#8e7b5e" },
  campaign_visit: { tag: "CAMPAGNE", filter: "campaign", color: "#8e7b5e" },
  judicial: { tag: "JUSTICE", filter: "justice", color: "#a95a56" },
  proposal: { tag: "PROPOSITION", filter: "programme", color: "#2b5a8c" },
  statement: { tag: "DÉCLARATION", filter: "programme", color: "#2b5a8c" },
};

const CONTEXT = { tag: "CONTEXTE", filter: "context" as const, color: "#718b86" };
const frenchLong = new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: "UTC" });
export const radarEvents: RadarEvent[] = snapshot.events.map((event) => {
  const isoDate = event.occurredAt.slice(0, 10);
  const thumbnail = (event as { image?: string }).image; // optional: absent from the inferred type when no event has one
  // context:* (international, security...) only appears if pinned in data/events-curation.json; unknown types fall back to statement.
  const type = EVENT_TYPES[event.category ?? ""] ?? (event.category?.startsWith("context") ? CONTEXT : EVENT_TYPES.statement);
  return {
    id: event.id, isoDate, ...type,
    importance: event.importance === "major" ? ("major" as const) : ("notable" as const),
    title: event.title, summary: event.summary,
    image: thumbnail ? `url("${thumbnail}")` : "none",
    sources: `SOURCES : ${event.sources[0].title.toUpperCase()}`, sourceUrl: event.sources[0].url,
    shortDate: formatShortDate(isoDate),
    date: `${formatShortDate(isoDate)} ${frenchLong.format(Date.parse(isoDate))}`,
    pollDay: dayOffset(isoDate),
  };
}).sort((a, b) => b.pollDay - a.pollDay);

/** Major events inside the plotted window: the vertical lines on the charts and the radar feed. */
export const chartEvents = radarEvents.filter((event) => event.importance === "major" && event.pollDay >= 0 && event.pollDay <= POLL_DAYS);

export type PollObservation = { day: number; pollster: string; sample: number; values: PollValues };

/** One point per first-round poll (fieldwork end date), real data only. */
export const pollObservations: PollObservation[] = firstRoundPolls
  .map((poll) => ({ day: dayOffset(poll.fieldworkEnd), pollster: poll.pollster, sample: poll.sampleSize, values: poll.candidateShares as PollValues }))
  .sort((a, b) => a.day - b.day);

/** Day of the earliest plotted poll: baseline for "change since". */
export const FIRST_POLL_DAY = pollObservations[0]?.day ?? 0;
/** Day of the latest plotted poll: "current" values are read here, not at today's date (which may be days ahead). */
export const LAST_POLL_DAY = pollObservations[pollObservations.length - 1]?.day ?? 0;
