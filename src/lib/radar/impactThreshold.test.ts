import { describe, expect, it } from "vitest";
import type { AnalysisArtifact } from "./analysisArtifact";
import { qualifyingSegments, qualifyingSignals, topSolde } from "./highlights";
import { impactCells } from "./impactMap";

function analysis(toward: number, away = 0, sampled = 10_000, candidateLevel = true): AnalysisArtifact {
  const scenario = { intervention: "Événement", comparator: "Sans événement", outcomeToMeasure: "Vote", reason: "Test" };
  const counts = { toward, away, noClearChange: sampled - toward - away };
  return {
    schemaVersion: 2,
    eventId: "threshold-event",
    methodVersion: "test",
    model: "test",
    ontologyVersion: "test",
    inputHash: "test",
    computedAt: "2026-11-21T00:00:00Z",
    evidenceGrade: "hypothesis",
    index: { frame: "test", rowCount: sampled },
    segments: [{
      id: "retired",
      name: "Retraités ruraux et modestes",
      mechanism: "Test",
      reason: "Test",
      all: ["occupation.retired", "geo.rural"],
      any: [],
      none: [],
      membershipGaps: [],
      measurementNeeds: [],
      count: sampled,
      distinctCommunes: 10,
      status: "filterable_discovery_sample",
      counterfactual: scenario,
    }],
    globalScenarios: [],
    contrasts: {
      retired: {
        segmentId: "retired",
        segmentName: "Retraités ruraux et modestes",
        matchedCount: sampled,
        sampledCount: sampled,
        evidenceGrade: "hypothesis",
        comparator: "Sans événement",
        summary: { right: counts },
        ...(candidateLevel ? { candidateSummary: { retailleau: counts } } : {}),
        note: "Test",
      },
    },
    note: "Test",
    review: { status: "automatic" },
  };
}

describe("the shared 5 % net-impact threshold", () => {
  it.each([200, 499])("excludes a net reaction of %i / 10,000 in both directions", (net) => {
    for (const artifact of [analysis(net), analysis(0, net)]) {
      expect(topSolde(artifact)).toBeNull();
      expect(qualifyingSegments(artifact)).toEqual([]);
      expect(impactCells(artifact)).toEqual([]);
    }
  });

  it.each([500, 501])("includes a net reaction of %i / 10,000 in both directions", (net) => {
    for (const artifact of [analysis(net), analysis(0, net)]) {
      expect(topSolde(artifact)?.share).toBe(net / 10_000);
      expect(qualifyingSegments(artifact)).toHaveLength(1);
      expect(impactCells(artifact)).toHaveLength(1);
    }
  });

  it("checks the net reaction rather than the larger directional total", () => {
    const artifact = analysis(900, 700); // +9 % toward − 7 % away = +2 % net
    expect(topSolde(artifact)).toBeNull();
    expect(impactCells(artifact)).toEqual([]);
  });

  it("also excludes low-impact legacy bloc highlights", () => {
    expect(topSolde(analysis(200, 0, 10_000, false))).toBeNull();
    expect(topSolde(analysis(500, 0, 10_000, false))?.label).toBe("Droite");
  });

  it("does not let abstention qualify a homepage candidate highlight", () => {
    const artifact = analysis(200);
    artifact.contrasts.retired.candidateSummary!.abstention = { toward: 900, away: 0, noClearChange: 9100 };
    expect(topSolde(artifact)?.candidate).toBe("abstention");
    expect(topSolde(artifact, ["abstention"])).toBeNull();
  });


  it("only displays qualifying reactions within a qualifying group", () => {
    const artifact = analysis(500);
    artifact.contrasts.retired.candidateSummary!.attal = { toward: 499, away: 0, noClearChange: 9501 };
    expect(qualifyingSignals(qualifyingSegments(artifact)[0]).map((signal) => signal.candidate)).toEqual(["retailleau"]);
  });

  it("does not publish analyses with no filterable group", () => {
    const artifact = analysis(500);
    artifact.segments = [];
    expect(qualifyingSegments(artifact)).toEqual([]);
  });

  it("handles missing analyses and empty samples", () => {
    expect(topSolde(null)).toBeNull();
    expect(impactCells(null)).toEqual([]);
    expect(topSolde(analysis(0, 0, 0))).toBeNull();
    expect(impactCells(analysis(0, 0, 0))).toEqual([]);
  });
});
