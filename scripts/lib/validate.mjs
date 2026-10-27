import { readFileSync } from "node:fs";

const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;
const POLL_ROUNDS = ["first", "runoff"];
const EDITORIAL = ["draft", "reviewed", "published", "retracted"];
const SHARE_TOLERANCE = 1; // rounded shares may sum slightly above 100

export const FEEDS = {
  polls: ["id", "publishedAt", "pollster", "sampleSize", "candidateShares", "source"],
  events: ["id", "occurredAt", "title", "summary", "sources"],
};

// Optional allow-list: data/candidates.json = { "candidates": ["lepen", ...] }
export function loadKnownCandidates(file = "data/candidates.json") {
  try { return new Set(JSON.parse(readFileSync(file, "utf8")).candidates); } catch { return null; }
}

const isDate = (v) => typeof v === "string" && ISO.test(v) && !Number.isNaN(Date.parse(v));
const isUrl = (v) => { try { return ["http:", "https:"].includes(new URL(v).protocol); } catch { return false; } };

function checkSource(source, label, issues) {
  if (!source || typeof source !== "object" || !isUrl(source.url)) issues.push(`${label}.url must be an http(s) URL`);
  if (!source?.title) issues.push(`${label}.title is required`);
}

function checkPoll(row, p, issues, known) {
  if (!isDate(row.publishedAt)) issues.push(`${p}.publishedAt must be ISO 8601`);
  for (const f of ["fieldworkStart", "fieldworkEnd"]) if (row[f] != null && !isDate(row[f])) issues.push(`${p}.${f} must be ISO 8601`);
  if (!Number.isInteger(row.sampleSize) || row.sampleSize <= 0) issues.push(`${p}.sampleSize must be a positive integer`);
  if (row.round != null && !POLL_ROUNDS.includes(row.round)) issues.push(`${p}.round must be one of ${POLL_ROUNDS.join(", ")}`);
  const shares = row.candidateShares;
  if (!shares || typeof shares !== "object" || Array.isArray(shares) || !Object.keys(shares).length) {
    issues.push(`${p}.candidateShares must be a non-empty object`);
  } else {
    let sum = 0;
    for (const [id, v] of Object.entries(shares)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) issues.push(`${p}.candidateShares.${id} must be a number in [0, 100]`);
      else sum += v;
      if (known && !known.has(id)) issues.push(`${p}.candidateShares.${id} is not a known candidate id`);
    }
    if (sum > 100 + SHARE_TOLERANCE) issues.push(`${p}.candidateShares sums to ${sum} (> 100)`);
  }
  if (row.source != null) checkSource(row.source, `${p}.source`, issues);
}

function checkEvent(row, p, issues) {
  if (!isDate(row.occurredAt)) issues.push(`${p}.occurredAt must be ISO 8601`);
  if (row.editorialStatus != null && !EDITORIAL.includes(row.editorialStatus)) issues.push(`${p}.editorialStatus must be one of ${EDITORIAL.join(", ")}`);
  if (!Array.isArray(row.sources) || !row.sources.length) issues.push(`${p}.sources must be a non-empty array`);
  else row.sources.forEach((s, i) => checkSource(s, `${p}.sources[${i}]`, issues));
}

/** Validate a parsed feed payload. Returns { rows, issues }. */
export function validateFeed(name, payload, { knownCandidates = null } = {}) {
  const issues = [];
  if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload[name])) {
    return { rows: [], issues: [`${name}.json must contain schemaVersion: 1 and an array named ${name}`] };
  }
  const ids = new Set();
  for (const [index, row] of payload[name].entries()) {
    const p = `${name}[${index}]`;
    if (!row || typeof row !== "object") { issues.push(`${p} must be an object`); continue; }
    for (const f of FEEDS[name]) if (row[f] == null || row[f] === "") issues.push(`${p}.${f} is required`);
    if (typeof row.id === "string" && row.id) {
      if (ids.has(row.id)) issues.push(`${p} duplicates id ${row.id}`);
      ids.add(row.id);
    }
    (name === "polls" ? checkPoll : checkEvent)(row, p, issues, knownCandidates);
  }
  return { rows: payload[name], issues };
}
