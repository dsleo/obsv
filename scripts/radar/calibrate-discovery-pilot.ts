/** Diagnostic regional 2022 calibration on the 2,000-row discovery sample.
 * Equal persona weights are an internal arithmetic convention, not electorate weights.
 */
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import readline from "node:readline";
import { calibrateElectionShares } from "../../src/lib/radar/calibration";

const arg = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1] ?? fallback;
};
const indexPath = arg("--index", "data/radar/personas.jsonl");
const marginsPath = arg("--margins", "data/radar/margins/2022_pres_t1.jsonl");
const departmentsPath = arg("--departments", "data/radar/raw/v_departement_2026.csv");
const outputPath = arg("--out", "data/radar/2022-regional-calibration-pilot.jsonl");
const weightsPath = arg("--weights", "");

async function* lines(path: string) {
  const reader = readline.createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of reader) if (line.trim()) yield line;
}

const departmentRegion = new Map<string, string>();
for await (const line of lines(departmentsPath)) {
  const cells = line.replace(/\r/g, "").split(",").map((cell) => cell.replace(/^"|"$/g, ""));
  if (cells[0] !== "DEP") departmentRegion.set(cells[0], cells[1]);
}

type Persona = { id: string; geography: { departmentCode: string }; historicalPropensity?: {
  electionId: string; modelVersion: string; probabilities: Record<string, number>;
} };
const populationWeights = new Map<string, number>();
if (weightsPath) for await (const line of lines(weightsPath)) {
  const row = JSON.parse(line) as { personaId: string; adultPopulationWeight: number };
  if (!Number.isFinite(row.adultPopulationWeight) || row.adultPopulationWeight < 0) throw new Error("Invalid adult population weight");
  populationWeights.set(row.personaId, row.adultPopulationWeight);
}
const personas = new Map<string, Persona[]>();
let missingPrior = 0;
for await (const line of lines(indexPath)) {
  const persona = JSON.parse(line) as Persona;
  const region = departmentRegion.get(persona.geography.departmentCode);
  if (!region || !persona.historicalPropensity || persona.historicalPropensity.electionId !== "2022_pres_t1") {
    missingPrior += 1;
    continue;
  }
  const group = personas.get(region) ?? [];
  group.push(persona);
  personas.set(region, group);
}

const counts = new Map<string, Record<string, number>>();
const registered = new Map<string, number>();
for await (const line of lines(marginsPath)) {
  const margin = JSON.parse(line) as { departmentCode: string; voteVectorEligible?: boolean;
    registered: number; counts: Record<string, number> };
  if (margin.voteVectorEligible === false) continue;
  const region = departmentRegion.get(margin.departmentCode);
  if (!region || region.startsWith("0")) continue;
  const totals = counts.get(region) ?? {};
  for (const [choice, value] of Object.entries(margin.counts)) totals[choice] = (totals[choice] ?? 0) + value;
  counts.set(region, totals);
  registered.set(region, (registered.get(region) ?? 0) + margin.registered);
}

const outputs: string[] = [];
const qa: { scope: string; interpretation: string; calibratedRegions: number; calibratedPersonas: number;
  missingPrior: number; skipped: Record<string, string>; regions: Record<string, unknown> } = {
  scope: "2022 regional discovery-sample diagnostic", interpretation: weightsPath
    ? "Exact regional margins on age-sex-region poststratified synthetic adults; not registered-elector or individual vote estimates"
    : "Exact regional margins on equal-weight synthetic rows; not population or individual vote estimates",
  calibratedRegions: 0, calibratedPersonas: 0, missingPrior, skipped: {}, regions: {},
};
for (const [region, group] of personas) {
  const total = registered.get(region);
  const observed = counts.get(region);
  if (!total || !observed || group.length < 30) {
    qa.skipped[region] = `unsupported: ${group.length} personas`;
    continue;
  }
  const shares = Object.fromEntries(Object.entries(observed).map(([choice, count]) => [choice, count / total]));
  try {
    if (weightsPath && group.some((persona) => !populationWeights.get(persona.id))) throw new Error("Missing or zero population weight");
    const result = calibrateElectionShares(group.map((persona) => ({
      personaId: persona.id, probabilities: persona.historicalPropensity!.probabilities,
      representationWeight: weightsPath ? populationWeights.get(persona.id) : undefined,
    })), shares, region, "2022_pres_t1");
    if (result.effectiveRows < 20) throw new Error(`effective support below 20: ${result.effectiveRows.toFixed(1)}`);
    let maxKl = 0;
    let meanKl = 0;
    let maxProbabilityChange = 0;
    const priorMean: Record<string, number> = {};
    const totalPopulationWeight = result.rows.reduce((sum, row) => sum + row.registeredWeight, 0);
    for (let i = 0; i < group.length; i += 1) {
      const prior = group[i].historicalPropensity!.probabilities;
      const calibrated = result.rows[i].calibrated;
      let kl = 0;
      for (const [choice, q] of Object.entries(calibrated)) {
        priorMean[choice] = (priorMean[choice] ?? 0) + prior[choice] * result.rows[i].registeredWeight / totalPopulationWeight;
        if (q > 0) kl += q * Math.log(q / Math.max(prior[choice], 1e-12));
        maxProbabilityChange = Math.max(maxProbabilityChange, Math.abs(q - prior[choice]));
      }
      maxKl = Math.max(maxKl, kl);
      meanKl += kl / group.length;
      outputs.push(JSON.stringify({ personaId: group[i].id, electionId: "2022_pres_t1", scope: weightsPath
        ? "region_adult_poststratification_diagnostic" : "region_equal_weight_diagnostic",
        regionCode: region, priorModelVersion: group[i].historicalPropensity!.modelVersion,
        representationWeight: result.rows[i].registeredWeight / totalPopulationWeight, probabilities: calibrated }));
    }
    qa.regions[region] = { personas: group.length, maxShareResidual: result.maxCountResidual / group.length,
      priorMaxShareResidual: Math.max(...Object.keys(shares).map((choice) => Math.abs((priorMean[choice] ?? 0) - shares[choice]))),
      meanKl, maxKl, maxProbabilityChange, effectiveRows: result.effectiveRows };
    qa.calibratedRegions += 1;
    qa.calibratedPersonas += group.length;
  } catch (error) {
    qa.skipped[region] = error instanceof Error ? error.message : String(error);
  }
}
await writeFile(outputPath, outputs.join("\n") + (outputs.length ? "\n" : ""));
await writeFile(`${outputPath}.qa.json`, JSON.stringify(qa, null, 2));
process.stdout.write(`${JSON.stringify(qa)}\n`);
