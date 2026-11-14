import { parse } from "csv-parse/sync";
// Adapter: Sondax CSV (daily, derived from Wikipedia, CC BY-SA 4.0) -> polls.json contract v1.
// Keeps only the first-round configuration Sondax retains (configuration_principale = 1), so each
// survey yields one poll. Second-round duels are not mapped yet (the site has no runoff view).
export const SONDAX_CSV_URL = "https://sondax.fr/donnees/sondages-presidentielle-2027.csv";

export function parseCsv(text) {
  return parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: false,
  });
}

/** Returns { polls }. */
export function sondaxToPolls(csvText, { knownCandidates = null } = {}) {
  const surveys = new Map();
  for (const row of parseCsv(csvText)) {
    if (row.tour !== "1" || row.configuration_principale !== "1") continue;
    if (knownCandidates && !knownCandidates.has(row.candidat_id)) continue;
    if (!surveys.has(row.sondage_id)) surveys.set(row.sondage_id, { row, shares: {} });
    surveys.get(row.sondage_id).shares[row.candidat_id] = Number(row.score);
  }

  const polls = [];
  for (const { row, shares } of surveys.values()) {
    // Sondax sometimes has no sample size yet (Wikipedia lacks it): keep the poll, sampleSize stays null.
    const n = Number(row.echantillon);
    const sampleSize = row.echantillon && Number.isInteger(n) && n > 0 ? n : null;
    polls.push({
      id: row.sondage_id,
      // Sondax exposes no publication date: fieldwork end is the date we can stand behind.
      publishedAt: `${row.terrain_fin}T00:00:00Z`,
      fieldworkStart: row.terrain_debut,
      fieldworkEnd: row.terrain_fin,
      pollster: row.institut,
      sampleSize,
      round: "first",
      candidateShares: shares,
      source: {
        title: `Sondax, d’après Wikipédia (${row.institut}, ${row.terrain_fin})`,
        url: row.url_source || `https://sondax.fr/sondages/${row.sondage_id}`,
      },
    });
  }
  polls.sort((a, b) => a.fieldworkEnd.localeCompare(b.fieldworkEnd));
  return { polls };
}
