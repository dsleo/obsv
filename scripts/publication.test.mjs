import test from "node:test";
import assert from "node:assert/strict";
import { publicEvents } from "./lib/publication.mjs";
import { EVENT_QUALITY_VERSION } from "./lib/event-quality.mjs";
const event = {
  id: "e1",
  title: "Une actualité",
  editorialStatus: "draft",
  sources: [{ title: "Source", url: "https://example.org" }],
};
test("drafts stay private unless the explicit automatic policy and quality gate both apply", () => {
  assert.deepEqual(publicEvents([event], { policy: "reviewed" }), []);
  assert.deepEqual(publicEvents([event], { policy: "automatic" }), []);
  const checked = { ...event, quality: { version: EVENT_QUALITY_VERSION } };
  const [e] = publicEvents([checked], { policy: "automatic" });
  assert.equal(e.publication.mode, "automatic");
  assert.equal(e.editorialStatus, "published");
});
test("retractions override automatic and explicit publication", () => {
  assert.deepEqual(
    publicEvents(
      [{ ...event, editorialStatus: "retracted", quality: { version: EVENT_QUALITY_VERSION } }],
      { policy: "automatic" },
    ),
    [],
  );
  assert.equal(
    publicEvents([{ ...event, editorialStatus: "published" }], { policy: "reviewed" })[0]
      .publication.mode,
    "reviewed",
  );
});
