import { test } from "node:test";
import assert from "node:assert/strict";
import { sondaxToPolls } from "./lib/sondax.mjs";
import { validateFeed } from "./lib/validate.mjs";

const csv = [
  "sondage_id,institut,terrain_debut,terrain_fin,echantillon,tour,configuration,configuration_principale,echantillon_configuration,candidat_id,candidat,parti,score,source,wikipedia_revid,url_source",
  "ifop-2026-10-29,Ifop,2026-10-27,2026-10-29,1501,1,1,1,,le-pen,Marine Le Pen,RN,35,wikipedia,1,https://example.org/notice",
  "ifop-2026-10-29,Ifop,2026-10-27,2026-10-29,1501,1,1,1,,attal,Gabriel Attal,RE,8,wikipedia,1,https://example.org/notice",
  "ifop-2026-10-29,Ifop,2026-10-27,2026-10-29,1501,1,1,1,,unknown-person,Someone,XX,3,wikipedia,1,",
  "ifop-2026-10-29,Ifop,2026-10-27,2026-10-29,1501,1,2,0,,philippe,Édouard Philippe,HOR,20,wikipedia,1,",
  "ifop-2026-07-08,Ifop,2026-07-06,2026-07-08,,1,1,1,,le-pen,Marine Le Pen,RN,36,wikipedia,1,",
  "opinionway-2026-10-22,OpinionWay,2026-10-20,2026-10-22,1000,2,1,0,,le-pen,Marine Le Pen,RN,52,wikipedia,1,",
].join("\n");

const candidates = new Set(["le-pen", "attal", "philippe"]);

test("keeps retained first-round configurations only, drops unknown candidates and unsampled polls", () => {
  const { polls, skipped } = sondaxToPolls(csv, { knownCandidates: candidates });
  assert.equal(skipped, 1);
  assert.deepEqual(polls.map((poll) => poll.id), ["ifop-2026-10-29"]);
  assert.deepEqual(polls[0].candidateShares, { "le-pen": 35, attal: 8 });
  assert.equal(polls[0].publishedAt, "2026-10-29T00:00:00Z");
  assert.equal(polls[0].source.url, "https://example.org/notice");
});

test("output passes the polls.json contract validator", () => {
  const { polls } = sondaxToPolls(csv, { knownCandidates: candidates });
  const { issues } = validateFeed("polls", { schemaVersion: 1, polls }, { knownCandidates: candidates });
  assert.deepEqual(issues, []);
});
