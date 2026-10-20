import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const directory = path.join(root, "data/incoming");
const output = path.join(root, "data/generated");
const validateOnly = process.argv.includes("--validate-only");
const issues = [];

async function readFeed(name, requiredFields) {
  let payload;
  try {
    payload = JSON.parse(await readFile(path.join(directory, `${name}.json`), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      console.warn(`${name}: no feed supplied; 0 records`);
      return [];
    }
    issues.push(`${name}.json is not valid JSON`);
    return [];
  }
  if (payload.schemaVersion !== 1 || !Array.isArray(payload[name])) {
    issues.push(`${name}.json must contain schemaVersion: 1 and an array named ${name}`);
    return [];
  }
  const ids = new Set();
  for (const [index, row] of payload[name].entries()) {
    const prefix = `${name}[${index}]`;
    if (!row || typeof row !== "object") { issues.push(`${prefix} must be an object`); continue; }
    for (const field of requiredFields) if (row[field] == null || row[field] === "") issues.push(`${prefix}.${field} is required`);
    if (typeof row.id !== "string" || !row.id) continue;
    if (ids.has(row.id)) issues.push(`${prefix} duplicates id ${row.id}`);
    ids.add(row.id);
  }
  return payload[name];
}

const [polls, events] = await Promise.all([
  readFeed("polls", ["id", "publishedAt", "pollster", "sampleSize", "candidateShares", "source"]),
  readFeed("events", ["id", "occurredAt", "title", "summary", "sources"]),
]);

if (!polls.length && !events.length) console.warn("No collected records yet; the website still uses its clearly labeled demonstration data.");
if (issues.length) {
  console.error(issues.map((issue) => `- ${issue}`).join("\n"));
  process.exitCode = 1;
} else if (!validateOnly) {
  await mkdir(output, { recursive: true });
  const generatedAt = new Date().toISOString();
  const dataHash = createHash("sha256").update(JSON.stringify({ polls, events })).digest("hex").slice(0, 16);
  await writeFile(path.join(output, "manifest.json"), `${JSON.stringify({ schemaVersion: 1, generatedAt, dataHash, pollCount: polls.length, eventCount: events.length }, null, 2)}\n`);
  await writeFile(path.join(output, "snapshot.json"), `${JSON.stringify({ schemaVersion: 1, generatedAt, dataHash, polls, events }, null, 2)}\n`);
  console.log(`Validated snapshot ${dataHash}: ${polls.length} polls, ${events.length} events`);
}
