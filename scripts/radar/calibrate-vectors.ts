import { createReadStream, createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import readline from "node:readline";
import { calibrateElectionCell, calibrateRegisteredMass, type ElectionMargin } from "../../src/lib/radar/calibration";

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index < 0 ? "" : process.argv[index + 1] ?? "";
}
const priorsPath = arg("--priors");
const marginsPath = arg("--margins");
const outputPath = arg("--out");
if (!priorsPath || !marginsPath || !outputPath) throw new Error("Usage: tsx scripts/radar/calibrate-vectors.ts --priors survey-priors.jsonl --margins data/radar/margins/2024_euro_t1.jsonl --out vectors.jsonl");

type PriorInput = {
  personaId: string;
  communeCode: string;
  adultPopulationWeight: number;
  eligibilityRegistrationProbability: number;
  probabilities: Record<string, number>;
  priorSource: string;
  priorModelVersion: string;
};

async function* jsonLines<T>(file: string): AsyncGenerator<T> {
  const stream = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of stream) if (line.trim()) yield JSON.parse(line) as T;
}

const byCommune = new Map<string, PriorInput[]>();
for await (const prior of jsonLines<PriorInput>(priorsPath)) {
  if (!prior.priorSource || !prior.priorModelVersion || !prior.communeCode || !prior.personaId) throw new Error("Prior lacks source, version, commune, or persona ID");
  if (/nemotron|synthetic|llm/i.test(prior.priorSource)) throw new Error("A synthetic/LLM-only source is not an admissible human vote prior");
  const rows = byCommune.get(prior.communeCode) ?? [];
  rows.push(prior);
  byCommune.set(prior.communeCode, rows);
}

const output = createWriteStream(outputPath, { encoding: "utf8" });
const qa = { calibratedCommunes: 0, skippedCommunes: 0, skipped: {} as Record<string, number>, maxResidual: 0, minEffectiveRows: Infinity };
for await (const margin of jsonLines<ElectionMargin & { voteVectorEligible?: boolean }>(marginsPath)) {
  if (margin.voteVectorEligible === false) {
    qa.skippedCommunes += 1;
    qa.skipped.vote_vector_ineligible = (qa.skipped.vote_vector_ineligible ?? 0) + 1;
    continue;
  }
  const priors = byCommune.get(margin.communeCode) ?? [];
  if (priors.length < 30) {
    qa.skippedCommunes += 1;
    qa.skipped.too_few_personas = (qa.skipped.too_few_personas ?? 0) + 1;
    continue;
  }
  try {
    const registered = calibrateRegisteredMass(priors.map((prior) => ({
      personaId: prior.personaId, adultPopulationWeight: prior.adultPopulationWeight,
      eligibilityRegistrationProbability: prior.eligibilityRegistrationProbability,
    })), margin.registered);
    const weightById = new Map(registered.map((row) => [row.personaId, row.registeredWeight]));
    const result = calibrateElectionCell(priors.map((prior) => ({
      personaId: prior.personaId, communeCode: prior.communeCode,
      registeredWeight: weightById.get(prior.personaId)!, probabilities: prior.probabilities,
    })), margin);
    if (result.effectiveRows < 20) throw new Error("effective sample support below 20");
    for (const row of result.rows) {
      const line = { electionId: margin.electionId, communeCode: margin.communeCode,
        personaId: row.personaId, registeredWeight: row.registeredWeight,
        probabilities: row.calibrated, priorSource: priors[0].priorSource,
        priorModelVersion: priors[0].priorModelVersion, calibration: "KL local exact v1" };
      if (!output.write(`${JSON.stringify(line)}\n`)) await new Promise<void>((resolve) => output.once("drain", resolve));
    }
    qa.calibratedCommunes += 1;
    qa.maxResidual = Math.max(qa.maxResidual, result.maxCountResidual);
    qa.minEffectiveRows = Math.min(qa.minEffectiveRows, result.effectiveRows);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    qa.skippedCommunes += 1;
    qa.skipped[reason] = (qa.skipped[reason] ?? 0) + 1;
  }
}
await new Promise<void>((resolve) => output.end(resolve));
await writeFile(`${outputPath}.qa.json`, JSON.stringify({ ...qa, minEffectiveRows: Number.isFinite(qa.minEffectiveRows) ? qa.minEffectiveRows : null }, null, 2));
process.stdout.write(`${JSON.stringify(qa)}\n`);
