// Copies experiment artifacts (made with --out) to the published folder WITHOUT the vote magnitudes (`effect`, `altEffect`), validated by the schema.
// Publication is automatic when the content/input integrity checks pass. Usage: npx tsx scripts/publish-analyses.ts <dir> [--keep-magnitudes]
import { analysisContentHash } from "../src/lib/radar/analysisReview";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { analysisArtifactSchema } from "../src/lib/radar/analysisArtifact";

const source = path.resolve(process.argv[2] ?? "");
const keep = process.argv.includes("--keep-magnitudes");
const target = path.resolve("data/generated/analyses");
// altEffect (event vs alternative scenario) is kept only with --keep-magnitudes AND when a human marked that alternative "ok" in data/alternative-review.json ({ "<eventId>": { "status": "ok" | "fix" | "drop" } }).
const review: Record<string, { status?: string }> = await readFile("data/alternative-review.json", "utf8").then(JSON.parse, () => ({}));
await mkdir(target, { recursive: true });
let written = 0;
for (const file of (await readdir(source)).filter((name) => name.endsWith(".json"))) {
  const artifact = JSON.parse(await readFile(path.join(source, file), "utf8"));
  for (const contrast of Object.values<Record<string, unknown>>(artifact.contrasts ?? {})) {
    if (!keep) delete contrast.effect;
    if (!keep || review[artifact.eventId]?.status !== "ok") delete contrast.altEffect;
  }
  artifact.review = { status: "automatic", contentHash: analysisContentHash(artifact) };
  await writeFile(path.join(target, file), `${JSON.stringify(analysisArtifactSchema.parse(artifact), null, 2)}\n`);
  written += 1;
}
console.log(`published ${written} artifacts to ${target} (${keep ? "WITH" : "without"} magnitudes, automatic integrity gate)`);
