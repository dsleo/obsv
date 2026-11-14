import type { AnalysisArtifact } from "./analysisArtifact";
import { pollCandidates } from "../../data/chartData";

export const blocLabels: Record<string, string> = {
  radical_left: "Gauche radicale",
  left: "Gauche",
  center: "Centre",
  right: "Droite",
  far_right: "Extrême droite",
  abstention: "Abstention",
};

const candidateLabels: Record<string, string> = Object.fromEntries([
  ...pollCandidates.map((candidate) => [candidate.id, candidate.short]),
  ["abstention", "Abstention"],
]);

type ImpactLike = { id: string; toward: number; away: number; sampled: number };
export const IMPACT_MIN_SHARE = 0.02; // below 2 % of profiles the signal is noise: not listed
/** Ids of the top-n "rapprochement" and top-n "éloignement" events, by share of profiles (what the candidate page lists first). */
export function topImpactIds(rows: ImpactLike[], n = 5): string[] {
  const top = (kind: "toward" | "away", other: "toward" | "away") =>
    rows
      .filter((r) => r[kind] > r[other] && r[kind] / r.sampled >= IMPACT_MIN_SHARE)
      .sort((a, b) => b[kind] / b.sampled - a[kind] / a.sampled)
      .slice(0, n)
      .map((r) => r.id);
  return [...new Set([...top("toward", "away"), ...top("away", "toward")])];
}

export type Signal = {
  bloc: string;
  label: string;
  direction: "toward" | "away";
  count: number;
  sampled: number;
};

export type RankedSegment = {
  segment: AnalysisArtifact["segments"][number];
  contrast: AnalysisArtifact["contrasts"][string];
  signals: Signal[];
};

/** Filterable segments ranked by their strongest directional reaction (toward or away, any bloc). Pure: shared by server and client. */
export function rankedSegments(
  analysis: AnalysisArtifact | null,
): RankedSegment[] {
  if (!analysis) return [];
  return analysis.segments
    .flatMap((segment): RankedSegment[] => {
      const contrast = analysis.contrasts[segment.id];
      if (!contrast || segment.status !== "filterable_discovery_sample")
        return [];
      const source = contrast.candidateSummary ?? contrast.summary;
      const signals = Object.entries(source)
        .flatMap(([bloc, v]): Signal[] => [
          {
            bloc,
            label: contrast.candidateSummary ? candidateLabels[bloc] ?? bloc : blocLabels[bloc] ?? bloc,
            direction: "toward",
            count: v.toward,
            sampled: contrast.sampledCount,
          },
          {
            bloc,
            label: contrast.candidateSummary ? candidateLabels[bloc] ?? bloc : blocLabels[bloc] ?? bloc,
            direction: "away",
            count: v.away,
            sampled: contrast.sampledCount,
          },
        ])
        .filter((s) => s.count > 0)
        .sort((a, b) => b.count - a.count);
      return [{ segment, contrast, signals }];
    })
    .sort((a, b) => (b.signals[0]?.count ?? 0) - (a.signals[0]?.count ?? 0));
}

/** The most impacted segment. */
export const leadSegment = (analysis: AnalysisArtifact | null) =>
  rankedSegments(analysis)[0] ?? null;

/** Engine bloc of each candidate (the engine's own bloc definitions: LFI, social-democratic/green left, macronist centre, LR, RN and allies). */
export const candidateBloc: Record<string, string> = {
  arthaud: "radical_left",
  melenchon: "radical_left",
  tondelier: "left",
  roussel: "left",
  glucksmann: "left",
  attal: "center",
  philippe: "center",
  retailleau: "right",
  lisnard: "right",
  "dupont-aignan": "far_right",
  "le-pen": "far_right",
  bardella: "far_right",
  zemmour: "far_right",
};

/** One whole-index contrast only: discovery groups overlap and must not be pooled. */
export function blocSignal(analysis: AnalysisArtifact | null, bloc: string) {
  if (!analysis) return null;
  const contrast = Object.entries(analysis.contrasts).find(([id]) =>
    id.startsWith("global_"),
  )?.[1];
  const v = contrast?.summary[bloc];
  return contrast && v && contrast.sampledCount
    ? { toward: v.toward, away: v.away, sampled: contrast.sampledCount }
    : null;
}

/** Candidate-level signal from the global contrast. Older artifacts without candidate data return null. */
export function candidateSignal(analysis: AnalysisArtifact | null, candidateId: string) {
  if (!analysis) return null;
  const contrast = Object.entries(analysis.contrasts).find(([id]) => id.startsWith("global_"))?.[1];
  const value = contrast?.candidateSummary?.[candidateId];
  return contrast && value && contrast.sampledCount
    ? { toward: value.toward, away: value.away, sampled: contrast.sampledCount }
    : null;
}
