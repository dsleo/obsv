import { expect, test } from "vitest";
import { groupFamily } from "./groupFamilies";

test("families come from ontology tags, never from the segment name", () => {
  expect(groupFamily({ all: ["age.18_24", "geo.dense"], any: ["education.bac_plus_3_4"] })).toEqual({ l1: "Jeunes", l2: "Diplômés" });
  expect(groupFamily({ all: ["occupation.retired", "geo.rural"], any: [] })).toEqual({ l1: "Retraités et seniors", l2: "Retraités ruraux" });
  expect(groupFamily({ all: ["age.50_64", "occupation.worker"], any: [] })).toEqual({ l1: "Ouvriers et employés", l2: "Ouvriers" });
  expect(groupFamily({ all: ["household.single_parent", "sex.female"], any: [] })).toEqual({ l1: "Parents et familles", l2: "Familles monoparentales" });
  expect(groupFamily({ all: ["sex.male"], any: [] }).l1).toBe("Autres profils");
});
