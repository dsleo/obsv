import { z } from "zod";

// Public, browser-safe contract of one offline analysis artifact
// (data/generated/analyses/<eventId>.json). Per-persona responses never leave the pipeline.
export const ANALYSIS_SCHEMA_VERSION = 2;

const scenarioSchema = z.object({
  intervention: z.string(),
  comparator: z.string(),
  outcomeToMeasure: z.string(),
  reason: z.string().optional(),
});
const segmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mechanism: z.string(),
  reason: z.string(),
  all: z.array(z.string()),
  any: z.array(z.string()),
  none: z.array(z.string()),
  membershipGaps: z.array(z.string()),
  measurementNeeds: z.array(z.string()),
  count: z.number(),
  distinctCommunes: z.number(),
  status: z.enum([
    "filterable_discovery_sample",
    "insufficient_sample",
    "incomplete_membership",
    "invalid_filter",
  ]),
  issue: z.string().optional(),
  repairs: z.array(z.string()).optional(),
  counterfactual: scenarioSchema,
});
const directionCounts = z.object({
  toward: z.number(),
  away: z.number(),
  noClearChange: z.number(),
});
const candidateDirectionCounts = z.object({
  toward: z.number(),
  away: z.number(),
  noClearChange: z.number(),
});
const contrastSchema = z.object({
  segmentId: z.string(),
  segmentName: z.string(),
  matchedCount: z.number(),
  sampledCount: z.number(),
  evidenceGrade: z.string(),
  comparator: z.string(),
  summary: z.record(z.string(), directionCounts),
  candidateSummary: z.record(z.string(), candidateDirectionCounts).optional(),
  note: z.string(),
  // Method v2 (radar-probabilistic-v2): effect in probability points (-1..1) per bloc and abstention, bootstrap 95% interval, stable = same sign across independent runs.
  runs: z.number().optional(),
  mechanisms: z.array(z.string()).optional(),
  effect: z
    .record(
      z.string(),
      z.object({
        mean: z.number(),
        lo: z.number(),
        hi: z.number(),
        stable: z.boolean(),
      }),
    )
    .optional(),
  // Candidate-level effect in probability points; bloc-level `effect` remains for
  // compatibility with existing backtests and downstream tooling.
  candidateEffect: z
    .record(
      z.string(),
      z.object({
        mean: z.number(),
        lo: z.number(),
        hi: z.number(),
        stable: z.boolean(),
      }),
    )
    .optional(),
  // Event vs its close alternative scenario (what in the event matters), same shape as `effect`; interpretive, not backtestable.
  altEffect: z
    .record(
      z.string(),
      z.object({
        mean: z.number(),
        lo: z.number(),
        hi: z.number(),
        stable: z.boolean(),
      }),
    )
    .optional(),
});

export const analysisArtifactSchema = z.object({
  schemaVersion: z.literal(ANALYSIS_SCHEMA_VERSION),
  eventId: z.string(),
  methodVersion: z.string(),
  model: z.string(),
  ontologyVersion: z.string(),
  inputHash: z.string(),
  eventInputHash: z.string().optional(),
  computedAt: z.string(),
  evidenceGrade: z.literal("hypothesis"),
  demo: z.boolean().optional(),
  index: z.object({ frame: z.string(), rowCount: z.number() }),
  alternative: z
    .object({ description: z.string(), whatChanges: z.string() })
    .optional(),
  segments: z.array(segmentSchema),
  globalScenarios: z.array(scenarioSchema),
  contrasts: z.record(z.string(), contrastSchema),
  note: z.string(),
  // Automatically generated artifacts carry an integrity hash and current event-input digest.
  review: z.object({
    status: z.enum(["pending", "automatic", "approved"]),
    reviewer: z.string().optional(),
    reviewedAt: z.string().optional(),
    contentHash: z.string().optional(),
  }),
});
export type AnalysisArtifact = z.infer<typeof analysisArtifactSchema>;
