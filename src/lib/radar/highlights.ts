import type { AnalysisArtifact } from "./analysisArtifact";

export const blocLabels: Record<string, string> = {
  radical_left: "Gauche radicale", left: "Gauche", center: "Centre",
  right: "Droite", far_right: "Extrême droite", abstention: "Abstention",
};

export type Signal = { bloc: string; label: string; direction: "toward" | "away"; count: number; sampled: number };

export type RankedSegment = { segment: AnalysisArtifact["segments"][number]; contrast: AnalysisArtifact["contrasts"][string]; signals: Signal[] };

/** Filterable segments ranked by their strongest directional reaction (toward or away, any bloc). Pure: shared by server and client. */
export function rankedSegments(analysis: AnalysisArtifact | null): RankedSegment[] {
  if (!analysis) return [];
  return analysis.segments.flatMap((segment): RankedSegment[] => {
    const contrast = analysis.contrasts[segment.id];
    if (!contrast || segment.status !== "filterable_discovery_sample") return [];
    const signals = Object.entries(contrast.summary).flatMap(([bloc, v]): Signal[] => [
      { bloc, label: blocLabels[bloc] ?? bloc, direction: "toward", count: v.toward, sampled: contrast.sampledCount },
      { bloc, label: blocLabels[bloc] ?? bloc, direction: "away", count: v.away, sampled: contrast.sampledCount },
    ]).filter((s) => s.count > 0).sort((a, b) => b.count - a.count);
    return [{ segment, contrast, signals }];
  }).sort((a, b) => (b.signals[0]?.count ?? 0) - (a.signals[0]?.count ?? 0));
}

/** The most impacted segment. */
export const leadSegment = (analysis: AnalysisArtifact | null) => rankedSegments(analysis)[0] ?? null;

/** Engine bloc of each candidate (the engine's own bloc definitions: LFI, social-democratic/green left, macronist centre, LR, RN and allies). */
export const candidateBloc: Record<string, string> = {
  arthaud: "radical_left", melenchon: "radical_left", tondelier: "left", roussel: "left", glucksmann: "left",
  attal: "center", philippe: "center", retailleau: "right", lisnard: "right", "dupont-aignan": "right",
  "le-pen": "far_right", bardella: "far_right", zemmour: "far_right",
};

/** Directional counts toward/away from a bloc, summed over the segment and global contrasts of one analysis. */
export function blocSignal(analysis: AnalysisArtifact | null, bloc: string) {
  if (!analysis) return null;
  let toward = 0, away = 0, sampled = 0;
  for (const contrast of Object.values(analysis.contrasts)) {
    const v = contrast.summary[bloc];
    if (!v) continue;
    toward += v.toward; away += v.away; sampled += contrast.sampledCount;
  }
  return sampled ? { toward, away, sampled } : null;
}
