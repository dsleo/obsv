import { describe, expect, it } from "vitest";
import { enrichNemotronRow, matchesFilter, filterSchema } from "./ontology";
import { withParentGeography } from "./geography";

const raw = {
  uuid: "example", age: 71, sex: "Femme", education_level: "Bac+5",
  occupation: "Retraités", household_type: "Personne seule",
  commune: "Coise", departement: "Rhône",
  professional_persona: "Ancienne professeure d'université, elle est aujourd'hui retraitée.",
  persona: "Une ancienne universitaire.",
};

describe("electoral tag ontology", () => {
  it("uses exact conjunction and excludes unaudited narrative tags by default", () => {
    const persona = enrichNemotronRow(raw, { communeCode: "69062", departmentCode: "69", density: "rural", sourceYear: 2026 });
    const filter = filterSchema.parse({ all: ["occupation.retired", "former_profession.university_professor", "geo.rural"], any: [], none: [] });
    expect(matchesFilter(persona, filter)).toBe(false);
    expect(matchesFilter(persona, filter, ["direct", "derived", "official_geo", "narrative_rule"])).toBe(true);
    expect(persona.tags.find((tag) => tag.id === "former_profession.university_professor")?.source).toBe("narrative_rule");
  });

  it("does not equate a broad self-employment category with profession libérale", () => {
    const persona = enrichNemotronRow({ ...raw, occupation: "Artisans, commerçants, chefs d'entreprise", professional_persona: "Gère une petite boutique." });
    expect(persona.tags.some((tag) => tag.id === "profession.liberal_explicit")).toBe(false);
  });

  it("rejects made-up tag IDs", () => {
    expect(() => filterSchema.parse({ all: ["income.rich"], any: [], none: [] })).toThrow();
  });

  it("does not treat a missing field as proof of a negative tag", () => {
    const persona = enrichNemotronRow({ ...raw, sex: "" });
    const filter = filterSchema.parse({ all: ["age.65_74"], any: [], none: ["sex.male"] });
    expect(matchesFilter(persona, filter)).toBe(false);
  });

  it("can exclude the closed Paris/Lyon/Marseille geography only when a commune is resolved", () => {
    const filter = filterSchema.parse({ all: ["age.65_74"], any: [], none: ["municipal_system.paris_lyon_marseille"] });
    expect(matchesFilter(enrichNemotronRow(raw, { communeCode: "69062", departmentCode: "69", density: "rural", sourceYear: 2026 }), filter)).toBe(true);
    expect(matchesFilter(enrichNemotronRow(raw), filter)).toBe(false);
  });

  const ids = (row: Record<string, unknown>) => enrichNemotronRow({ ...raw, ...row }).tags.map((tag) => tag.id);

  it("tags 'Couple sans enfant' as no children (regression: it was tagged with children)", () => {
    expect(ids({ household_type: "Couple sans enfant" })).toContain("household.couple_no_children");
    expect(ids({ household_type: "Couple sans enfant" })).not.toContain("household.couple_with_children");
    expect(ids({ household_type: "Couple avec enfant(s)" })).toContain("household.couple_with_children");
  });

  it("tags plural 'Professions intermédiaires', 'Brevet' and 'Concubinage'", () => {
    expect(ids({ occupation: "Professions intermédiaires" })).toContain("occupation.intermediate");
    expect(ids({ education_level: "Brevet" })).toContain("education.brevet");
    expect(ids({ education_level: "Sans diplôme ou CEP" })).toContain("education.no_diploma");
    expect(ids({ marital_status: "Concubinage" })).toContain("marital.cohabiting");
  });

  it("inherits density and population from the parent commune for arrondissements", () => {
    const parent = { communeCode: "13055", departmentCode: "13", density: "dense" as const, sourceYear: 2026, population2023: 870000 };
    const arrondissement = { communeCode: "13213", departmentCode: "13", density: null, sourceYear: 2026, population2023: null, parentCommuneCode: "13055" };
    const geo = withParentGeography(arrondissement, new Map([[parent.communeCode, parent]]));
    expect(geo).toMatchObject({ density: "dense", population2023: 870000 });
    const tagIds = enrichNemotronRow(raw, geo).tags.map((tag) => tag.id);
    expect(tagIds).toEqual(expect.arrayContaining(["geo.dense", "commune_size.1000_plus", "municipal_system.paris_lyon_marseille"]));
  });

  it("derives named clusters and lets them be required or excluded in a filter", () => {
    const farmer = { age: 29, occupation: "Agriculteurs exploitants", professional_persona: "Exploite une ferme." };
    const young = enrichNemotronRow({ ...raw, ...farmer });
    const older = enrichNemotronRow({ ...raw, ...farmer, age: 55 });
    expect(young.tags.map((tag) => tag.id)).toContain("cluster.young_farmer");
    expect(older.tags.map((tag) => tag.id)).not.toContain("cluster.young_farmer");
    expect(matchesFilter(young, filterSchema.parse({ all: ["cluster.young_farmer"], any: [], none: [] }))).toBe(true);
    expect(matchesFilter(older, filterSchema.parse({ all: ["occupation.farmer"], any: [], none: ["cluster.young_farmer"] }))).toBe(true);
    expect(matchesFilter(young, filterSchema.parse({ all: ["occupation.farmer"], any: [], none: ["cluster.young_farmer"] }))).toBe(false);
  });
});
