import rawChart from "../../data/generated/chart.json";
import type { Snapshot, EventRecord } from "./contracts";
const snapshot = rawChart as unknown as Snapshot;

// Real first-round polls from the validated snapshot (`npm run data:collect && npm run data:prepare`).
// The collector backfills from February 2026; the site only shows polls from SHOW_FROM onward.
export const POLL_START = "2026-09-01";
const firstRoundPolls = snapshot.polls.filter(
  (poll) => poll.round === "first" && poll.fieldworkEnd >= POLL_START,
);
const fieldworkEnds = firstRoundPolls.map((poll) => poll.fieldworkEnd).sort();
const lastPollDate = fieldworkEnds[fieldworkEnds.length - 1] ?? POLL_START;
/** The axis runs to the current date (build day, rebuilt daily) so a gap since the last poll stays visible. */
export const POLL_END = [lastPollDate, snapshot.generatedAt.slice(0, 10)]
  .sort()
  .pop() as string;
export const POLL_DAYS = Math.round(
  (Date.parse(POLL_END) - Date.parse(POLL_START)) / 86_400_000,
);

const MONTHS = [
  "JANV.",
  "FÉVR.",
  "MARS",
  "AVR.",
  "MAI",
  "JUIN",
  "JUIL.",
  "AOÛT",
  "SEPT.",
  "OCT.",
  "NOV.",
  "DÉC.",
];
const dayMs = 86_400_000;

/** Days elapsed since POLL_START for an ISO date (YYYY-MM-DD). */
export const dayOffset = (iso: string) =>
  Math.round((Date.parse(iso) - Date.parse(POLL_START)) / dayMs);
export const dayToIso = (day: number) =>
  new Date(Date.parse(POLL_START) + day * dayMs).toISOString().slice(0, 10);
