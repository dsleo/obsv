// Human review gate: records that a named reviewer approved the current content of one analysis artifact.
// Usage: npm run data:approve -- <eventId> --reviewer "Nom du relecteur"
import { readFile, writeFile } from "node:fs/promises";
import { analysisArtifactSchema } from "../src/lib/radar/analysisArtifact";
import { analysisContentHash } from "../src/lib/radar/analysisReview";

const eventId = process.argv[2];
const reviewerIndex = process.argv.indexOf("--reviewer");
const reviewer = reviewerIndex < 0 ? "" : (process.argv[reviewerIndex + 1] ?? "").trim();
if (!eventId || eventId.startsWith("--") || !reviewer) {
  console.error('Usage: npm run data:approve -- <eventId> --reviewer "Nom du relecteur"');
  process.exit(1);
}

const file = `data/generated/analyses/${eventId}.json`;
const raw = JSON.parse(await readFile(file, "utf8"));
analysisArtifactSchema.parse(raw); // refuse to approve an invalid artifact
raw.review = { status: "approved", reviewer, reviewedAt: new Date().toISOString(), contentHash: analysisContentHash(raw) };
await writeFile(file, `${JSON.stringify(raw, null, 2)}\n`);
console.log(`${eventId}: approved by ${reviewer} (${raw.review.contentHash.slice(0, 12)})`);
