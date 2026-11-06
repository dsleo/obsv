import { describe, expect, it } from "vitest";
import { analysisContentHash } from "./analysisReview";

describe("analysis review gate", () => {
  const artifact = { eventId: "vat", note: "hypothèse", segments: [{ id: "s1", count: 3 }] };

  it("ignores the review block, so approving does not change the hash", () => {
    const pending = { ...artifact, review: { status: "pending" } };
    const approved = { ...artifact, review: { status: "approved", reviewer: "A", contentHash: "x" } };
    expect(analysisContentHash(pending)).toBe(analysisContentHash(approved));
  });

  it("changes when any published content changes after approval", () => {
    const edited = { ...artifact, segments: [{ id: "s1", count: 4 }] };
    expect(analysisContentHash(edited)).not.toBe(analysisContentHash(artifact));
  });
});
