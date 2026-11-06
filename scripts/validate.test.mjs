import assert from "node:assert/strict";
import { test } from "node:test";
import { validateFeed } from "./lib/validate.mjs";

const poll = (over = {}) => ({
  id: "p1", publishedAt: "2026-10-20T08:00:00Z", fieldworkStart: "2026-10-10", fieldworkEnd: "2026-10-12",
  pollster: "Ifop", sampleSize: 1200, round: "first", candidateShares: { a: 30, b: 20 },
  source: { title: "t", url: "https://example.org/p" }, ...over,
});
const event = (over = {}) => ({
  id: "e1", occurredAt: "2026-10-19", title: "T", summary: "S", editorialStatus: "reviewed",
  sources: [{ title: "t", url: "https://example.org/e" }], ...over,
});
const bad = (name, row, needle, opts) => {
  const { issues } = validateFeed(name, { schemaVersion: 1, [name]: [row] }, opts);
  assert.ok(issues.some((i) => i.includes(needle)), `expected "${needle}" in ${JSON.stringify(issues)}`);
};

test("valid feeds pass", () => {
  assert.deepEqual(validateFeed("polls", { schemaVersion: 1, polls: [poll()] }).issues, []);
  assert.deepEqual(validateFeed("events", { schemaVersion: 1, events: [event()] }).issues, []);
});
test("envelope errors", () => {
  assert.equal(validateFeed("polls", { schemaVersion: 2, polls: [] }).issues.length, 1);
  assert.equal(validateFeed("polls", null).issues.length, 1);
});
test("poll field errors", () => {
  bad("polls", poll({ publishedAt: "yesterday" }), "publishedAt");
  bad("polls", poll({ sampleSize: 12.5 }), "sampleSize");
  bad("polls", poll({ sampleSize: 0 }), "sampleSize");
  bad("polls", poll({ round: "third" }), "round");
  bad("polls", poll({ candidateShares: { a: 101 } }), "[0, 100]");
  bad("polls", poll({ candidateShares: { a: "30" } }), "[0, 100]");
  bad("polls", poll({ candidateShares: { a: 60, b: 50 } }), "sums to");
  bad("polls", poll({ source: { title: "t", url: "javascript:alert(1)" } }), "http(s)");
  bad("polls", poll({ candidateShares: { zzz: 5 } }), "known candidate", { knownCandidates: new Set(["a"]) });
});
test("event field errors", () => {
  bad("events", event({ occurredAt: "2026-13-45" }), "occurredAt");
  bad("events", event({ editorialStatus: "wip" }), "editorialStatus");
  bad("events", event({ sources: [] }), "sources");
  bad("events", event({ sources: [{ title: "t", url: "ftp://x" }] }), "http(s)");
});
test("duplicate ids", () => {
  const { issues } = validateFeed("events", { schemaVersion: 1, events: [event(), event()] });
  assert.ok(issues.some((i) => i.includes("duplicates")));
});
