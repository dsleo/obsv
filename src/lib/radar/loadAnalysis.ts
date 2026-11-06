import { readFileSync } from "node:fs";
import path from "node:path";
import { analysisArtifactSchema, type AnalysisArtifact } from "./analysisArtifact";

// Build-time only (server components): reads the artifact produced by `npm run data:analyze`.
export function loadAnalysis(eventId: string): AnalysisArtifact | null {
  try {
    const raw = readFileSync(path.join(process.cwd(), "data/generated/analyses", `${eventId}.json`), "utf8");
    return analysisArtifactSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw error; // an invalid artifact must fail the build, not silently disappear
  }
}
