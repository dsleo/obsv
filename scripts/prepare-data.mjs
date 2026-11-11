import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { FEEDS, loadKnownCandidates, validateFeed } from "./lib/validate.mjs";
import { publicEvents } from "./lib/publication.mjs";

const root = process.cwd(),
  directory = path.join(root, "data/incoming"),
  output = path.join(root, "data/generated");
const validateOnly = process.argv.includes("--validate-only"),
  issues = [],
  knownCandidates = loadKnownCandidates();
async function readFeed(name) {
  try {
    const payload = JSON.parse(await readFile(path.join(directory, `${name}.json`), "utf8"));
    const result = validateFeed(name, payload, { knownCandidates });
    issues.push(...result.issues);
    return result.rows;
  } catch (error) {
    issues.push(
      `${name}.json: ${error.code === "ENOENT" ? "feed missing; collect data first" : "unreadable or invalid JSON"}`,
    );
    return [];
  }
}
async function readRetainedEvents() {
  try {
    const payload = JSON.parse(await readFile(path.join(root, "data/retained-events.json"), "utf8"));
    const result = validateFeed("events", payload, { knownCandidates });
    issues.push(...result.issues.map((issue) => `retained-events.json: ${issue}`));
    return result.rows;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    issues.push("retained-events.json: unreadable or invalid JSON");
    return [];
  }
}
const [polls, incomingEvents, retainedEvents] = await Promise.all([
  ...Object.keys(FEEDS).map(readFeed),
  readRetainedEvents(),
]);
if (!polls.length && process.env.ALLOW_EMPTY_FEEDS !== "true")
  issues.push(
    "polls: empty feed rejected; previous snapshot retained (ALLOW_EMPTY_FEEDS=true for an intentional empty fixture)",
  );
if (!incomingEvents.length && process.env.ALLOW_EMPTY_FEEDS !== "true")
  issues.push(
    "events: empty feed rejected; previous snapshot retained (ALLOW_EMPTY_FEEDS=true for an intentional empty fixture)",
  );
if (issues.length) {
  console.error(issues.map((i) => `- ${i}`).join("\n"));
  process.exitCode = 1;
} else if (!validateOnly) {
  // Some upstream seed identifiers are reused when a cluster is rebuilt. A
  // small, source-verified retention file preserves an event whose distinct
  // article disappeared from that transient API response.
  const incomingIds = new Set(incomingEvents.map((event) => event.id));
  const events = publicEvents([
    ...incomingEvents,
    ...retainedEvents.filter((event) => !incomingIds.has(event.id)),
  ]);
  const generatedAt = new Date().toISOString();
  const dataHash = createHash("sha256")
    .update(JSON.stringify({ polls, events }))
    .digest("hex")
    .slice(0, 16);
  const snapshot = { schemaVersion: 1, generatedAt, dataHash, polls, events };
  // Article collections never enter the chart module imported by browser components.
  const chart = {
    ...snapshot,
    events: events.filter((e) => e.importance === "major").map(({ articles, ...e }) => e),
  };
  await mkdir(output, { recursive: true });
  for (const [name, value] of Object.entries({
    snapshot,
    chart,
    manifest: {
      schemaVersion: 1,
      generatedAt,
      dataHash,
      pollCount: polls.length,
      eventCount: events.length,
      withheldEvents: incomingEvents.length + retainedEvents.length - events.length,
    },
  })) {
    const file = path.join(output, `${name}.json`);
    await writeFile(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
    await rename(`${file}.tmp`, file);
  }
  console.log(
    `Public snapshot ${dataHash}: ${polls.length} polls, ${events.length} events (${incomingEvents.length + retainedEvents.length - events.length} withheld)`,
  );
}
