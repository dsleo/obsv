import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { eventInputHash } from "./analysisInput";
import { analysisContentHash } from "./analysisReview";
import { analysisArtifactSchema } from "./analysisArtifact";
describe("automatic analysis publication integrity", () => {
  const event = {
    title: "Un événement",
    summary: "Les faits rapportés",
    occurredAt: "2026-11-01T12:00:00Z",
    sourceId: "google:123",
    sources: [{ url: "https://news.google.com/articles/a" }],
  };
  it("invalidates an interpretation when its factual summary changes", () => {
    expect(eventInputHash(event)).not.toBe(
      eventInputHash({ ...event, summary: "Un autre fait" }),
    );
  });
  it("does not invalidate identical input because a source redirect was resolved", () => {
    expect(eventInputHash(event)).toBe(
      eventInputHash({
        ...event,
        sources: [{ url: "https://publisher.example/article" }],
      }),
    );
  });
  it("accepts automatic publication without inventing a human reviewer", () => {
    const raw = JSON.parse(
      readFileSync("data/generated/analyses/google-1.json", "utf8"),
    );
    raw.review = { status: "automatic" };
    raw.eventInputHash = eventInputHash(event);
    raw.review.contentHash = analysisContentHash(raw);
    const parsed = analysisArtifactSchema.parse(raw);
    expect(parsed.review.status).toBe("automatic");
    expect(parsed.review.reviewer).toBeUndefined();
    const digest = raw.review.contentHash;
    raw.note = "Edited after publication";
    expect(analysisContentHash(raw)).not.toBe(digest);
  });
});
