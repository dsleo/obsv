import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const PINNED_ANALYSIS_MODEL = "gpt-4.1-mini-2025-04-14";
const PUBLIC_ANALYSIS_METHOD = "radar-probabilistic-v2";
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const contentHash = (artifact) => {
  const { review: _review, ...content } = artifact;
  return hash(content);
};
const eventInputHash = (event) => hash({
  title: event.title,
  description: event.summary,
  occurredAt: event.occurredAt.slice(0, 10),
  source: event.sourceId ?? event.sources?.[0]?.url ?? "",
});

// Source of truth: ids in src/data/chartData.ts (regex keeps this dependency-free).
const data = readFileSync("src/data/chartData.ts", "utf8");
const snapshotEvents = JSON.parse(readFileSync("data/generated/snapshot.json", "utf8")).events;
const eventIds = snapshotEvents
  .filter((event) => {
    try {
      const artifact = JSON.parse(readFileSync(path.join("data/generated/analyses", `${event.id}.json`), "utf8"));
      return artifact.eventId === event.id &&
        ["automatic", "approved"].includes(artifact.review?.status) &&
        artifact.review?.contentHash === contentHash(artifact) &&
        artifact.model === PINNED_ANALYSIS_MODEL &&
        artifact.methodVersion === PUBLIC_ANALYSIS_METHOD &&
        !artifact.demo &&
        artifact.eventInputHash === eventInputHash(event);
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
