import assert from "node:assert/strict";
import test from "node:test";
import { apiToEvents } from "./lib/events-api.mjs";

const ev = (over) => ({ seed_source: "google:1", event_type: "candidacy", tier: "A", title: "T", publisher_count: 1, publishers: ["Le Monde"], candidate_ids: [], election_relevance: 1, occurred_at: "2026-10-01T00:00:00Z", ...over });

test("tiers and publisher counts decide importance", () => {
  const rows = apiToEvents([
    ev({ seed_source: "google:1", publisher_count: 6 }),                    // major
    ev({ seed_source: "google:2", publisher_count: 2 }),                    // notable
    ev({ seed_source: "google:3", publisher_count: 1 }),                    // dropped
    ev({ seed_source: "google:4", tier: "B", publisher_count: 3 }),         // notable
    ev({ seed_source: "google:5", tier: "B", publisher_count: 2 }),         // dropped
    ev({ seed_source: "google:6", tier: "C", publisher_count: 20, election_relevance: 0 }), // dropped
  ]);
  assert.deepEqual(rows.map((r) => [r.id, r.importance]), [["google-1", "major"], ["google-2", "notable"], ["google-4", "notable"]]);
});

test("description skips headline echoes; url comes from the API", () => {
  const e = ev({ title: "Roussel candidat à la présidentielle", publisher_count: 6, publishers: ["Le Monde"], representative_url: "https://x.fr/a",
    source_descriptions: ["Roussel candidat à la présidentielle Le Monde", "Le député du Nord annonce sa candidature."] });
  const [row] = apiToEvents([e]);
  assert.equal(row.summary, "Le député du Nord annonce sa candidature.");
  assert.equal(row.sources[0].url, "https://x.fr/a");
  assert.match(apiToEvents([{ ...e, source_descriptions: [null] }])[0].summary, /^Relayé par 6 médias/);
});

test("curation: pin promotes any tier, hide wins", () => {
  const rows = apiToEvents([ev({ seed_source: "google:6", tier: "C" }), ev({ seed_source: "google:1", publisher_count: 9 })], { pin: ["google-6"], hide: ["google-1"] });
  assert.deepEqual(rows.map((r) => [r.id, r.importance]), [["google-6", "major"]]);
});
