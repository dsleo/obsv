import { fetchText, fetchJson } from "./http.mjs";
import {
  EVENT_QUALITY_VERSION,
  cleanText,
  httpUrl,
  isProductReview,
  sourceArticles,
} from "./event-quality.mjs";
// Adapter for the election-tracker events API (https://election-tracker-api-eb65.onrender.com/docs).
// The API clusters articles into events and grades them (tier A/B/C); ~8 events/day is too many to show,
// so the rules below keep a "notable" subset and flag a "major" subset (the vertical lines on the chart).
export const EVENTS_API_URL = "https://election-tracker-api-eb65.onrender.com";
export const EVENTS_FROM = "2026-09-01"; // same start as the chart window (POLL_START)

/** Rules, in one place so they are easy to tune. A pinned event is always major; a hidden one is always dropped. */
export function classify(e, { pin = [], hide = [] } = {}, key) {
  if (hide.includes(key) || isProductReview(e.title)) return null;
  if (pin.includes(key)) return "major";
  if (e.tier === "A" && e.publisher_count >= 5) return "major"; // candidacies, endorsements, debates... widely relayed
  if (e.tier === "A" && e.publisher_count >= 2) return "notable";
  if (e.tier === "B" && e.publisher_count >= 3 && e.election_relevance >= 0.5) return "notable"; // statements/proposals picked up by several outlets
  if (SOCIETY.test(e.event_type) && e.publisher_count >= 3 && isFrench(e))
    return e.publisher_count >= 20 ? "major" : "notable"; // French society news (protests, attacks, institutions): tier C, relevance ~0, but widely relayed
  return null; // other tier C (world news) and single-outlet items are dropped
}

export const SOCIETY = /^context:(social|security|institutional|economy|justice|disaster)$/;
const FRANCE = /\bfrance\b|fran[çc]ais|\bhexagone\b/i;
const mentionText = (e) =>
  [e.title, ...(e.source_descriptions ?? []), ...(e.key_terms ?? [])].join(" ");
/** The API's scope when it has one; "default" means no term decided it (foreign items slip through there), so those are dropped. Old API (no scope): keyword check. */
const isFrench = (e) =>
  e.scope ? e.scope === "fr" && e.scope_source === "marker" : FRANCE.test(mentionText(e));
const STORY_CAP = 2; // one story (e.g. an attack and its aftermath) shows at most this many society events

/** A factual summary must come from the representative article's own summary. */
export function pickDescription(e) {
  const primary = e.articles?.find((a) => a.id === e.representative_source);
  return primary?.description ? cleanText(primary.description).slice(0, 1000) : null;
}

const isGoogle = (u) => !u || u.includes("news.google.com");

/** Publisher URL behind a Google News redirect (page signature -> batchexecute). Returns null on any failure. ponytail: unofficial Google endpoint, breaks if Google changes it. */
export async function resolveGoogleUrl(url) {
  if (!url?.includes("news.google.com")) return url ?? null;
  try {
    const id = new URL(url).pathname.split("/").pop();
    const page = await fetchText(`https://news.google.com/articles/${id}`, {
      headers: { "user-agent": "Mozilla/5.0" },
      timeout: 10_000,
      maxBytes: 500_000,
    });
    const sg = page.match(/data-n-a-sg="([^"]+)"/)?.[1],
      ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!sg || !ts) return null;
    const inner = JSON.stringify([
      "garturlreq",
      [
        [
          "X",
          "X",
          ["X", "X"],
          null,
          null,
          1,
          1,
          "US:en",
          null,
          1,
          null,
          null,
          null,
          null,
          null,
          0,
          1,
        ],
        "X",
        "X",
        1,
        [1, 1, 1],
        1,
        1,
        null,
        0,
        0,
        null,
        0,
      ],
      id,
      Number(ts),
      sg,
    ]);
    const body = `f.req=${encodeURIComponent(JSON.stringify([[["Fbv4je", inner, null, "generic"]]]))}`;
    const res = await fetchText("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": "Mozilla/5.0",
      },
      body,
      timeout: 10_000,
      maxBytes: 500_000,
    });
    const resolved = JSON.parse(JSON.parse(res.split("\n\n")[1])[0][2])[1];
    return typeof resolved === "string" && resolved.startsWith("http") ? resolved : null;
  } catch {
    return null;
  }
}

/** Resolve the links of an event's articles (in place) and pick a thumbnail: the API's own image, else the first og:image found. */
export async function enrichEvent(event, tries = 4) {
  let image = event.image ?? null;
  const primary = event.articles.find((a) => a.url === event.sources[0]?.url);
  for (const [i, article] of event.articles.entries()) {
    if (image && i >= tries) break; // image found: remaining links stay as the API gave them
    const url = await resolveGoogleUrl(article.url);
    if (url) article.url = url;
    if (!image && article === primary) image = await fetchOgImage(url);
  }
  const direct = primary && !isGoogle(primary.url) ? primary : null;
  if (direct) event.sources[0] = { title: direct.publisher || "Source originale", url: direct.url }; // "Lire l'article" now points at the publisher, not Google
  event.image = image ?? undefined;
}

