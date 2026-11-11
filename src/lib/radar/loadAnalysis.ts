import { readFileSync } from "node:fs";
import path from "node:path";
import rawSnapshot from "../../../data/generated/snapshot.json";
import type { Snapshot } from "../../data/contracts";
import {
  analysisArtifactSchema,
  type AnalysisArtifact,
} from "./analysisArtifact";
import { analysisContentHash } from "./analysisReview";
import { eventInputHash } from "./analysisInput";
import {
  PINNED_ANALYSIS_MODEL,
  PUBLIC_ANALYSIS_METHOD,
} from "./analysisPolicy";
export function loadAnalysis(eventId: string): AnalysisArtifact | null {
  if (!/^[a-zA-Z0-9_:-]+$/.test(eventId))
    throw new Error("Invalid event identifier");
  try {
    const raw = JSON.parse(
      readFileSync(
        path.join(process.cwd(), "data/generated/analyses", `${eventId}.json`),
        "utf8",
      ),
    );
    const artifact = analysisArtifactSchema.parse(raw);
    if (!["automatic", "approved"].includes(artifact.review.status))
      return null;
    if (artifact.review.contentHash !== analysisContentHash(raw))
      throw new Error(`${eventId}: published content integrity check failed`);
    if (
      artifact.eventId !== eventId ||
      artifact.model !== PINNED_ANALYSIS_MODEL ||
      artifact.methodVersion !== PUBLIC_ANALYSIS_METHOD ||
      artifact.demo
    )
      throw new Error(`${eventId}: unsupported production analysis`);
    const event = (rawSnapshot as unknown as Snapshot).events.find(
      (e) => e.id === eventId,
    );
    if (!event || artifact.eventInputHash !== eventInputHash(event))
      return null; // changed news needs a fresh analysis
    return artifact;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw error;
  }
}
