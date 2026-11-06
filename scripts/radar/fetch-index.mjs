// Fetch or verify the persona indexes against the committed lock file (data/radar-index.lock.json).
// Usage:  RADAR_INDEX_BASE_URL=https://<versioned host>/<release>  node scripts/radar/fetch-index.mjs
//         node scripts/radar/fetch-index.mjs --verify      (checks local files only)
// The host is a choice still open (see docs/radar/pipeline.md); this script only needs a base URL.
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, readFileSync, rmSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const lock = JSON.parse(readFileSync("data/radar-index.lock.json", "utf8"));
const dir = "data/radar";
const verifyOnly = process.argv.includes("--verify");

const sha256 = (file) => new Promise((resolve, reject) => {
  const hash = createHash("sha256");
  createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("end", () => resolve(hash.digest("hex"))).on("error", reject);
});

let failed = 0;
for (const [name, expected] of Object.entries(lock.files)) {
  const file = path.join(dir, name);
  if (!verifyOnly && !existsSync(file)) {
    const base = process.env.RADAR_INDEX_BASE_URL;
    if (!base) { console.error(`${name}: missing, and RADAR_INDEX_BASE_URL is not set`); failed += 1; continue; }
    console.log(`${name}: downloading ${base}/${name}`);
    const response = await fetch(`${base.replace(/\/$/, "")}/${name}`);
    if (!response.ok || !response.body) { console.error(`${name}: HTTP ${response.status}`); failed += 1; continue; }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
  }
  if (!existsSync(file)) { console.error(`${name}: missing`); failed += 1; continue; }
  const actual = await sha256(file);
  if (actual !== expected.sha256) {
    console.error(`${name}: sha256 mismatch (expected ${expected.sha256}, got ${actual}); not used, replace it manually`);
    failed += 1;
  } else console.log(`${name}: ok (${lock.version})`);
}
process.exit(failed ? 1 : 0);
