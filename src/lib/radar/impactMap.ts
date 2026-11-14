import type { AnalysisArtifact } from "./analysisArtifact";
import { groupFamily } from "./groupFamilies";
import { rankedSegments } from "./highlights";

/** One event's strongest reaction of a group family (level 1 + 2) for a candidate: s = signed net share of profiles (-1..1). */
export type ImpactCell = { e: string; f1: string; f2: string; c: string; s: number };
export const IMPACT_MIN_CELL = 0.04; // below 4 % of profiles: noise, not shipped to the client

export function impactCells(analysis: AnalysisArtifact | null): ImpactCell[] {
  if (!analysis) return [];
  const best = new Map<string, ImpactCell>();
  for (const { segment, contrast } of rankedSegments(analysis)) {
    if (!contrast.sampledCount) continue;
    const { l1, l2 } = groupFamily(segment);
    if (l1 === "Territoires") continue; // location-only groups say little about who is moved
    for (const [c, v] of Object.entries(contrast.candidateSummary ?? {})) {
      const s = (v.toward - v.away) / contrast.sampledCount;
      const key = `${l1}|${l2}|${c}`;
      if (Math.abs(s) >= IMPACT_MIN_CELL && Math.abs(s) > Math.abs(best.get(key)?.s ?? 0))
        best.set(key, { e: analysis.eventId, f1: l1, f2: l2, c, s: Math.round(s * 1000) / 1000 });
    }
  }
  return [...best.values()];
}
