// Adapter for the election-tracker events API (https://election-tracker-api-eb65.onrender.com/docs).
// The API clusters articles into events and grades them (tier A/B/C); ~8 events/day is too many to show,
// so the rules below keep a "notable" subset and flag a "major" subset (the vertical lines on the chart).
export const EVENTS_API_URL = "https://election-tracker-api-eb65.onrender.com";
export const EVENTS_FROM = "2026-09-01"; // same start as the chart window (POLL_START)

/** Rules, in one place so they are easy to tune. A pinned event is always major; a hidden one is always dropped. */
export function classify(e, { pin = [], hide = [] } = {}, key) {
  if (hide.includes(key)) return null;
  if (pin.includes(key)) return "major";
  if (e.tier === "A" && e.publisher_count >= 5) return "major"; // candidacies, endorsements, debates... widely relayed
  if (e.tier === "A" && e.publisher_count >= 2) return "notable";
  if (e.tier === "B" && e.publisher_count >= 3 && e.election_relevance >= 0.5) return "notable"; // statements/proposals picked up by several outlets
  return null; // tier C (world news, relevance ~0) and single-outlet items are dropped
}

const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const words = (t) => new Set(norm(t).split(" "));
const overlap = (a, b) => { const A = words(a), B = words(b); return [...A].filter((w) => B.has(w)).length / Math.min(A.size, B.size); };

/** Best article description: the longest one that is not a headline echo. Google News appends the outlet name: stripped. */
export function pickDescription(e) {
  const clean = (e.source_descriptions ?? []).filter(Boolean).map((d) => {
    const outlet = e.publishers.find((p) => d.endsWith(p));
    return (outlet ? d.slice(0, -outlet.length) : d).trim();
  });
  const best = clean.filter((d) => overlap(d, e.title) < 0.8).sort((a, b) => b.length - a.length)[0]; // ponytail: word overlap, not semantic
  if (!best) return null;
  return best.length > 320 ? `${best.slice(0, 320).replace(/\s+\S*$/, "")}…` : best;
}

const isGoogle = (u) => !u || u.includes("news.google.com");

/** Thumbnail of a direct article URL (og:image). Google News redirects have none. Returns null on any failure. */
export async function fetchOgImage(url) {
  if (isGoogle(url)) return null;
  try {
    const html = (await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) })).text()).slice(0, 300_000);
    const tag = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]*>/i)?.[0];
    const src = tag?.match(/content=["']([^"']+)["']/i)?.[1];
    return src ? new URL(src.replace(/&amp;/g, "&"), url).href : null;
  } catch { return null; }
}

/**
 * The event's source articles. `sources`, `source_urls` and `source_descriptions` are parallel arrays (one entry per article).
 * Google News descriptions are "headline + outlet name": the outlet is matched against `publishers` and split off.
 * `publishers` is deduplicated, so it cannot be zipped with the articles.
 */
export function buildArticles(e, max = 40) {
  return (e.sources ?? []).slice(0, max).map((id, i) => {
    const raw = (e.source_descriptions?.[i] ?? "").trim();
    const publisher = e.publishers.find((p) => raw.endsWith(p)) ?? (id.startsWith("france24") ? "France 24" : "");
    const text = publisher && raw.endsWith(publisher) ? raw.slice(0, -publisher.length).replace(/\s+[-–|]\s*$/, "").trim() : raw;
    return { title: text || e.title, publisher, url: e.source_urls?.[i] ?? null };
  }).filter((a) => a.url);
}

/** API events -> events.json rows (docs/data-contracts.md). Pure, so it can be tested. */
export function apiToEvents(items, curation = {}) {
  const rows = [];
  for (const e of items) {
    const key = e.seed_source.replace(/\W+/g, "-"); // "google:12882" -> "google-12882": stable across API rebuilds, unlike `id`
    const importance = classify(e, curation, key);
    if (!importance) continue;
    const outlets = e.publishers.slice(0, 4).join(", ");
    rows.push({
      id: key,
      occurredAt: e.occurred_at,
      title: e.title,
      summary: pickDescription(e) ?? `Relayé par ${e.publisher_count} média${e.publisher_count > 1 ? "s" : ""}${outlets ? ` (${outlets})` : ""}.`,
      category: e.event_type,
      importance,
      candidateIds: e.candidate_ids,
      publisherCount: e.publisher_count,
      articles: buildArticles(e),
      // A direct publisher URL when the event has one (enables the thumbnail); else representative_url (usually a Google News redirect).
      sources: [{ title: e.publishers[0] || "Presse", url: [e.representative_url, ...(e.source_urls ?? [])].find((u) => !isGoogle(u)) || e.representative_url || `https://news.google.com/search?q=${encodeURIComponent(e.title)}` }],
      editorialStatus: "draft", // rule-selected, not human-reviewed
    });
  }
  return rows;
}

export async function fetchApiEvents(base = EVENTS_API_URL, from = EVENTS_FROM) {
  const items = [];
  for (let offset = 0; ; offset += 500) {
    // Render's free tier cold-starts slowly: generous timeout.
    const response = await fetch(`${base}/events?from=${from}&limit=500&offset=${offset}`, { headers: process.env.ELECTION_API_KEY ? { "X-API-Key": process.env.ELECTION_API_KEY } : {}, signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`events API returned HTTP ${response.status}${response.status === 401 ? " (set ELECTION_API_KEY)" : ""}`);
    const page = (await response.json()).items;
    items.push(...page);
    if (page.length < 500) return items;
  }
}
