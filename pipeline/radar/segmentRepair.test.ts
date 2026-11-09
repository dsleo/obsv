import { describe, expect, it } from "vitest";
import { contentWords, globalScenario, jaccard, lacksEventSpecificity, narrowings, relaxations, sharedWords, templateScenario } from "./segmentRepair";

const event = { title: "Attentat raciste à Trappes : Lecornu dénonce les mots", description: "Un mort et cinq blessés après une attaque à Trappes, dans les Yvelines." };

describe("segmentRepair", () => {
  it("extracts accent-insensitive content words", () => {
    const words = contentWords("Les Retraités des villes, à Orléans");
    expect(words.has("retraite")).toBe(true); // accents and plural removed
    expect(words.has("orlean")).toBe(true);
    expect(words.has("les")).toBe(false);
  });
  it("counts shared words", () => {
    expect(sharedWords("attaque à Trappes", event.description)).toEqual(expect.arrayContaining(["attaque", "trappe"]));
  });
  it("rejects stock archetypes without event link, keeps others", () => {
    const generic = { all: ["cluster.modest_wage_earner"], any: [], name: "Salariés modestes", mechanism: "Pouvoir d’achat" } as never;
    expect(lacksEventSpecificity(generic, event)).toBe(true);
    expect(lacksEventSpecificity({ ...(generic as object), mechanism: "Habitants proches de Trappes" } as never, event)).toBe(false);
    expect(lacksEventSpecificity({ all: ["cluster.single_mother"], any: [], name: "Mères seules", mechanism: "x" } as never, event)).toBe(false);
  });
  it("builds the per-event counterfactual template from the title", () => {
    expect(templateScenario(event)).toEqual({ intervention: event.title, comparator: "L’événement n’a pas lieu ou n’est pas relayé dans les médias", outcomeToMeasure: "intention de vote par bloc et abstention" });
  });
  it("builds one global scenario from the title", () => {
    expect(globalScenario(event).intervention).toBe(event.title);
  });
  it("computes jaccard of sorted index arrays", () => {
    expect(jaccard([1, 2, 3, 4], [1, 2, 3, 4])).toBe(1);
    expect(jaccard([1, 2], [3, 4])).toBe(0);
  });
  it("relaxes none, then all tags, then clusters; narrows by adding a tag", () => {
    const steps = [...relaxations({ all: ["age.18_24", "geo.dense"], any: [], none: ["occupation.worker"] })];
    expect(steps[0].filter.none).toEqual([]);
    expect(steps[1].filter.all).toEqual(["age.18_24"]);
    expect(steps.some((s) => s.filter.all[0]?.startsWith("cluster."))).toBe(true);
    expect(narrowings({ all: ["geo.dense"], any: [], none: [] }).every((n) => !n.filter.all.slice(1).some((id) => id.startsWith("geo.")))).toBe(true);
  });
});
