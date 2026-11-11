import assert from "node:assert/strict";
import test from "node:test";
import { apiToEvents } from "./lib/events-api.mjs";

const ev = (over) => ({
  seed_source: "google:1",
  event_type: "candidacy",
  tier: "A",
  title: "T",
  representative_url: "https://example.org/source",
  publisher_count: 1,
  publishers: ["Le Monde"],
  candidate_ids: [],
  election_relevance: 1,
  occurred_at: "2026-10-01T00:00:00Z",
  ...over,
});

test("tiers and publisher counts decide importance", () => {
  const rows = apiToEvents([
    ev({ seed_source: "google:1", publisher_count: 6 }), // major
    ev({ seed_source: "google:2", publisher_count: 2 }), // notable
    ev({ seed_source: "google:3", publisher_count: 1 }), // dropped
    ev({ seed_source: "google:4", tier: "B", publisher_count: 3 }), // notable
    ev({ seed_source: "google:5", tier: "B", publisher_count: 2 }), // dropped
    ev({
      seed_source: "google:6",
      tier: "C",
      publisher_count: 20,
      election_relevance: 0,
    }), // dropped
  ]);
  assert.deepEqual(
    rows.map((r) => [r.id, r.importance]),
    [
      ["google-1", "major"],
      ["google-2", "notable"],
      ["google-4", "notable"],
    ],
  );
});

test("French society news is kept, foreign news is not", () => {
  const soc = (over) =>
    ev({
      tier: "C",
      election_relevance: 0,
      event_type: "context:social",
      publisher_count: 6,
      ...over,
    });
  const rows = apiToEvents([
    soc({ seed_source: "google:1", title: "Mobilisations en France" }), // old API (no scope): keyword, notable
    soc({
      seed_source: "google:2",
      event_type: "context:security",
      publisher_count: 30,
      source_descriptions: ["Hommage en France"],
    }), // major
    soc({ seed_source: "google:3", title: "Manifestations à Belgrade" }), // foreign: dropped
    soc({
      seed_source: "google:4",
      title: "Grève en France",
      publisher_count: 2,
    }), // too few outlets: dropped
    soc({
      seed_source: "google:5",
      event_type: "context:international",
      title: "France et Ukraine",
    }), // world news: dropped
    soc({
      seed_source: "google:6",
      scope: "fr",
      scope_source: "marker",
      event_type: "context:justice",
    }), // API scope: notable
    soc({ seed_source: "google:7", scope: "fr", scope_source: "default" }), // no term decided the scope: dropped
    soc({
      seed_source: "google:8",
      scope: "international",
      scope_source: "marker",
      title: "Grève en France",
    }), // API scope wins over keywords
  ]);
  assert.deepEqual(
    rows.map((r) => [r.id, r.importance]),
    [
      ["google-1", "notable"],
      ["google-2", "major"],
      ["google-6", "notable"],
    ],
  );
});

test("one story shows at most two society events, the widest covered", () => {
  const s = (n, count, story) =>
    ev({
      seed_source: `google:${n}`,
      tier: "C",
      event_type: "context:security",
      scope: "fr",
      scope_source: "marker",
      election_relevance: 0,
      publisher_count: count,
      story_id: story,
    });
  const rows = apiToEvents([s(1, 5, 9), s(2, 50, 9), s(3, 7, 9), s(4, 4, 8)]);
  assert.deepEqual(
    rows.map((r) => r.id),
    ["google-2", "google-3", "google-4"],
  ); // google-1 is the third of story 9
});

test("summary belongs to the representative article, not the longest cluster snippet", () => {
  const e = ev({
    title: "Roussel candidat à la présidentielle",
    publisher_count: 6,
    representative_source: "google:1",
    articles: [
      {
        id: "google:1",
        title: "Roussel candidat à la présidentielle",
        publisher: "Le Monde",
        url: "https://x.fr/a",
        description: "Le député du Nord annonce sa candidature.",
      },
      {
        id: "google:2",
        title: "Une autre affaire",
        publisher: "BFM",
        url: "https://x.fr/b",
        description:
          "Un procès totalement différent et une longue description à ne pas sélectionner.",
      },
    ],
  });
  const [row] = apiToEvents([e]);
  assert.equal(row.summary, "Le député du Nord annonce sa candidature.");
  assert.equal(row.sources[0].url, "https://x.fr/a");
  assert.equal(row.articles.length, 1);
  assert.equal(row.publisherCount, 1);
});

test("legacy flattened snippets stop at the first outlet, without borrowing its neighbours", () => {
  const e = ev({
    title: "Roussel candidat à la présidentielle",
    publisher_count: 6,
    publishers: ["Le Monde", "BFM"],
    sources: ["google:1", "google:2"],
    source_urls: ["https://g/1", "https://g/2"],
    source_descriptions: [
      "Roussel candidat à la présidentielle Le Monde Autre affaire sans rapport BFM",
      "Sans éditeur connu",
    ],
  });
  const [row] = apiToEvents([e]);
  assert.equal(row.articles.length, 1);
  assert.equal(row.articles[0].title, "Roussel candidat à la présidentielle");
  assert.equal(row.articles[0].publisher, "Le Monde");
  assert.equal(row.summaryKind, "coverage");
});

