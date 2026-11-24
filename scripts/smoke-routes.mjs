import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { publishedEvents } from "../src/lib/radar/publishedEvents.ts";

// Use the same publication rule as the event pages and sitemap.
const data = readFileSync("src/data/chartData.ts", "utf8");
const eventIds = publishedEvents.map((event) => event.id);
const candidateIds = [...data.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
if (!candidateIds.length) {
  console.error("smoke: could not read ids from chartData.ts");
  process.exit(1);
}

const routes = [
  "",
  "events",
  "candidates",
  "method",
  "about",
  ...eventIds.map((id) => `events/${id}`),
  ...candidateIds.map((id) => `candidates/${id}`),
];
const missing = routes.filter((r) => !existsSync(path.join("out", r, "index.html")));
if (missing.length) {
  console.error(`smoke: missing routes in out/: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`smoke: ${routes.length} routes present`);
