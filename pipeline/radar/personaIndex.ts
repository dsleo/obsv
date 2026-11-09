// Slim in-memory view of a persona index, so analyses never rescan the multi-GB JSONL.
// One streaming pass builds `<index>.slim.json` (tags, geography, top vote anchor, byte offset);
// every filter/count then runs in memory and only the few selected personas are read back by offset.
import { createReadStream, statSync } from "node:fs";
import { open, readFile, rename, writeFile } from "node:fs/promises";
import type { RadarPersona } from "../../src/lib/radar/ontology";
import { BLOC_KEYS, baseline } from "./baseline";

type Tag = RadarPersona["tags"][number];
type Slim = RadarPersona & { _offset: number; _length: number };
type Cache = { version?: number; priorMass?: number[]; size: number; mtimeMs: number; tags: Tag[]; rows: [string, number, number, number[], RadarPersona["geography"], string | null][] };

async function build(file: string): Promise<Cache> {
  const stat = statSync(file);
  const tagIndex = new Map<string, number>(), tags: Tag[] = [], rows: Cache["rows"] = [], priorMass = [0, 0, 0, 0, 0];
  let offset = 0, carry = Buffer.alloc(0);
  const add = (line: Buffer, start: number) => {
    if (!line.length || !line.toString("utf8", 0, Math.min(line.length, 8)).trim()) return;
    const p = JSON.parse(line.toString("utf8")) as RadarPersona;
    const ids = p.tags.map((tag) => { // interned: one shared object per distinct (id, source)
      const key = `${tag.id}|${tag.source}`;
      if (!tagIndex.has(key)) { tagIndex.set(key, tags.length); tags.push({ id: tag.id, source: tag.source } as Tag); }
      return tagIndex.get(key)!;
    });
    const top = Object.entries(p.historicalPropensity?.probabilities ?? {}).filter(([id]) => id.startsWith("choice_")).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    rows.push([p.id, start, line.length, ids, p.geography, top]);
    const b = baseline(p); if (b) BLOC_KEYS.forEach((key, i) => { priorMass[i] += b[key]; });
  };
  for await (const chunk of createReadStream(file) as AsyncIterable<Buffer>) {
    let buffer = Buffer.concat([carry, chunk]), from = 0, at: number;
    const base = offset - carry.length;
    while ((at = buffer.indexOf(10, from)) >= 0) { add(buffer.subarray(from, at), base + from); from = at + 1; }
    carry = buffer.subarray(from);
    offset += chunk.length;
  }
  add(carry, offset - carry.length);
  return { version: 2, priorMass, size: stat.size, mtimeMs: stat.mtimeMs, tags, rows };
}

const loaded = new Map<string, Promise<{ file: string; personas: Slim[]; priorMass: number[] }>>();

/** Slim personas (tags, geography, id; `historicalPropensity.probabilities` reduced to the top choice). Cached on disk and in memory. */
export function loadPersonas(file: string) {
  if (!loaded.has(file)) loaded.set(file, (async () => {
    const stat = statSync(file), cachePath = `${file}.slim.json`;
    let cache: Cache | null = await readFile(cachePath, "utf8").then(JSON.parse, () => null);
    if (!cache || cache.version !== 2 || cache.size !== stat.size || cache.mtimeMs !== stat.mtimeMs) {
      console.log(`building slim index for ${file} (one-off pass)…`);
      cache = await build(file);
      await writeFile(`${cachePath}.${process.pid}.tmp`, JSON.stringify(cache)); // pid-unique: parallel processes may rebuild at once
      await rename(`${cachePath}.${process.pid}.tmp`, cachePath);
    }
    const personas = cache.rows.map(([id, _offset, _length, ids, geography, top]) => ({
      id, tags: ids.map((i) => cache!.tags[i]), geography,
      historicalPropensity: top ? { probabilities: { [top]: 1 } } : undefined, _offset, _length,
    }) as unknown as Slim);
    return { file, personas, priorMass: cache.priorMass! };
  })());
  return loaded.get(file)!;
}

/** Full rows (narratives, historical context) of the selected personas, read by byte offset. */
export async function hydrate(file: string, selected: RadarPersona[]): Promise<RadarPersona[]> {
  const handle = await open(file, "r");
  try {
    return await Promise.all(selected.map(async (persona) => {
      const { _offset, _length } = persona as Slim;
      const buffer = Buffer.alloc(_length);
      await handle.read(buffer, 0, _length, _offset);
      return JSON.parse(buffer.toString("utf8")) as RadarPersona;
    }));
  } finally { await handle.close(); }
}
