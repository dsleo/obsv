import { describe, expect, it } from "vitest";
import { calibrateElectionCell, calibrateElectionShares } from "./calibration";

describe("registered-elector probability calibration", () => {
  it("matches local counts while retaining survey-prior heterogeneity", () => {
    const rows = [
      { personaId: "left-leaning", communeCode: "12345", registeredWeight: 60, probabilities: { abstention: 0.1, blank_null: 0.05, left: 0.75, right: 0.1 } },
      { personaId: "right-leaning", communeCode: "12345", registeredWeight: 40, probabilities: { abstention: 0.1, blank_null: 0.05, left: 0.1, right: 0.75 } },
    ];
    const result = calibrateElectionCell(rows, { electionId: "2024_euro_t1", communeCode: "12345", registered: 100, counts: { abstention: 20, blank_null: 5, left: 35, right: 40 } });
    for (const [option, target] of Object.entries({ abstention: 20, blank_null: 5, left: 35, right: 40 })) {
      expect(result.rows.reduce((sum, row) => sum + row.registeredWeight * row.calibrated[option], 0)).toBeCloseTo(target, 5);
    }
    expect(result.rows[0].calibrated.left).toBeGreaterThan(result.rows[1].calibrated.left);
    expect(result.maxCountResidual).toBeLessThan(1e-5);
  });

  it("refuses to equate adult rows with registered voters", () => {
    expect(() => calibrateElectionCell([
      { personaId: "a", communeCode: "12345", registeredWeight: 1, probabilities: { abstention: 0.2, blank_null: 0.1, left: 0.7 } },
      { personaId: "b", communeCode: "12345", registeredWeight: 1, probabilities: { abstention: 0.2, blank_null: 0.1, left: 0.7 } },
    ], { electionId: "x", communeCode: "12345", registered: 100, counts: { abstention: 20, blank_null: 10, left: 70 } })).toThrow(/registered persona weights/i);
  });

  it("fits shares with equal representation while preserving between-person log odds", () => {
    const rows = [
      { personaId: "a", probabilities: { abstention: 0.1, blank_null: 0.05, left: 0.7, right: 0.15 } },
      { personaId: "b", probabilities: { abstention: 0.1, blank_null: 0.05, left: 0.15, right: 0.7 } },
    ];
    const result = calibrateElectionShares(rows, { abstention: 0.2, blank_null: 0.05, left: 0.45, right: 0.3 }, "region", "2022_pres_t1");
    expect(result.rows[0].calibrated.left).toBeGreaterThan(result.rows[1].calibrated.left);
    for (const [option, target] of Object.entries({ abstention: 0.2, blank_null: 0.05, left: 0.45, right: 0.3 })) {
      expect((result.rows[0].calibrated[option] + result.rows[1].calibrated[option]) / 2).toBeCloseTo(target, 7);
    }
    const logOddsDifference = (vectors: Record<string, number>[]) =>
      Math.log(vectors[0].left / vectors[0].right) - Math.log(vectors[1].left / vectors[1].right);
    expect(logOddsDifference(result.rows.map((row) => row.calibrated))).toBeCloseTo(logOddsDifference(rows.map((row) => row.probabilities)), 8);
  });
});
