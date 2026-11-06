// Sanity check before commit: every artifact under data/generated/analyses/ must satisfy the public zod contract,
// use the pinned model, and carry a human approval for its exact current content.
import { readdir, readFile } from "node:fs/promises";
import { PINNED_MODEL } from "../pipeline/radar/openaiStructured";
import { analysisArtifactSchema } from "../src/lib/radar/analysisArtifact";
import { analysisContentHash } from "../src/lib/radar/analysisReview";

const dir = "data/generated/analyses";
const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json"));
let bad = 0;
const fail = (file: string, message: string) => { bad += 1; console.error(`${file}: ${message}`); };
for (const file of files) {
  const raw = JSON.parse(await readFile(`${dir}/${file}`, "utf8"));
  const result = analysisArtifactSchema.safeParse(raw);
  if (!result.success) { fail(file, result.error.message); continue; }
  if (result.data.eventId !== file.replace(/\.json$/, "")) fail(file, "eventId mismatch");
  if (result.data.model !== PINNED_MODEL) fail(file, `model ${result.data.model} is not the pinned ${PINNED_MODEL}; regenerate`);
  if (result.data.review.status !== "approved") fail(file, "not approved by a human reviewer (npm run data:approve)");
  else if (result.data.review.contentHash !== analysisContentHash(raw)) fail(file, "content changed after approval; re-approve");
}
console.log(`${files.length} artifact(s) checked, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
