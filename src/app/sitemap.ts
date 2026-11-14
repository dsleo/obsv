import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/metadata";
import { publishedEvents } from "../lib/radar/publishedEvents";
import { pollCandidates, snapshotUpdatedAt } from "../data/radarData";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL.endsWith("/") ? SITE_URL : `${SITE_URL}/`;
  return [
    "",
    "events/",
    "candidates/",
    "method/",
    "about/",
    ...publishedEvents.map((e) => `events/${e.id}/`),
    ...pollCandidates.map((c) => `candidates/${c.id}/`),
  ].map((path) => ({ url: new URL(path, base).href, lastModified: snapshotUpdatedAt }));
}
