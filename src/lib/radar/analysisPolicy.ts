export const PINNED_ANALYSIS_MODEL = "gpt-4.1-mini-2025-04-14";
export const PUBLIC_ANALYSIS_METHOD = "radar-probabilistic-v2";
export const isProductionReviewer = (name: string | undefined) =>
  Boolean(name?.trim() && !/debug|bulk.approval|test.fixture|demo|automatic/i.test(name));
