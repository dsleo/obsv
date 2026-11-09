// Deterministic helpers for the segment-proposal stage: limits, text checks, overlap, relaxation. No I/O, no model.
import { CLUSTERS, TAG_IDS, type RadarFilter, type RadarPersona, type TagSource } from "../../src/lib/radar/ontology";
import { SINGLE_VALUED_FAMILIES } from "./filters";

export const MIN_SEGMENT_SIZE = 100; // personas
export const MIN_PLACE_SEGMENT_SIZE = 20; // a named commune holds few synthetic personas
export const MIN_COMMUNES = 3;
export const MAX_SEGMENT_SHARE = 0.25; // of the whole index
export const DUPLICATE_JACCARD = 0.8;
export const TARGET_SEGMENTS = 3;
export const MIN_USABLE_SEGMENTS = 2;
export const MAX_REPAIR_ROUNDS = 2;

const ascii = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const STOPWORDS = new Set(("alors apres avec avoir cette cela celui chez comme dans depuis des donc dont elle elles entre est et etre fait faire leur leurs lors mais meme mieux moins nous notre nos pour plus par pas que qui quoi sans sur ses son sont tous tout toute toutes tres une vers vos votre vous aux aussi autre autres avant bien ceux comment encore entre eux fois ils ont peut peuvent selon sera ses soit sous cet ces ete etait etaient sera seront ainsi apres contre pendant afin lui puis ici ceci mais ou ni car si on il elle je tu ne se de du la le les un en au ca").split(/\s+/));

/** Accent-insensitive words longer than 3 letters, minus stopwords, lightly stemmed (plural s/x). */
export function contentWords(text: string): Set<string> {
  const words = new Set<string>();
  for (const raw of ascii(text).split(/[^a-z0-9]+/)) {
    if (raw.length <= 3 || STOPWORDS.has(raw)) continue;
    words.add(raw.length > 4 ? raw.replace(/[sx]$/, "") : raw);
  }
  return words;
}

export function sharedWords(a: string, b: string): string[] {
  const other = contentWords(b);
  return [...contentWords(a)].filter((word) => other.has(word));
}

// Most frequent baseline archetypes (first backfill, 99 events): reused for nearly every event.
const GENERIC_ARCHETYPES = new Set([
  "cluster.young_urban_graduate", "cluster.modest_wage_earner", "cluster.modest_wage_earner|geo.dense",
  "cluster.young_without_activity", "cluster.retiree_no_diploma", "cluster.retiree_no_diploma|geo.rural",
]);
export const tagSignature = (filter: Pick<RadarFilter, "all" | "any">) => [...new Set([...filter.all, ...filter.any])].sort().join("|");

/** A segment is not event-specific when it is a stock archetype AND shares no content word with the event. */
export function lacksEventSpecificity(segment: Pick<RadarFilter, "all" | "any"> & { name: string; mechanism: string }, event: { title: string; description: string }) {
  if (!GENERIC_ARCHETYPES.has(tagSignature(segment))) return false;
  return sharedWords(`${segment.name} ${segment.mechanism}`, `${event.title} ${event.description}`).length === 0;
}

export function counterfactualRelevant(intervention: string, event: { title: string; description: string }) {
  return sharedWords(intervention, `${event.title} ${event.description}`).length >= 2;
}

export const GLOBAL_OUTCOME = "intention de vote par bloc et abstention";
export function eventComparator() { return "L’événement n’a pas lieu ou n’est pas relayé dans les médias"; }
export function templateScenario(event: { title: string }, outcomeToMeasure = GLOBAL_OUTCOME) {
  return { intervention: event.title, comparator: eventComparator(), outcomeToMeasure };
}
export function globalScenario(event: { title: string }) {
  return { ...templateScenario(event), reason: "Scénario global unique, formulé par gabarit : l’événement tel qu’énoncé comparé à son absence, sur l’ensemble de l’échantillon." };
}

/** Jaccard similarity of two sorted index arrays. */
export function jaccard(a: ArrayLike<number>, b: ArrayLike<number>) {
  let i = 0, j = 0, common = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { common++; i++; j++; } else if (a[i] < b[j]) i++; else j++;
  }
  const union = a.length + b.length - common;
  return union === 0 ? 1 : common / union;
}

