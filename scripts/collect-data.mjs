import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadKnownCandidates, validateFeed } from "./lib/validate.mjs";
import { SONDAX_CSV_URL, sondaxToPolls } from "./lib/sondax.mjs";

// Polls default to the daily Sondax CSV (full history = backfill). POLLS_FEED_URL overrides it with a JSON feed.
// Events have no default source yet.
const eventsUrl = process.env.EVENTS_FEED_URL;
const destination = path.resolve("data/incoming");
const knownCandidates = loadKnownCandidates();
await mkdir(destination, { recursive: true });

async function write(name, payload) {
  // Write to a temp file then rename, so a failure never leaves a half-written last-good file.
  const target = path.join(destination, `${name}.json`);
  await writeFile(`${target}.tmp`, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  await rename(`${target}.tmp`, target);
}

function check(name, payload) {
  const { issues } = validateFeed(name, payload, { knownCandidates });
  if (issues.length) {
    throw new Error(`${name} feed rejected; previous ${name}.json (if any) kept:\n${issues.map((i) => `- ${i}`).join("\n")}`);
  }
}

// Polls
const pollsUrl = process.env.POLLS_FEED_URL;
if (pollsUrl) {
  const response = await fetch(pollsUrl, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`polls feed returned HTTP ${response.status}`);
  let payload;
  try { payload = await response.json(); } catch { throw new Error("polls feed is not valid JSON"); }
  check("polls", payload);
  await write("polls", payload);
  console.log(`polls: collected ${payload.polls.length} records from POLLS_FEED_URL`);
} else {
  const response = await fetch(SONDAX_CSV_URL, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Sondax CSV returned HTTP ${response.status}`);
  const { polls, skipped } = sondaxToPolls(await response.text(), { knownCandidates });
  const payload = { schemaVersion: 1, polls };
  check("polls", payload);
  await write("polls", payload);
  console.log(`polls: collected ${polls.length} first-round polls from Sondax (${skipped} skipped without sample size)`);
}

// Events
if (eventsUrl) {
  const response = await fetch(eventsUrl, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`events feed returned HTTP ${response.status}`);
  let payload;
  try { payload = await response.json(); } catch { throw new Error("events feed is not valid JSON"); }
  check("events", payload);
  await write("events", payload);
  console.log(`events: collected ${payload.events.length} records`);
} else {
  console.log("events: feed URL not configured; preserving manual-input workflow");
}
