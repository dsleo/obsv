/** Entropy projection of survey-informed persona priors onto observed local results.
 * All masses below refer to registered electors in the election's franchise.
 * Demographic and registration weights must be estimated upstream.
 */
export type PriorRow = {
  personaId: string;
  communeCode: string;
  registeredWeight: number;
  probabilities: Record<string, number>;
};
export type ElectionMargin = {
  communeCode: string;
  electionId: string;
  registered: number;
  counts: Record<string, number>; // includes abstention and blank/null
};
export type CalibratedRow = PriorRow & { calibrated: Record<string, number> };
export type CalibrationResult = {
  rows: CalibratedRow[];
  maxCountResidual: number;
  iterations: number;
  effectiveRows: number;
  electionId: string;
  communeCode: string;
};

/** Minimum-KL projection of persona probabilities onto an observed share vector.
 * Representation weights are optional and normalized within the cell. Equal
 * weights describe the supplied synthetic rows, not the real electorate. */
export function calibrateElectionShares(
  rows: Array<{ personaId: string; probabilities: Record<string, number>; representationWeight?: number }>,
  targetShares: Record<string, number>,
  cellId: string,
  electionId: string,
): CalibrationResult {
  if (rows.length < 2) throw new Error("At least two persona rows are required");
  const weights = rows.map((row) => row.representationWeight ?? 1);
  weights.forEach((weight) => checkFinitePositive(weight, "representationWeight"));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const shareTotal = Object.values(targetShares).reduce((sum, share) => sum + share, 0);
  if (Math.abs(shareTotal - 1) > 1e-6) throw new Error("Target shares must sum to one");
  const mass = rows.length;
  return calibrateElectionCell(
    rows.map((row, index) => ({ personaId: row.personaId, communeCode: cellId,
      registeredWeight: weights[index] * mass / totalWeight, probabilities: row.probabilities })),
    { communeCode: cellId, electionId, registered: mass,
      counts: Object.fromEntries(Object.entries(targetShares).map(([option, share]) => [option, share * mass])) },
  );
}

export type ElectorMassInput = {
  personaId: string;
  adultPopulationWeight: number;
  eligibilityRegistrationProbability: number;
};

/** The upstream eligibility model is required; local registration totals only
 * rescale its expected elector masses and cannot identify individual status. */
export function calibrateRegisteredMass(rows: ElectorMassInput[], officialRegistered: number) {
  checkFinitePositive(officialRegistered, "official registered count");
  const initial = rows.map((row) => {
    checkFinitePositive(row.adultPopulationWeight, "adultPopulationWeight");
    if (!Number.isFinite(row.eligibilityRegistrationProbability) || row.eligibilityRegistrationProbability < 0 || row.eligibilityRegistrationProbability > 1) {
      throw new Error("Invalid eligibility/registration probability");
    }
    return row.adultPopulationWeight * row.eligibilityRegistrationProbability;
  });
  const total = initial.reduce((sum, mass) => sum + mass, 0);
  checkFinitePositive(total, "initial eligible/registered mass");
  return rows.map((row, index) => ({ personaId: row.personaId, registeredWeight: initial[index] * officialRegistered / total }));
}

function checkFinitePositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite`);
}

function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let j = 0; j < n; j += 1) {
    let pivot = j;
    for (let i = j + 1; i < n; i += 1) if (Math.abs(a[i][j]) > Math.abs(a[pivot][j])) pivot = i;
    if (Math.abs(a[pivot][j]) < 1e-14) throw new Error("Calibration Hessian is singular");
    [a[j], a[pivot]] = [a[pivot], a[j]];
    const scale = a[j][j];
    for (let k = j; k <= n; k += 1) a[j][k] /= scale;
    for (let i = 0; i < n; i += 1) {
      if (i === j) continue;
      const factor = a[i][j];
      for (let k = j; k <= n; k += 1) a[i][k] -= factor * a[j][k];
    }
  }
  return a.map((row) => row[n]);
}

export function calibrateElectionCell(rows: PriorRow[], margin: ElectionMargin, tolerance = 1e-8): CalibrationResult {
  checkFinitePositive(margin.registered, "registered count");
  if (rows.length < 2) throw new Error("At least two supported persona rows are required for a local cell");
  const options = Object.keys(margin.counts).sort();
  if (options.length < 2 || !options.includes("abstention") || !options.includes("blank_null")) {
    throw new Error("Margins must include election choices, abstention, and blank_null");
  }
  for (const option of options) if (!Number.isFinite(margin.counts[option]) || margin.counts[option] < 0) throw new Error(`Invalid count: ${option}`);
  const observedTotal = options.reduce((sum, option) => sum + margin.counts[option], 0);
  if (Math.abs(observedTotal - margin.registered) > Math.max(1, margin.registered * 1e-6)) {
    throw new Error("Observed counts do not sum to registered electors");
  }
  const mass = rows.reduce((sum, row) => {
    if (row.communeCode !== margin.communeCode) throw new Error("Mixed commune codes in calibration cell");
    checkFinitePositive(row.registeredWeight, "registeredWeight");
    for (const option of options) {
      const probability = row.probabilities[option];
      if (!Number.isFinite(probability) || probability < 0) throw new Error(`Invalid prior probability: ${option}`);
    }
    const sumP = options.reduce((sum, option) => sum + row.probabilities[option], 0);
    if (Math.abs(sumP - 1) > 1e-6) throw new Error("Prior vector must sum to one over the observed election choices");
    return sum + row.registeredWeight;
  }, 0);
  if (Math.abs(mass - margin.registered) > Math.max(1e-6, margin.registered * 1e-6)) {
    throw new Error("Registered persona weights must match the official count before vote calibration");
  }
  const active = options.filter((option) => margin.counts[option] > 0);
  if (active.length < 2) throw new Error("At least two observed outcomes are required");
  const d = active.length - 1; // last log multiplier fixed to zero
  const lambda = Array(d).fill(0) as number[];
  const evaluate = (parameters: number[]) => {
    const vectors = rows.map((row) => {
      const logits = active.map((option, k) => Math.log(Math.max(row.probabilities[option], 1e-9)) + (k < d ? parameters[k] : 0));
      const top = Math.max(...logits);
      const exp = logits.map((value) => Math.exp(value - top));
      const normalizer = exp.reduce((sum, value) => sum + value, 0);
      return exp.map((value) => value / normalizer);
    });
    const totals = active.map((_, k) => rows.reduce((sum, row, i) => sum + row.registeredWeight * vectors[i][k], 0));
    const maxResidual = Math.max(...active.map((option, k) => Math.abs(totals[k] - margin.counts[option])));
    const objective = rows.reduce((sum, row, i) => {
      const logZ = Math.log(active.reduce((z, option, k) => z + Math.max(row.probabilities[option], 1e-9) * Math.exp((k < d ? parameters[k] : 0) - Math.max(0, ...parameters)), 0)) + Math.max(0, ...parameters);
      return sum + row.registeredWeight * logZ;
    }, 0) - active.slice(0, d).reduce((sum, option, k) => sum + margin.counts[option] * parameters[k], 0);
    return { vectors, totals, maxResidual, objective };
  };
  let state = evaluate(lambda);
  let iterations = 0;
  const targetTolerance = Math.max(tolerance, margin.registered * tolerance);
  while (state.maxResidual > targetTolerance && iterations < 100) {
    const hessian = Array.from({ length: d }, () => Array(d).fill(0) as number[]);
    for (let i = 0; i < rows.length; i += 1) {
      const vector = state.vectors[i];
      for (let a = 0; a < d; a += 1) for (let b = 0; b < d; b += 1) {
        hessian[a][b] += rows[i].registeredWeight * vector[a] * ((a === b ? 1 : 0) - vector[b]);
      }
    }
    for (let j = 0; j < d; j += 1) hessian[j][j] += 1e-10;
    const gradient = active.slice(0, d).map((option, k) => state.totals[k] - margin.counts[option]);
    const step = solveLinear(hessian, gradient);
    let scale = 1;
    let candidate = state;
    while (scale >= 1 / 1024) {
      const trial = evaluate(lambda.map((value, k) => value - scale * step[k]));
      if (trial.objective < state.objective || trial.maxResidual < state.maxResidual) {
        candidate = trial;
        break;
      }
      scale /= 2;
    }
    if (candidate === state) break;
    for (let k = 0; k < d; k += 1) lambda[k] -= scale * step[k];
    state = candidate;
    iterations += 1;
  }
  if (state.maxResidual > targetTolerance) throw new Error(`Calibration did not converge: residual ${state.maxResidual}`);
  const calibrated = rows.map((row, i) => ({
    ...row,
    calibrated: Object.fromEntries(options.map((option) => [option, 0]).concat(active.map((option, k) => [option, state.vectors[i][k]]))),
  }));
  const squaredWeights = rows.reduce((sum, row) => sum + row.registeredWeight ** 2, 0);
  return {
    rows: calibrated, maxCountResidual: state.maxResidual, iterations,
    effectiveRows: mass ** 2 / squaredWeights, electionId: margin.electionId, communeCode: margin.communeCode,
  };
}