// ---- Fast in-memory matching (same semantics as matchesFilter, without per-call zod parsing) ----
const BASE_SOURCES: readonly TagSource[] = ["direct", "derived", "official_geo", "audited_narrative"];
export type Place = { communeCode: string | null; departmentCode: string } | null;
export type MatchResult = { members: Int32Array; narrativeCount: number; communes: number };

export class Matcher {
  private base: string[][];
  private every: string[][];
  constructor(private personas: RadarPersona[]) {
    this.base = personas.map((p) => p.tags.filter((t) => BASE_SOURCES.includes(t.source)).map((t) => t.id));
    this.every = personas.map((p) => p.tags.map((t) => t.id));
  }
  get rows() { return this.personas.length; }
  tagsOf(index: number) { return this.base[index]; }
  match(filter: RadarFilter, place: Place, candidates?: ArrayLike<number>): MatchResult {
    const test = (ids: string[], hasGeo: boolean, none: boolean) => {
      if (!filter.all.every((id) => ids.includes(id))) return false;
      if (filter.any.length && !filter.any.some((id) => ids.includes(id))) return false;
      if (!none) return true;
      return filter.none.every((id) => (id.startsWith("cluster.") || (id === "municipal_system.paris_lyon_marseille" ? hasGeo : ids.some((t) => t.split(".")[0] === id.split(".")[0]))) && !ids.includes(id));
    };
    const members: number[] = [];
    const communes = new Set<string>();
    let narrativeCount = 0;
    const n = candidates ? candidates.length : this.personas.length;
    for (let k = 0; k < n; k++) {
      const i = candidates ? candidates[k] : k;
      const p = this.personas[i];
      if (place && (!p.geography || p.geography.departmentCode !== place.departmentCode ||
        (place.communeCode && p.geography.communeCode !== place.communeCode && p.geography.parentCommuneCode !== place.communeCode))) continue;
      if (test(this.every[i], p.geography !== null, true)) narrativeCount++;
      if (!test(this.base[i], p.geography !== null, true)) continue;
      members.push(i);
      if (p.geography?.communeCode) communes.add(p.geography.communeCode);
    }
    return { members: Int32Array.from(members), narrativeCount, communes: communes.size };
  }
}

// ---- Fallback relaxation ----
export type Relaxation = { filter: RadarFilter; note: string; clusterLabel?: string };

/**
 * Progressively broader variants of a rejected filter: drop `none`, then the last `all` tag(s), then (broader) clusters
 * that share tags with the original. `tooLarge` swaps the direction: narrow by adding one tag instead.
 */
export function* relaxations(filter: RadarFilter): Generator<Relaxation> {
  if (filter.none.length) yield { filter: { ...filter, none: [] }, note: `exclusions retirées (${filter.none.join(", ")})` };
  const all = [...filter.all];
  while (all.length > 0 && (all.length > 1 || filter.any.length > 0)) {
    const dropped = all.pop()!;
    yield { filter: { all: [...all], any: filter.any, none: [] }, note: `tag « ${dropped} » retiré des conditions obligatoires` };
  }
  if (filter.any.length > 1) yield { filter: { all: [], any: filter.any, none: [] }, note: "conditions obligatoires retirées, alternatives conservées" };
  const present = new Set<string>([...filter.all, ...filter.any]);
  const scored = CLUSTERS.map((cluster) => {
    const ids = [...cluster.all, ...cluster.anyGroups.flat()];
    return { cluster, score: ids.filter((id) => present.has(id)).length };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  for (const { cluster } of scored) yield { filter: { all: [cluster.id as RadarFilter["all"][number]], any: [], none: [] }, note: `repli sur le public nommé « ${cluster.label} »`, clusterLabel: cluster.label };
}

/** Narrowing candidates for a too-large filter: add one tag of a single-valued family not yet constrained. */
export function narrowings(filter: RadarFilter): Relaxation[] {
  const used = new Set([...filter.all, ...filter.any].map((id) => id.split(".")[0]));
  return (TAG_IDS as readonly string[]).filter((id) => (SINGLE_VALUED_FAMILIES as readonly string[]).includes(id.split(".")[0]) && !used.has(id.split(".")[0]))
    .map((id) => ({ filter: { ...filter, all: [...filter.all, id] } as unknown as RadarFilter, note: `tag « ${id} » ajouté pour resserrer le public` }));
}
