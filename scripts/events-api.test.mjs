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

test("French society news is kept, foreign news is not", () => {
  const soc = (over) => ev({ tier: "C", election_relevance: 0, event_type: "context:social", publisher_count: 6, ...over });
  const rows = apiToEvents([
    soc({ seed_source: "google:1", title: "Mobilisations en France" }),                                  // notable
    soc({ seed_source: "google:2", event_type: "context:security", publisher_count: 30, source_descriptions: ["Hommage en France"] }), // major
    soc({ seed_source: "google:3", title: "Manifestations à Belgrade" }),                              // foreign: dropped
    soc({ seed_source: "google:4", title: "Grève en France", publisher_count: 3 }),                    // too few outlets: dropped
    soc({ seed_source: "google:5", event_type: "context:international", title: "France et Ukraine" }),  // world news: dropped
  ]);
  assert.deepEqual(rows.map((r) => [r.id, r.importance]), [["google-1", "notable"], ["google-2", "major"]]);
});

test("description skips headline echoes; url comes from the API", () => {
  const e = ev({ title: "Roussel candidat à la présidentielle", publisher_count: 6, publishers: ["Le Monde"], representative_url: "https://x.fr/a",
    source_descriptions: ["Roussel candidat à la présidentielle Le Monde", "Le député du Nord annonce sa candidature."] });
  const [row] = apiToEvents([e]);
  assert.equal(row.summary, "Le député du Nord annonce sa candidature.");
  assert.equal(row.sources[0].url, "https://x.fr/a");
  assert.match(apiToEvents([{ ...e, source_descriptions: [null] }])[0].summary, /^Relayé par 6 médias/);
});

test("articles: outlet split from the description, one per source", () => {
  const e = ev({ publishers: ["Le Monde", "BFM"], sources: ["google:1", "google:2"], source_urls: ["https://g/1", "https://g/2"], source_descriptions: ["Roussel candidat Le Monde", "Sans éditeur connu"] });
  assert.deepEqual(apiToEvents([{ ...e, publisher_count: 6 }])[0].articles, [
    { title: "Roussel candidat", publisher: "Le Monde", url: "https://g/1" },
    { title: "Sans éditeur connu", publisher: "", url: "https://g/2" },
  ]);
});

test("curation: pin promotes any tier, hide wins", () => {
  const rows = apiToEvents([ev({ seed_source: "google:6", tier: "C" }), ev({ seed_source: "google:1", publisher_count: 9 })], { pin: ["google-6"], hide: ["google-1"] });
  assert.deepEqual(rows.map((r) => [r.id, r.importance]), [["google-6", "major"]]);
});

test("image: the API's own thumbnail is used, representative first", () => {
  const [a, b] = apiToEvents([ev({ seed_source: "google:1", publisher_count: 6, source_image_urls: [null, "https://i/2.jpg"] }), ev({ seed_source: "google:2", publisher_count: 6, representative_image_url: "https://i/r.jpg", source_image_urls: ["https://i/1.jpg"] })]);
  assert.deepEqual([a.image, b.image], ["https://i/2.jpg", "https://i/r.jpg"]);
});
