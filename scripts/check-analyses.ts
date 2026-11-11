import { readdir, readFile } from "node:fs/promises";
import { analysisArtifactSchema } from "../src/lib/radar/analysisArtifact";
import { analysisContentHash } from "../src/lib/radar/analysisReview";
import { eventInputHash } from "../src/lib/radar/analysisInput";
import {
  PINNED_ANALYSIS_MODEL,
  PUBLIC_ANALYSIS_METHOD,
} from "../src/lib/radar/analysisPolicy";
const dir = "data/generated/analyses",
  files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json"));
const snapshot = JSON.parse(await readFile("data/generated/snapshot.json", "utf8"));
let bad = 0,
  pending = 0,
  approved = 0,
  stale = 0;
for (const file of files) {
  try {
    const raw = JSON.parse(await readFile(`${dir}/${file}`, "utf8")),
      a = analysisArtifactSchema.parse(raw);
    if (a.eventId !== file.replace(/\.json$/, "")) throw new Error("eventId mismatch");
    if (a.model !== PINNED_ANALYSIS_MODEL || a.methodVersion !== PUBLIC_ANALYSIS_METHOD)
      throw new Error("unsupported model/method; move legacy experiments out of production");
    if (!["automatic", "approved"].includes(a.review.status)) {
      pending++;
      continue;
    }
    if (a.demo) throw new Error("demo analysis cannot be published");
    if (a.review.contentHash !== analysisContentHash(raw))
      throw new Error("published content integrity check failed");
    const e = snapshot.events.find((e: { id: string }) => e.id === a.eventId);
    if (!e || a.eventInputHash !== eventInputHash(e)) {
      stale++;
      continue; // loader withholds stale outputs; fresh news need not wait for model inference
    }
    approved++;
  } catch (error) {
    bad++;
    console.error(`${file}: ${error instanceof Error ? error.message : error}`);
  }
}
console.log(
  `${files.length} artifacts: ${approved} publishable, ${pending} pending/withheld, ${stale} stale/withheld, ${bad} invalid`,
);
process.exit(bad ? 1 : 0);
