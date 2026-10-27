"""Import selected elections from data.gouv's harmonized Parquet release.

Requires pyarrow. Input files are the two official resource files, retained
outside git under data/radar/raw. Output is commune-level JSONL with actual
candidate/list choices, no guessed party-family mapping.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path

import pyarrow.compute as pc
import pyarrow.parquet as pq


def selected_rows(file: Path, election_ids: set[str], columns: list[str]):
    reader = pq.ParquetFile(file)
    for batch in reader.iter_batches(batch_size=65536, columns=columns):
        keep = pc.is_in(batch.column("id_election"), value_set=__import__("pyarrow").array(sorted(election_ids)))
        for row in batch.filter(keep).to_pylist():
            yield row


def import_data(general_file: Path, candidates_file: Path, output_dir: Path, elections: set[str]):
    output_dir.mkdir(parents=True, exist_ok=True)
    bureaux = {}
    communes = {}
    for row in selected_rows(general_file, elections, [
        "id_election", "id_brut_miom", "code_commune", "libelle_commune", "code_departement",
        "inscrits", "abstentions", "blancs", "nuls", "exprimes",
    ]):
        key = (row["id_election"], row["id_brut_miom"])
        if key in bureaux:
            raise ValueError(f"Duplicate bureau: {key}")
        registered = row["inscrits"]
        total = row["abstentions"] + row["blancs"] + row["nuls"] + row["exprimes"]
        if total != registered:
            raise ValueError(f"General result does not sum to registered count: {key}")
        bureaux[key] = {"communeCode": row["code_commune"], "expressed": row["exprimes"], "found": 0}
        cell_key = (row["id_election"], row["code_commune"])
        cell = communes.setdefault(cell_key, {
            "electionId": row["id_election"], "communeCode": row["code_commune"],
            "communeName": row["libelle_commune"], "departmentCode": row["code_departement"],
            "registered": 0, "counts": {"abstention": 0, "blank_null": 0},
            "choices": {}, "bureauCount": 0,
        })
        cell["registered"] += registered
        cell["counts"]["abstention"] += row["abstentions"]
        cell["counts"]["blank_null"] += row["blancs"] + row["nuls"]
        cell["bureauCount"] += 1
    if not bureaux:
        raise ValueError(f"No results for elections {sorted(elections)}")

    for row in selected_rows(candidates_file, elections, [
        "id_election", "id_brut_miom", "code_commune", "no_panneau", "voix", "nuance",
        "nom", "prenom", "liste", "libelle_abrege_liste", "libelle_etendu_liste", "nom_tete_liste",
    ]):
        key = (row["id_election"], row["id_brut_miom"])
        bureau = bureaux.get(key)
        if bureau is None or bureau["communeCode"] != row["code_commune"]:
            raise ValueError(f"Candidate has no matching bureau: {key}")
        cell = communes[(row["id_election"], row["code_commune"])]
        panel = row["no_panneau"]
        label = next((value.strip() for value in [
            row["libelle_etendu_liste"], row["liste"],
            " ".join(value for value in [row["prenom"], row["nom"]] if value),
            row["nom_tete_liste"],
        ] if value and value.strip()), f"panel_{panel}" if panel is not None else "unlabelled")
        normalized = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode().lower()
        normalized = re.sub(r"[^a-z0-9]+", " ", normalized).strip()
        option = "choice_" + hashlib.sha1(normalized.encode()).hexdigest()[:14]
        cell["choices"].setdefault(option, {
            "id": option, "label": label, "officialNuance": row["nuance"] or None,
        })
        cell["counts"][option] = cell["counts"].get(option, 0) + row["voix"]
        bureau["found"] += row["voix"]

    mismatched = [(key, bureau) for key, bureau in bureaux.items() if bureau["expressed"] != bureau["found"]]
    bad_cells = {(key[0], bureau["communeCode"]) for key, bureau in mismatched}
    qa = {"voteVectorIneligibleBureaux": len(mismatched), "voteVectorIneligibleCommunes": len(bad_cells),
          "examples": [{"election": key[0], "bureau": key[1], "expressed": item["expressed"],
                        "candidateVotes": item["found"]} for key, item in mismatched[:20]]}
    (output_dir / "qa-summary.json").write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding="utf8")
    def digest(file: Path):
        checksum = hashlib.sha256()
        with file.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                checksum.update(chunk)
        return checksum.hexdigest()
    (output_dir / "source-manifest.json").write_text(json.dumps({
        "collection": "https://www.data.gouv.fr/datasets/donnees-des-elections-agregees",
        "generalResource": "https://data-pipeline-open.s3.sbg.io.cloud.ovh.net/elections/general_results.parquet",
        "candidateResource": "https://data-pipeline-open.s3.sbg.io.cloud.ovh.net/elections/candidats_results.parquet",
        "generalSha256": digest(general_file), "candidateSha256": digest(candidates_file),
        "elections": sorted(elections), "qa": qa,
    }, ensure_ascii=False, indent=2), encoding="utf8")
    for election in sorted(elections):
        cells = [value for key, value in communes.items() if key[0] == election]
        output = output_dir / f"{election}.jsonl"
        with output.open("w", encoding="utf8") as stream:
            for cell in sorted(cells, key=lambda value: value["communeCode"]):
                if (election, cell["communeCode"]) in bad_cells:
                    candidate_tallies = {key: count for key, count in cell["counts"].items() if key.startswith("choice_")}
                    cell["rawCandidateTallies"] = candidate_tallies
                    cell["counts"] = {
                        "abstention": cell["counts"]["abstention"],
                        "blank_null": cell["counts"]["blank_null"],
                        "expressed": cell["registered"] - cell["counts"]["abstention"] - cell["counts"]["blank_null"],
                    }
                    cell["voteVectorEligible"] = False
                    cell["choiceDataStatus"] = "multi_choice_or_mismatch" if election.startswith("2020_muni") else "candidate_totals_mismatch"
                else:
                    cell["voteVectorEligible"] = True
                    cell["choiceDataStatus"] = "single_choice_balanced"
                if sum(cell["counts"].values()) != cell["registered"]:
                    raise ValueError(f"Commune ballot totals do not balance: {election}/{cell['communeCode']}")
                stream.write(json.dumps(cell, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(json.dumps({"election": election, "communes": len(cells), "bureaux": sum(c["bureauCount"] for c in cells), "voteVectorIneligibleCommunes": sum(1 for key in bad_cells if key[0] == election), "output": str(output)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--general", type=Path, required=True)
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--elections", nargs="+", required=True)
    args = parser.parse_args()
    import_data(args.general, args.candidates, args.out_dir, set(args.elections))
