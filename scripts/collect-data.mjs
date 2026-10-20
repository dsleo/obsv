import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const inputs = [
  ["polls", process.env.POLLS_FEED_URL],
  ["events", process.env.EVENTS_FEED_URL],
];
const destination = path.resolve("data/incoming");
await mkdir(destination, { recursive: true });

let fetched = 0;
for (const [name, url] of inputs) {
  if (!url) {
    console.log(`${name}: feed URL not configured; preserving manual-input workflow`);
    continue;
  }
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${name} feed returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload[name])) {
    throw new Error(`${name} feed must be JSON { schemaVersion: 1, ${name}: [...] }`);
  }
  await writeFile(path.join(destination, `${name}.json`), `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  console.log(`${name}: collected ${payload[name].length} records`);
  fetched += 1;
}
if (fetched === 0) console.log("No feeds configured yet; configure repository variables before expecting automatic collection.");
