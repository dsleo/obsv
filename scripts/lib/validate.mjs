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
  try {
    return new Set(JSON.parse(readFileSync(file, "utf8")).candidates);
  } catch {
    return null;
  }
}

const isDate = (v) =>
  typeof v === "string" &&
  ISO.test(v) &&
  !Number.isNaN(Date.parse(v)) &&
  new Date(Date.parse(v)).toISOString().slice(0, 10) === v.slice(0, 10);
const text = (v, max = 2000) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const optionalText = (row, key, p, issues, max = 2000) => {
  if (row[key] != null && !text(row[key], max))
    issues.push(`${p}.${key} must be a non-empty string (max ${max})`);
};
const isUrl = (v) => {
  try {
    return ["http:", "https:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
};

function checkSource(source, label, issues) {
  if (!source || typeof source !== "object" || !isUrl(source.url))
    issues.push(`${label}.url must be an http(s) URL`);
  if (!text(source?.title, 1000)) issues.push(`${label}.title is required`);
}

function checkPoll(row, p, issues, known) {
  if (!text(row.pollster, 200)) issues.push(`${p}.pollster must be a non-empty string`);
  if (!isDate(row.publishedAt)) issues.push(`${p}.publishedAt must be ISO 8601`);
  for (const f of ["fieldworkStart", "fieldworkEnd"])
    if (row[f] != null && !isDate(row[f])) issues.push(`${p}.${f} must be ISO 8601`);
  if (!Number.isInteger(row.sampleSize) || row.sampleSize <= 0)
    issues.push(`${p}.sampleSize must be a positive integer`);
  if (
    isDate(row.fieldworkStart) &&
    isDate(row.fieldworkEnd) &&
    row.fieldworkStart > row.fieldworkEnd
  )
    issues.push(`${p}.fieldworkStart must be before fieldworkEnd`);
  if (
    isDate(row.fieldworkEnd) &&
    isDate(row.publishedAt) &&
    row.fieldworkEnd.slice(0, 10) > row.publishedAt.slice(0, 10)
  )
    issues.push(`${p}.publishedAt must not precede fieldworkEnd`);
  if (Date.parse(row.fieldworkEnd ?? row.publishedAt) > Date.now() + 86400000)
    issues.push(`${p}.fieldworkEnd must not be in the future`);
  if (row.round != null && !POLL_ROUNDS.includes(row.round))
    issues.push(`${p}.round must be one of ${POLL_ROUNDS.join(", ")}`);
  const shares = row.candidateShares;
  if (
    !shares ||
    typeof shares !== "object" ||
    Array.isArray(shares) ||
    !Object.keys(shares).length
  ) {
    issues.push(`${p}.candidateShares must be a non-empty object`);
  } else {
    let sum = 0;
    for (const [id, v] of Object.entries(shares)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100)
        issues.push(`${p}.candidateShares.${id} must be a number in [0, 100]`);
      else sum += v;
      if (known && !known.has(id))
        issues.push(`${p}.candidateShares.${id} is not a known candidate id`);
    }
    if (sum > 100 + SHARE_TOLERANCE) issues.push(`${p}.candidateShares sums to ${sum} (> 100)`);
  }
  if (row.source != null) checkSource(row.source, `${p}.source`, issues);
}

function checkEvent(row, p, issues, known) {
  if (!isDate(row.occurredAt)) issues.push(`${p}.occurredAt must be ISO 8601`);
  if (Date.parse(row.occurredAt) > Date.now() + 86400000)
    issues.push(`${p}.occurredAt must not be in the future`);
  if (!text(row.title, 500) || !text(row.summary, 4000))
    issues.push(`${p}.title and summary must be non-empty strings within length limits`);
  if (row.editorialStatus != null && !EDITORIAL.includes(row.editorialStatus))
    issues.push(`${p}.editorialStatus must be one of ${EDITORIAL.join(", ")}`);
  if (row.importance != null && !["major", "notable"].includes(row.importance))
    issues.push(`${p}.importance must be major or notable`);
  if (
    row.category != null &&
    !/^(candidacy|primary_result|endorsement|debate|campaign_visit|judicial|proposal|statement|context:(social|security|institutional|economy|justice|disaster|international))$/.test(
      row.category,
    )
  )
    issues.push(`${p}.category is unknown`);
  if (
    row.publisherCount != null &&
    (!Number.isInteger(row.publisherCount) || row.publisherCount < 1)
  )
    issues.push(`${p}.publisherCount must be a positive integer`);
  if (row.image != null && !isUrl(row.image)) issues.push(`${p}.image must be an http(s) URL`);
  if (
    row.imageRights != null &&
    !["licensed", "permission", "unverified"].includes(row.imageRights)
  )
    issues.push(`${p}.imageRights is unknown`);
  if (!Array.isArray(row.sources) || !row.sources.length || row.sources.length > 100)
    issues.push(`${p}.sources must be a non-empty array (max 100)`);
  else row.sources.forEach((s, i) => checkSource(s, `${p}.sources[${i}]`, issues));
  if (row.articles != null) {
    if (!Array.isArray(row.articles) || row.articles.length > 100)
      issues.push(`${p}.articles must be an array (max 100)`);
    else
      row.articles.forEach((a, i) => {
        const key = `${p}.articles[${i}]`;
        checkSource(a, key, issues);
        if (a?.publisher != null && (typeof a.publisher !== "string" || a.publisher.length > 300))
          issues.push(`${key}.publisher must be a string`);
        if (a?.publishedAt != null && !isDate(a.publishedAt))
          issues.push(`${key}.publishedAt must be ISO 8601`);
      });
  }
  if (
    row.candidateIds != null &&
    (!Array.isArray(row.candidateIds) ||
      row.candidateIds.some((id) => typeof id !== "string" || !/^[a-z0-9-]{1,100}$/.test(id)))
  )
    issues.push(`${p}.candidateIds must contain valid identifiers`);
  for (const key of ["storyId", "imageCredit", "sourceId"]) optionalText(row, key, p, issues);
}

/** Validate a parsed feed payload. Returns { rows, issues }. */
export function validateFeed(name, payload, { knownCandidates = null } = {}) {
  const issues = [];
  if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload[name])) {
    return {
      rows: [],
      issues: [`${name}.json must contain schemaVersion: 1 and an array named ${name}`],
    };
  }
  if (payload[name].length > 20000) return { rows: [], issues: [`${name} exceeds 20000 records`] };
  const ids = new Set();
  for (const [index, row] of payload[name].entries()) {
    const p = `${name}[${index}]`;
    if (!row || typeof row !== "object") {
      issues.push(`${p} must be an object`);
      continue;
    }
    for (const f of FEEDS[name])
      if (row[f] == null || row[f] === "") issues.push(`${p}.${f} is required`);
    if (!text(row.id, 160) || !/^[a-zA-Z0-9_:-]+$/.test(row.id))
      issues.push(`${p}.id must be a safe non-empty identifier`);
    if (typeof row.id === "string" && row.id) {
      if (ids.has(row.id)) issues.push(`${p} duplicates id ${row.id}`);
      ids.add(row.id);
    }
    (name === "polls" ? checkPoll : checkEvent)(row, p, issues, knownCandidates);
  }
  return { rows: payload[name], issues };
}
