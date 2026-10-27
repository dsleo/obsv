import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadKnownCandidates, validateFeed } from "./lib/validate.mjs";

const inputs = [
  ["polls", process.env.POLLS_FEED_URL],
  ["events", process.env.EVENTS_FEED_URL],
];
const destination = path.resolve("data/incoming");
const knownCandidates = loadKnownCandidates();
await mkdir(destination, { recursive: true });

let fetched = 0;
for (const [name, url] of inputs) {
  if (!url) {
    console.log(`${name}: feed URL not configured; preserving manual-input workflow`);
    continue;
  }
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${name} feed returned HTTP ${response.status}`);
  let payload;
  try { payload = await response.json(); } catch { throw new Error(`${name} feed is not valid JSON`); }
  const { issues } = validateFeed(name, payload, { knownCandidates });
  if (issues.length) {
    throw new Error(`${name} feed rejected; previous ${name}.json (if any) kept:\n${issues.map((i) => `- ${i}`).join("\n")}`);
  }
  // Write to a temp file then rename, so a failure never leaves a half-written last-good file.
  const target = path.join(destination, `${name}.json`);
  await writeFile(`${target}.tmp`, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  await rename(`${target}.tmp`, target);
  console.log(`${name}: collected ${payload[name].length} records`);
  fetched += 1;
}
if (fetched === 0) console.log("No feeds configured yet; configure repository variables before expecting automatic collection.");
