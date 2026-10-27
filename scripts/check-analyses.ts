// Sanity check: every artifact under data/generated/analyses/ must satisfy the public zod contract.
import { readdir, readFile } from "node:fs/promises";
import { analysisArtifactSchema } from "../src/lib/radar/analysisArtifact";

const dir = "data/generated/analyses";
const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json"));
let bad = 0;
for (const file of files) {
  const result = analysisArtifactSchema.safeParse(JSON.parse(await readFile(`${dir}/${file}`, "utf8")));
  if (!result.success) { bad += 1; console.error(`${file}: ${result.error.message}`); }
  else if (result.data.eventId !== file.replace(/\.json$/, "")) { bad += 1; console.error(`${file}: eventId mismatch`); }
}
console.log(`${files.length} artifact(s) checked, ${bad} invalid`);
process.exit(bad ? 1 : 0);
