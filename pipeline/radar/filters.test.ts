import { describe, expect, it } from "vitest";
import { normalizeFilter, pruneSpuriousGaps, splitMeasurementGaps } from "./filters";

describe("normalizeFilter", () => {
  it("turns two required tags of one family into a union", () => {
    const out = normalizeFilter({ all: ["age.35_49", "age.50_64", "household.couple_with_children", "geo.dense"], any: [], none: [] });
    expect(out.error).toBeUndefined();
    expect(out.all).toEqual(["household.couple_with_children", "geo.dense"]);
    expect(out.any).toEqual(["age.35_49", "age.50_64"]);
    expect(out.repairs).toHaveLength(1);
  });

  it("merges a required tag with a same-family tag of `any`", () => {
    const out = normalizeFilter({ all: ["age.18_24", "geo.dense"], any: ["age.25_34"], none: ["occupation.retired"] });
    expect(out.all).toEqual(["geo.dense"]);
    expect(out.any).toEqual(["age.18_24", "age.25_34"]);
    expect(out.none).toEqual(["occupation.retired"]);
  });

  it("leaves a valid filter untouched, including an `any` union inside one family", () => {
    const input = { all: ["occupation.retired", "geo.dense"], any: ["education.no_diploma", "education.baccalaureate"], none: [] };
    expect(normalizeFilter(input)).toEqual({ ...input, repairs: [] });
  });

  it("does not repeat or repair multi-valued families", () => {
    const input = { all: ["cluster.young_farmer", "profession.farmer"], any: [], none: [] };
    expect(normalizeFilter(input).repairs).toEqual([]);
  });

  it("refuses to change the meaning when `any` already holds another family", () => {
    const out = normalizeFilter({ all: ["age.18_24", "age.25_34", "geo.dense"], any: ["household.single", "marital.single"], none: [] });
    expect(out.error).toMatch(/cannot be combined/);
    expect(out.all).toContain("age.18_24");
  });

  it("refuses two simultaneous unions", () => {
    const out = normalizeFilter({ all: ["occupation.employee", "occupation.worker", "age.18_24", "age.25_34"], any: [], none: [] });
    expect(out.error).toMatch(/Several unions/);
  });
});

describe("pruneSpuriousGaps", () => {
  it("drops gaps naming attributes the ontology has", () => {
    const out = pruneSpuriousGaps(["household type", "geo class (dense, intermediate, rural)", "household and marital status", "âge"]);
    expect(out.kept).toEqual([]);
    expect(out.dropped).toHaveLength(4);
  });

  it("keeps genuinely absent attributes, even next to present ones", () => {
    const out = pruneSpuriousGaps(["niveau de revenu", "pension and household type", "union membership", "vote history", "incumbent status"]);
    expect(out.dropped).toEqual([]);
    expect(out.kept).toHaveLength(5);
  });

  it("keeps vague or unknown gaps", () => {
    expect(pruneSpuriousGaps(["exposure to the policy", "profession"]).kept).toHaveLength(2);
  });
});

describe("splitMeasurementGaps", () => {
  it("moves attitude/outcome variables to measurement and keeps real membership gaps", () => {
    const r = splitMeasurementGaps(["attitude envers l'alliance politique", "niveau_de_revenu_agricole", "perception du revenu des retraités"]);
    expect(r.measurement).toEqual(["attitude envers l'alliance politique"]);
    expect(r.gaps).toEqual(["niveau_de_revenu_agricole", "perception du revenu des retraités"]);
  });
});
