import type { AnalysisArtifact } from "./analysisArtifact";

export const blocLabels: Record<string, string> = {
  radical_left: "Gauche radicale", left: "Gauche", center: "Centre",
  right: "Droite", far_right: "Extrême droite", abstention: "Abstention",
};

export type Signal = { bloc: string; label: string; direction: "toward" | "away"; count: number; sampled: number };

/** The segment whose sampled personas react most (toward or away, any bloc). Pure: shared by server and client. */
export function leadSegment(analysis: AnalysisArtifact | null) {
  if (!analysis) return null;
  let best: { segment: AnalysisArtifact["segments"][number]; contrast: AnalysisArtifact["contrasts"][string]; signals: Signal[] } | null = null;
  let bestScore = -1;
  for (const segment of analysis.segments) {
    const contrast = analysis.contrasts[segment.id];
    if (!contrast || segment.status !== "filterable_discovery_sample") continue;
    const signals = Object.entries(contrast.summary).flatMap(([bloc, v]): Signal[] => [
      { bloc, label: blocLabels[bloc] ?? bloc, direction: "toward", count: v.toward, sampled: contrast.sampledCount },
      { bloc, label: blocLabels[bloc] ?? bloc, direction: "away", count: v.away, sampled: contrast.sampledCount },
    ]).filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
    const score = signals[0]?.count ?? 0;
    if (score > bestScore) { bestScore = score; best = { segment, contrast, signals }; }
  }
  return best;
}