/** Thumbnail of a direct article URL (og:image). Google News redirects have none. Returns null on any failure. */
export async function fetchOgImage(url) {
  if (isGoogle(url)) return null;
  try {
    const html = await fetchText(url, {
      headers: { "user-agent": "Mozilla/5.0" },
      timeout: 10_000,
      maxBytes: 1_000_000,
    });
    const tag = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]*>/i)?.[0];
    const src = tag?.match(/content=["']([^"']+)["']/i)?.[1];
    return src ? new URL(src.replace(/&amp;/g, "&"), url).href : null;
  } catch {
    return null;
  }
}

/**
 * The event's source articles. `sources`, `source_urls` and `source_descriptions` are parallel arrays (one entry per article).
 * Google News descriptions are "headline + outlet name": the outlet is matched against `publishers` and split off.
 * `publishers` is deduplicated, so it cannot be zipped with the articles.
 */
export function buildArticles(e, max = 40) {
  return sourceArticles(e).slice(0, max);
}

/** API events -> events.json rows (docs/data-contracts.md). Pure, so it can be tested. */
export function apiToEvents(items, curation = {}) {
  const rows = [],
    keyOf = (e) => e.seed_source.replace(/\W+/g, "-"); // "google:12882" -> "google-12882": stable across API rebuilds, unlike `id`
  const inStory = new Map(),
    capped = new Set(); // per story, the STORY_CAP widest-covered society events survive
  for (const e of [...items].sort((a, b) => b.publisher_count - a.publisher_count)) {
    if (
      !SOCIETY.test(e.event_type) ||
      e.story_id == null ||
      !classify(e, curation, keyOf(e)) ||
      curation.pin?.includes(keyOf(e))
    )
      continue;
    const n = inStory.get(e.story_id) ?? 0;
    if (n >= STORY_CAP) capped.add(keyOf(e));
    else inStory.set(e.story_id, n + 1);
  }
  for (const e of items) {
    const key = keyOf(e);
    const importance = capped.has(key) ? null : classify(e, curation, key);
    if (!importance) continue;
    const articles = buildArticles(e);
    const representative = articles.find((a) => a.id === e.representative_source) ?? articles[0];
    const direct = httpUrl(e.representative_url);
    if (!representative && !direct) continue;
    const publishers = [...new Set(articles.map((a) => a.publisher).filter(Boolean))];
    const summary = pickDescription(e);
    const source = representative ?? { title: e.title, publisher: "Source originale", url: direct };
    rows.push({
      id: key,
      sourceId: e.representative_source || e.seed_source,
      occurredAt: e.occurred_at,
      title: e.title.length > 180 ? `${e.title.slice(0, 179).replace(/\s+\S*$/, "")}…` : e.title, // the analysis artifact caps titles at 180
      summary:
        summary ?? `Consultez les articles sources pour les faits rapportés et leur contexte.`,
      summaryKind: summary ? "source" : "coverage",
      category: e.event_type,
      importance,
      candidateIds: e.candidate_ids,
      publisherCount: publishers.length || 1,
      sourceClusterPublisherCount: e.publisher_count,
      storyId: e.story_id == null ? undefined : String(e.story_id),
      image: representative?.image || e.representative_image_url || undefined, // from the API; enrichEvent fills the rest
      articles,
      // A direct publisher URL when the event has one (enables the thumbnail); else representative_url (usually a Google News redirect).
      sources: [{ title: source.publisher || "Source originale", url: source.url }],
      editorialStatus: "draft",
      quality: {
        version: EVENT_QUALITY_VERSION,
        selection: "automatic",
        sourceMetadata: e.articles ? "original" : "legacy",
        removedArticles: (e.sources?.length ?? articles.length) - articles.length,
      },
    });
  }
  return rows;
}

export async function fetchApiEvents(base = EVENTS_API_URL, from = EVENTS_FROM) {
  const items = [];
  for (let offset = 0; ; offset += 500) {
    // Render's free tier cold-starts slowly: generous timeout.
    const result = await fetchJson(`${base}/events?from=${from}&limit=500&offset=${offset}`, {
      headers: process.env.ELECTION_API_KEY ? { "X-API-Key": process.env.ELECTION_API_KEY } : {},
      timeout: 90_000,
      maxBytes: 15_000_000,
    });
    const page = result.items;
    if (!Array.isArray(page) || items.length + page.length > 20_000)
      throw new Error("events API returned an invalid or oversized collection");
    items.push(...page);
    if (page.length < 500) return items;
  }
}
