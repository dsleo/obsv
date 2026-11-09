// Copies experiment artifacts (made with --out) to the published folder WITHOUT the vote magnitudes (`effect`, `altEffect`), validated by the schema.
// Review status stays "pending": nothing appears on the site until `npm run data:approve`. Usage: npx tsx scripts/publish-analyses.ts <dir> [--keep-magnitudes]
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { analysisArtifactSchema } from "../src/lib/radar/analysisArtifact";

const source = path.resolve(process.argv[2] ?? "");
const keep = process.argv.includes("--keep-magnitudes");
const target = path.resolve("data/generated/analyses");
await mkdir(target, { recursive: true });
let written = 0;
for (const file of (await readdir(source)).filter((name) => name.endsWith(".json"))) {
  const artifact = JSON.parse(await readFile(path.join(source, file), "utf8"));
  if (!keep) for (const contrast of Object.values<Record<string, unknown>>(artifact.contrasts ?? {})) { delete contrast.effect; delete contrast.altEffect; }
  artifact.review = { status: "pending" };
  await writeFile(path.join(target, file), `${JSON.stringify(analysisArtifactSchema.parse(artifact), null, 2)}\n`);
  written += 1;
}
console.log(`published ${written} artifacts to ${target} (${keep ? "WITH" : "without"} magnitudes, review pending)`);
