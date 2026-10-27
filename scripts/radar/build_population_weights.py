"""Diagnostic 2022 adult poststratification weights by geography, sex and age.

These are resident-population weights, not registered-elector weights. Cells
absent from the synthetic frame remain unsupported and are never imputed.
"""
import argparse
import csv
import io
import json
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

AGE = {"18": "18_39", "25": "18_39", "40": "40_64", "55": "40_64", "65": "65_plus", "80": "65_plus"}


def run(index: Path, source: Path, departments: Path, output: Path, level: str):
    dep_region = {row["DEP"]: row["REG"] for row in csv.DictReader(departments.open(newline="", encoding="utf8"))}
    population = Counter()
    with zipfile.ZipFile(source) as archive:
        with io.TextIOWrapper(archive.open("TD_POP1A_2022.csv"), encoding="utf-8-sig") as stream:
            for row in csv.DictReader(stream, delimiter=";"):
                if row["NIVGEO"] != "COM" or row["AGEPYR10"] not in AGE or not row["NB"]:
                    continue
                code = row["CODGEO"]
                department = code[:3] if code.startswith(("97", "98")) else code[:2]
                geography = dep_region.get(department) if level == "region" else code
                if geography:
                    population[(geography, row["SEXE"], AGE[row["AGEPYR10"]])] += float(row["NB"])
    personas = []
    support = Counter()
    with index.open(encoding="utf8") as stream:
        for line in stream:
            if not line.strip():
                continue
            row = json.loads(line)
            region = dep_region.get(row["geography"]["departmentCode"]) if level == "region" else (
                row["geography"].get("parentCommuneCode") or row["geography"]["communeCode"])
            sex = {"Homme": "1", "Femme": "2"}.get(row["sex"])
            age = "18_39" if row["age"] < 40 else "40_64" if row["age"] < 65 else "65_plus"
            key = (region, sex, age)
            personas.append((row["id"], key))
            support[key] += 1
    if level == "commune":
        wanted = {key[0] for _, key in personas}
        population = Counter({key: value for key, value in population.items() if key[0] in wanted})
    # A cell with no sampled persona cannot be represented by borrowing a row
    # from another cell. Keep a coverage diagnostic for each selected geography.
    by_region = defaultdict(lambda: {"covered": 0, "total": 0, "unsupportedCells": []})
    for key, count in population.items():
        region = key[0]
        by_region[region]["total"] += count
        if support[key]:
            by_region[region]["covered"] += count
        else:
            by_region[region]["unsupportedCells"].append("/".join(key[1:]))
    with output.open("w", encoding="utf8") as stream:
        for persona_id, key in personas:
            weight = population[key] / support[key] if key in population and support[key] else 0
            stream.write(json.dumps({"personaId": persona_id, "regionCode": key[0],
                                     "adultPopulationWeight": weight, "cell": "/".join(str(part) for part in key)},
                                    separators=(",", ":")) + "\n")
    qa = {"source": "INSEE RP 2022 POP1A", "scope": "resident adults, not registered electors", "geographyLevel": level,
          "cells": len(population), "supportedCells": sum(bool(support[key]) for key in population),
          "regions": {region: {**value, "coverage": value["covered"] / value["total"] if value["total"] else 0}
                      for region, value in sorted(by_region.items())}}
    Path(str(output) + ".qa.json").write_text(json.dumps(qa, indent=2), encoding="utf8")
    return qa


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=Path, default=Path("data/radar/personas.jsonl"))
    parser.add_argument("--source", type=Path, default=Path("data/radar/raw/TD_POP1A_2022_csv.zip"))
    parser.add_argument("--departments", type=Path, default=Path("data/radar/raw/v_departement_2026.csv"))
    parser.add_argument("--out", type=Path, default=Path("data/radar/2022-adult-population-weights.jsonl"))
    parser.add_argument("--level", choices=("region", "commune"), default="region")
    args = parser.parse_args()
    print(json.dumps(run(args.index, args.source, args.departments, args.out, args.level)))
