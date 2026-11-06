import type { GeoRecord } from "./ontology";

export type GeographyEntry = GeoRecord & {
  commune: string;
  communeLabel: string;
  department: string;
};

function key(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\barrondissement\b/g, "arrondissement")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildGeographyResolver(entries: GeographyEntry[]) {
  const map = new Map<string, GeographyEntry | null>();
  for (const entry of entries) {
    for (const name of [entry.commune, entry.communeLabel]) {
      const lookup = `${key(entry.department)}|${key(name)}`;
      if (!lookup.endsWith("|")) {
        const previous = map.get(lookup);
        map.set(lookup, previous && previous.communeCode !== entry.communeCode ? null : entry);
      }
    }
  }
  return (commune: string, department: string): GeoRecord | null => {
    const found = map.get(`${key(department)}|${key(commune)}`);
    return found ? {
      communeCode: found.communeCode, departmentCode: found.departmentCode,
      density: found.density, sourceYear: found.sourceYear,
      population2023: found.population2023, parentCommuneCode: found.parentCommuneCode,
    } : null;
  };
}

/** Paris/Lyon/Marseille arrondissements carry no density or population in INSEE: inherit the parent commune's. */
export function withParentGeography(geo: GeoRecord | null, byCode: Map<string, GeoRecord>): GeoRecord | null {
  if (!geo || !geo.parentCommuneCode || (geo.density && geo.population2023 != null)) return geo;
  const parent = byCode.get(geo.parentCommuneCode);
  return parent ? { ...geo, density: geo.density ?? parent.density, population2023: geo.population2023 ?? parent.population2023 } : geo;
}
