"""Select stratified communes and extract every matching Nemotron row.

The output is a geographically clustered research frame, not a representative
national sample. Source Parquet shards are scanned completely; never truncate
or sample within a selected commune.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pyarrow.parquet as pq
import requests

DATASET = "nvidia/Nemotron-Personas-France"


def norm(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().casefold().split())


def select_communes(geography: Path, departments: Path, margins: Path, per_stratum: int, small_per_region: int, seed: str):
    dep_region = {row["DEP"]: row["REG"] for row in csv.DictReader(departments.open(newline="", encoding="utf8"))}
    eligible = {json.loads(line)["communeCode"] for line in margins.open(encoding="utf8") if line.strip()}
    by_stratum = defaultdict(list)
    small_by_region = defaultdict(list)
    records = json.loads(geography.read_text(encoding="utf8"))["records"]
    for row in records:
        region = dep_region.get(row["departmentCode"])
        population = row.get("population2023") or 0
        if region not in {"11", "24", "27", "28", "32", "44", "52", "53", "75", "76", "84", "93"}:
            continue
        if row["communeCode"] not in eligible or row.get("parentCommuneCode"):
            continue
        if 0 < population < 1_000 and row["density"] == "rural":
            small_by_region[region].append(row)
            continue
        if not 5_000 <= population <= 100_000:
            continue
        if row["density"] not in {"dense", "intermediate", "rural"}:
            continue
        by_stratum[(region, row["density"])].append(row)
    selected = []
    for stratum in sorted(by_stratum):
        candidates = by_stratum[stratum]
        candidates.sort(key=lambda row: hashlib.sha256(f"{seed}|{row['communeCode']}".encode()).hexdigest())
        selected.extend(candidates[:per_stratum])
    for region in sorted(small_by_region):
        candidates = small_by_region[region]
        candidates.sort(key=lambda row: hashlib.sha256(f"{seed}|small|{row['communeCode']}".encode()).hexdigest())
        selected.extend(candidates[:small_per_region])
    for anchor in ("75056", "69123", "13055"):
        selected.append(next(row for row in records if row["communeCode"] == anchor))
    return selected


def main(args):
    selected = select_communes(args.geography, args.departments, args.margins, args.per_stratum, args.small_per_region, args.seed)
    if not selected:
        raise ValueError("No eligible communes")
    lookup = {(norm(row["communeLabel"]), norm(row["department"])): row for row in selected}
    if len(lookup) != len(selected):
        raise ValueError("Selected communes have ambiguous normalized name and department")
    anchor_codes = {"75056", "69123", "13055"}
    for row in json.loads(args.geography.read_text(encoding="utf8"))["records"]:
        if row.get("parentCommuneCode") in anchor_codes:
            parent = next(item for item in selected if item["communeCode"] == row["parentCommuneCode"])
            lookup[(norm(row["communeLabel"]), norm(row["department"]))] = parent
    args.out.parent.mkdir(parents=True, exist_ok=True)
    info = requests.get(f"https://huggingface.co/api/datasets/{DATASET}", timeout=30).json()
    parquet = requests.get("https://datasets-server.huggingface.co/parquet", params={"dataset": DATASET}, timeout=30).json()["parquet_files"]
    counts = Counter()
    seen_ids = set()
    shards = []
    with args.out.open("w", encoding="utf8") as output:
        for index, shard in enumerate(parquet):
            local = args.shard_dir / f"nemotron-shard-{index:04d}.parquet"
            if not local.exists():
                local.parent.mkdir(parents=True, exist_ok=True)
                temp = local.with_suffix(".tmp")
                with requests.get(shard["url"], stream=True, timeout=(30, 180)) as response:
                    response.raise_for_status()
                    with temp.open("wb") as destination:
                        for chunk in response.iter_content(chunk_size=1024 * 1024):
                            destination.write(chunk)
                temp.replace(local)
            if local.stat().st_size != shard["size"]:
                raise ValueError(f"Shard size mismatch: {local}")
            source = pq.ParquetFile(local)
            for batch in source.iter_batches(batch_size=4096):
                for row in batch.to_pylist():
                    commune = lookup.get((norm(str(row["commune"])), norm(str(row["departement"]))))
                    if commune is None:
                        continue
                    if row["uuid"] in seen_ids:
                        raise ValueError(f"Duplicate source persona ID: {row['uuid']}")
                    seen_ids.add(row["uuid"])
                    output.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
                    counts[commune["communeCode"]] += 1
            shards.append({"filename": shard["filename"], "size": shard["size"], "rows": source.metadata.num_rows})
            print(f"scanned {index + 1}/{len(parquet)} shards; retained {len(seen_ids)} rows", flush=True)
            if not args.keep_shards:
                local.unlink()
    plan = [{"communeCode": row["communeCode"], "commune": row["communeLabel"], "department": row["department"],
             "region": next((r["REG"] for r in csv.DictReader(args.departments.open(newline="", encoding="utf8")) if r["DEP"] == row["departmentCode"]), None),
             "density": row["density"], "population2023": row["population2023"], "nemotronRows": counts[row["communeCode"]]}
            for row in selected]
    manifest = {"source": DATASET, "datasetRevision": info["sha"], "sampling": "complete_communes_stratified_region_density_size_plus_PLM",
                "seed": args.seed, "perStratum": args.per_stratum, "smallPerRegion": args.small_per_region, "selectedCommunes": len(selected),
                "nonemptyCommunes": sum(bool(row["nemotronRows"]) for row in plan), "personaRows": len(seen_ids),
                "shardsScanned": shards, "communes": plan,
                "warning": "Selected-commune cluster frame, not a national population sample. Within-commune coverage is complete only for this dataset revision."}
    Path(str(args.out) + ".manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps({key: manifest[key] for key in ("datasetRevision", "selectedCommunes", "nonemptyCommunes", "personaRows")}), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--geography", type=Path, default=Path("data/radar/geography-2026.json"))
    parser.add_argument("--departments", type=Path, default=Path("data/radar/raw/v_departement_2026.csv"))
    parser.add_argument("--margins", type=Path, default=Path("data/radar/margins/2022_pres_t1.jsonl"))
    parser.add_argument("--out", type=Path, default=Path("data/radar/complete-communes-raw.jsonl"))
    parser.add_argument("--shard-dir", type=Path, default=Path("data/radar/raw"))
    parser.add_argument("--per-stratum", type=int, default=2)
    parser.add_argument("--small-per-region", type=int, default=8)
    parser.add_argument("--seed", default="radar-communes-2026-v1")
    parser.add_argument("--keep-shards", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.per_stratum <= 5:
        raise ValueError("per-stratum must be 1-5")
    if not 0 <= args.small_per_region <= 20:
        raise ValueError("small-per-region must be 0-20")
    main(args)
