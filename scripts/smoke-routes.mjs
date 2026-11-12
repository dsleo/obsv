import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Source of truth: ids in src/data/chartData.ts (regex keeps this dependency-free).
const data = readFileSync("src/data/chartData.ts", "utf8");
const snapshotEvents = JSON.parse(readFileSync("data/generated/snapshot.json", "utf8")).events;
const eventIds = snapshotEvents
  .filter((event) => {
    try {
      const artifact = JSON.parse(readFileSync(path.join("data/generated/analyses", `${event.id}.json`), "utf8"));
      return artifact.eventId === event.id && ["automatic", "approved"].includes(artifact.review?.status);
    } catch {
      return false;
    }
  })
  .map((event) => event.id);
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