export function formatShortDate(iso: string) {
  const [, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}
export const pollWindowLabel = `${formatShortDate(POLL_START)} — ${formatShortDate(POLL_END)} ${POLL_END.slice(0, 4)}`;

// Candidates polled in the retained first-round scenario since September (data/candidates.json is the wider collection allow-list;
// Bardella was the RN line only until June, so he is collected but not shown).
export const pollCandidates = [
  {
    id: "le-pen",
    name: "Marine Le Pen",
    short: "Le Pen",
    party: "RN",
    color: "var(--cand-le-pen)",
  },
  {
    id: "philippe",
    name: "Édouard Philippe",
    short: "Philippe",
    party: "Horizons",
    color: "var(--cand-philippe)",
  },
  {
    id: "attal",
    name: "Gabriel Attal",
    short: "Attal",
    party: "Renaissance",
    color: "var(--cand-attal)",
  },
  {
    id: "glucksmann",
    name: "Raphaël Glucksmann",
    short: "Glucksmann",
    party: "Place publique",
    color: "var(--cand-glucksmann)",
  },
  {
    id: "melenchon",
    name: "Jean-Luc Mélenchon",
    short: "Mélenchon",
    party: "LFI",
    color: "var(--cand-melenchon)",
  },
  {
    id: "tondelier",
    name: "Marine Tondelier",
    short: "Tondelier",
    party: "Les Écologistes",
    color: "var(--cand-tondelier)",
  },
  {
    id: "roussel",
    name: "Fabien Roussel",
    short: "Roussel",
    party: "PCF",
    color: "var(--cand-roussel)",
  },
  {
    id: "retailleau",
    name: "Bruno Retailleau",
    short: "Retailleau",
    party: "LR",
    color: "var(--cand-retailleau)",
  },
  {
    id: "lisnard",
    name: "David Lisnard",
    short: "Lisnard",
    party: "LR",
    color: "var(--cand-lisnard)",
  },
  {
    id: "zemmour",
    name: "Éric Zemmour",
    short: "Zemmour",
    party: "Reconquête",
    color: "var(--cand-zemmour)",
  },
  {
    id: "dupont-aignan",
    name: "Nicolas Dupont-Aignan",
    short: "Dupont-Aignan",
    party: "DLF",
    color: "var(--cand-dupont-aignan)",
  },
  {
    id: "arthaud",
    name: "Nathalie Arthaud",
    short: "Arthaud",
    party: "LO",
    color: "var(--cand-arthaud)",
  },
] as const;

export type CandidateId = (typeof pollCandidates)[number]["id"];
export type PollValues = Partial<Record<CandidateId, number>>;

export type EventFilter =
  | "candidacy"
  | "endorsement"
  | "campaign"
  | "justice"
  | "programme"
  | "context";
export const eventFilters: Record<EventFilter, string> = {
  candidacy: "Candidatures",
  endorsement: "Soutiens",
  campaign: "Campagne",
  justice: "Justice",
  programme: "Propositions et déclarations",
  context: "Contexte",
};

export type RadarEvent = {
  id: string;
  /** Full source timestamp retained for editorial chronology within a day. */
  occurredAt: string;
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
  /** CSS `background-image` value: the article thumbnail, or a tag-coloured gradient when there is none. */
  image: string;
  color: string;
  sources: string;
  sourceUrl: string;
  /** All the articles grouped in this event. */
  articles: { title: string; publisher: string; url: string }[];
  publisherCount: number;
  candidateIds: string[];
  storyId?: string;
  summaryKind?: "source" | "coverage";
  publicationMode: "automatic" | "reviewed";
  imageUrl?: string;
  imageCredit?: string;
};

// A small editorial fallback for a paywalled story whose publisher page exposes
// neither og:image nor a usable thumbnail. It stays tied to the same candidate
// and campaign coverage so the card remains a real news image, not a gradient.
const FALLBACK_EVENT_IMAGES: Record<string, string> = {
  "google-2783":
    "https://img.lemde.fr/2026/09/14/0/0/4724/3146/664/0/75/0/e23db0d_upload-1-lyapms8fqcva-mmagnin-retailleau-jeunes-lr-70.jpg",
};

// Real events from the election-tracker API, selected by rules in scripts/lib/events-api.mjs
// (`npm run data:collect && npm run data:prepare`). event_type -> display tag, filter and colour.
const EVENT_TYPES: Record<
  string,
  { tag: string; filter: EventFilter; color: string }
> = {
  "context:justice": { tag: "JUSTICE", filter: "justice", color: "#a95a56" },
  "context:security": { tag: "SÉCURITÉ", filter: "context", color: "#718b86" },
  "context:social": { tag: "SOCIÉTÉ", filter: "context", color: "#718b86" },
  "context:economy": { tag: "ÉCONOMIE", filter: "context", color: "#718b86" },
  "context:institutional": {
    tag: "INSTITUTIONS",
    filter: "context",
    color: "#718b86",
  },
  "context:disaster": { tag: "SOCIÉTÉ", filter: "context", color: "#718b86" },
  candidacy: { tag: "CANDIDATURE", filter: "candidacy", color: "#577572" },
  primary_result: { tag: "PRIMAIRE", filter: "candidacy", color: "#577572" },
  endorsement: { tag: "SOUTIEN", filter: "endorsement", color: "#e08a3c" },
  debate: { tag: "DÉBAT", filter: "campaign", color: "#8e7b5e" },
  campaign_visit: { tag: "CAMPAGNE", filter: "campaign", color: "#8e7b5e" },
  judicial: { tag: "JUSTICE", filter: "justice", color: "#a95a56" },
  proposal: { tag: "PROPOSITION", filter: "programme", color: "#2b5a8c" },
  statement: { tag: "DÉCLARATION", filter: "programme", color: "#2b5a8c" },
};

const CONTEXT = {
  tag: "SOCIÉTÉ",
  /* internal bucket: no public label */ filter: "context" as const,
  color: "#718b86",
};
const frenchLong = new Intl.DateTimeFormat("fr-FR", {
  year: "numeric",
  timeZone: "UTC",
});
export function presentEvent(event: EventRecord): RadarEvent {
  const isoDate = event.occurredAt.slice(0, 10);
  const thumbnail =
    (event as { image?: string }).image ?? FALLBACK_EVENT_IMAGES[event.id]; // optional: absent from the inferred type when no event has one
  // context:* (international, security...) only appears if pinned in data/events-curation.json; unknown types fall back to statement.
  const type =
    EVENT_TYPES[event.category ?? ""] ??
    (event.category?.startsWith("context") ? CONTEXT : EVENT_TYPES.statement);
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    isoDate,
    ...type,
    importance:
      event.importance === "major" ? ("major" as const) : ("notable" as const),
    title: event.title,
    summary: event.summary,
    articles:
      (
        event as {
          articles?: { title: string; publisher: string; url: string }[];
        }
      ).articles ?? [],
    publisherCount: event.publisherCount ?? 1,
    candidateIds: event.candidateIds ?? [],
    storyId: event.storyId,
    summaryKind: event.summaryKind,
    publicationMode: event.publication?.mode ?? "automatic",
    // The feed supplies the originating publisher and image URL together. The
    // product decision is to restore those attributed editorial thumbnails.
    imageUrl: thumbnail,
    imageCredit: event.imageCredit ?? event.sources[0]?.title,
    image: thumbnail
      ? `url("${thumbnail}"), linear-gradient(140deg, ${type.color}, #15191b)`
      : `linear-gradient(140deg, ${type.color}, #15191b)`, // thumbnail on top; if it fails the tag-coloured gradient shows through
    // no thumbnail: tag-coloured card
    sources: `SOURCES : ${event.sources[0].title.toUpperCase()}`,
    sourceUrl: event.sources[0].url,
    shortDate: formatShortDate(isoDate),
    date: `${formatShortDate(isoDate)} ${frenchLong.format(Date.parse(isoDate))}`,
    pollDay: dayOffset(isoDate),
  };
}
const radarEvents = snapshot.events
  .map(presentEvent)
  .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

/** Major events inside the plotted window: the vertical lines on the charts and the radar feed. */
export const chartEvents = radarEvents.filter(
  (event) =>
    event.importance === "major" &&
    event.pollDay >= 0 &&
    event.pollDay <= POLL_DAYS,
);

export type PollObservation = {
  id: string;
  day: number;
  fieldworkStart?: string;
  fieldworkEnd: string;
  source: { title: string; url: string };
  pollster: string;
  sample: number;
  values: PollValues;
};

/** One point per first-round poll (fieldwork end date), real data only. */
export const pollObservations: PollObservation[] = firstRoundPolls
  .map((poll) => ({
    id: poll.id,
    fieldworkStart: poll.fieldworkStart,
    fieldworkEnd: poll.fieldworkEnd,
    source: poll.source,
    day: dayOffset(poll.fieldworkEnd),
    pollster: poll.pollster,
    sample: poll.sampleSize,
    values: poll.candidateShares as PollValues,
  }))
  .sort((a, b) => a.day - b.day);

/** Day of the earliest plotted poll: baseline for "change since". */
export const FIRST_POLL_DAY = pollObservations[0]?.day ?? 0;
/** Day of the latest plotted poll: "current" values are read here, not at today's date (which may be days ahead). */
export const LAST_POLL_DAY =
  pollObservations[pollObservations.length - 1]?.day ?? 0;

export const snapshotUpdatedAt = snapshot.generatedAt;
export const latestPollDate = lastPollDate;
export function candidateLatestDate(id: CandidateId) {
  return (
    pollObservations.filter((p) => p.values[id] !== undefined).at(-1)
      ?.fieldworkEnd ?? null
  );
}
