import { readFileSync } from "node:fs";
import path from "node:path";
import { analysisArtifactSchema, type AnalysisArtifact } from "./analysisArtifact";
import { analysisContentHash } from "./analysisReview";

// Build-time only (server components): reads the artifact produced by `npm run data:analyze`.
export function loadAnalysis(eventId: string): AnalysisArtifact | null {
  try {
    const raw = JSON.parse(readFileSync(path.join(process.cwd(), "data/generated/analyses", `${eventId}.json`), "utf8"));
    const artifact = analysisArtifactSchema.parse(raw);
    if (artifact.review.status !== "approved") return null; // unreviewed analyses are never published
    if (artifact.review.contentHash !== analysisContentHash(raw)) throw new Error(`${eventId}: content changed after approval`);
    return artifact;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw error; // an invalid artifact must fail the build, not silently disappear
  }
}