test("Péchier sources never acquire the unrelated Loury or Bobigny trials", () => {
  const [row] = apiToEvents([
    ev({
      title:
        "Doubs. Affaire Péchier : le procès en appel aura lieu en septembre à Lyon",
      tier: "C",
      event_type: "context:justice",
      scope: "fr",
      scope_source: "marker",
      publisher_count: 4,
      publishers: ["Le Dauphiné Libéré", "L'Yonne Républicaine", "cnc.fr"],
      sources: ["google:1", "google:2", "google:3"],
      source_urls: ["https://a.fr/1", "https://b.fr/2", "https://c.fr/3"],
      source_descriptions: [
        "Doubs. Affaire Péchier : le procès en appel aura lieu en septembre à Lyon Le Dauphiné Libéré",
        "Le procès de Jean-Noël Loury renvoyé à septembre L'Yonne Républicaine",
        "L’Affaire Marie-Claire : raconter le procès de Bobigny par la fiction cnc.fr",
      ],
    }),
  ]);
  assert.equal(row.articles.length, 1);
  assert.match(row.articles[0].title, /Péchier/);
  assert.doesNotMatch(row.summary, /Loury|Bobigny/);
});

test("a Besançon headline does not pick a Dijon description", () => {
  const [row] = apiToEvents([
    ev({
      title: "Éducation : mobilisation à Besançon",
      publisher_count: 6,
      publishers: ["maCommune.info", "Dijon Actualités"],
      sources: ["google:1", "google:2"],
      source_urls: ["https://a.fr/1", "https://b.fr/2"],
      source_descriptions: [
        "Éducation : mobilisation à Besançon maCommune.info",
        "Les mobilisations contre la vie chère continuent à Dijon Dijon Actualités",
      ],
    }),
  ]);
  assert.equal(row.articles.length, 1);
  assert.doesNotMatch(row.summary, /Dijon/);
});

test("car and product reviews never publish even when incorrectly typed or pinned", () => {
  const e = ev({
    title:
      "Photo 1 - Essai Volkswagen T-Roc Hybrid 170 (2026) : notre verdict après 2 000 km",
    event_type: "context:justice",
    tier: "C",
    scope: "fr",
    scope_source: "marker",
    publisher_count: 30,
  });
  assert.deepEqual(apiToEvents([e], { pin: ["google-1"] }), []);
});

test("curation: pin promotes any tier, hide wins", () => {
  const rows = apiToEvents(
    [
      ev({ seed_source: "google:6", tier: "C" }),
      ev({ seed_source: "google:1", publisher_count: 9 }),
    ],
    { pin: ["google-6"], hide: ["google-1"] },
  );
  assert.deepEqual(
    rows.map((r) => [r.id, r.importance]),
    [["google-6", "major"]],
  );
});

test("image: only the representative thumbnail is used, never another story's image", () => {
  const [a, b] = apiToEvents([
    ev({
      seed_source: "google:1",
      publisher_count: 6,
      source_image_urls: [null, "https://i/2.jpg"],
    }),
    ev({
      seed_source: "google:2",
      publisher_count: 6,
      representative_image_url: "https://i/r.jpg",
      source_image_urls: ["https://i/1.jpg"],
    }),
  ]);
  assert.deepEqual([a.image, b.image], [undefined, "https://i/r.jpg"]);
});

test("sources about a broad topic are not attached to a specific family story", () => {
  const [row] = apiToEvents([
    ev({
      title:
        "À table, parents et ados s’embrouillent sur le blocage des lycées",
      publisher_count: 6,
      publishers: ["20 Minutes", "Lyon Mag"],
      sources: ["google:1", "google:2"],
      source_urls: ["https://a.fr/1", "https://b.fr/2"],
      source_descriptions: [
        "À table, parents et ados s’embrouillent sur le blocage des lycées 20 Minutes",
        "Lyon : aucun blocage de lycées ce lundi Lyon Mag",
      ],
    }),
  ]);
  assert.equal(row.articles.length, 1);
});

test("a shared first name does not confuse Marine Le Pen with Marine Tondelier", () => {
  const [row] = apiToEvents([
    ev({
      title: "Marine Le Pen annonce son programme",
      publisher_count: 6,
      articles: [
        {
          id: "a",
          title: "Marine Le Pen présente ses propositions",
          publisher: "A",
          url: "https://a.fr",
        },
        {
          id: "b",
          title: "Marine Tondelier dévoile son programme",
          publisher: "B",
          url: "https://b.fr",
        },
      ],
    }),
  ]);
  assert.equal(row.articles.length, 1);
  assert.match(row.articles[0].title, /Le Pen/);
});
