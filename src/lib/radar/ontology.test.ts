import { describe, expect, it } from "vitest";
import { enrichNemotronRow, matchesFilter, filterSchema } from "./ontology";

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
});
