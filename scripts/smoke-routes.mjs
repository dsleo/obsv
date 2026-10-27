import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Source of truth: ids in src/data/radarData.ts (regex keeps this dependency-free).
const data = readFileSync("src/data/radarData.ts", "utf8");
const eventIds = [...data.matchAll(/^\s*id: "([^"]+)", isoDate:/gm)].map((m) => m[1]);
const candidateIds = [...data.matchAll(/\{ id: "([^"]+)", name: "[^"]+", short:/g)].map((m) => m[1]);
if (!eventIds.length || !candidateIds.length) { console.error("smoke: could not read ids from radarData.ts"); process.exit(1); }

const routes = ["", "events", "candidates", ...eventIds.map((id) => `events/${id}`), ...candidateIds.map((id) => `candidates/${id}`)];
const missing = routes.filter((r) => !existsSync(path.join("out", r, "index.html")));
if (missing.length) { console.error(`smoke: missing routes in out/: ${missing.join(", ")}`); process.exit(1); }
console.log(`smoke: ${routes.length} routes present`);
