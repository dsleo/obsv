import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { EVENT_QUALITY_VERSION, isProductReview } from "./event-quality.mjs";
const configuredPolicy = JSON.parse(
  readFileSync(new URL("../../data/publication-policy.json", import.meta.url), "utf8"),
);
export const PUBLICATION_POLICY_VERSION = "publication-v1";
export const inputDigest = (event) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        title: event.title,
        description: event.summary,
        occurredAt: event.occurredAt.slice(0, 10),
        sourceUrl: event.sources[0]?.url ?? "",
      }),
    )
    .digest("hex");

// A published record is an explicit decision. Quality-checked automatic selection is an
// independent mode, never represented as a human review. Draft/retracted rows stay private.
export function publicEvents(
  events,
  { policy = process.env.EVENT_PUBLICATION_POLICY ?? configuredPolicy.events } = {},
) {
  return events
    .filter((e) => {
      if (e.editorialStatus === "retracted" || isProductReview(e.title)) return false;
      if (e.editorialStatus === "published") return true;
      return (
        policy === "automatic" && e.quality?.version === EVENT_QUALITY_VERSION && e.sources?.length
      );
    })
    .map((e) => ({
      ...e,
      editorialStatus: "published",
      publication: {
        mode: e.editorialStatus === "published" ? "reviewed" : "automatic",
        policyVersion: PUBLICATION_POLICY_VERSION,
      },
    }));
}
