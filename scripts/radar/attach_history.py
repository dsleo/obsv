"""Attach observed commune election context to the current persona discovery index.

These are *place-level* results, never a claim about a persona's past vote.
Exact COG-code joins only: unmatched historical boundaries stay missing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()


def context(cell: dict) -> dict:
    registered = cell["registered"]
    counts = cell["counts"]
    if registered <= 0 or sum(counts.values()) != registered:
        raise ValueError(f"Unbalanced election cell: {cell['electionId']}/{cell['communeCode']}")
    eligible = cell.get("voteVectorEligible", True)
    choices = cell.get("choices", {})
    options = []
    if eligible:
        options = sorted(({
            "id": option, "label": choices.get(option, {}).get("label", option),
            "officialNuance": choices.get(option, {}).get("officialNuance"),
            "votes": votes, "shareOfRegistered": votes / registered,
        } for option, votes in counts.items() if option.startswith("choice_")),
            key=lambda item: (-item["votes"], item["id"]))
    return {
        "electionId": cell["electionId"], "scope": "observed_commune_context",
        "communeCode": cell["communeCode"], "registered": registered,
        "abstentionShare": counts["abstention"] / registered,
        "blankNullShare": counts["blank_null"] / registered,
        "voteVectorEligible": eligible, "choices": options,
    }


def attach(index: Path, margins: list[Path]) -> dict:
    manifest_path = Path(str(index) + ".manifest.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    if manifest.get("frame") not in ("distributed_pages", "complete_communes", "full_export"):
        raise ValueError("Unknown persona frame")
    wanted = set()
    with index.open(encoding="utf8") as source:
        for line in source:
            if line.strip():
                geography = json.loads(line).get("geography")
                if geography:
                    wanted.add(geography["communeCode"])
                    if geography.get("parentCommuneCode"):
                        wanted.add(geography["parentCommuneCode"])
    cells: dict[str, dict[str, dict]] = {}
    sources = []
    for margin in margins:
        election_id = margin.stem
        if election_id in cells:
            raise ValueError(f"Duplicate election: {election_id}")
        selected = {}
        with margin.open(encoding="utf8") as source:
            for line in source:
                cell = json.loads(line)
                if cell["electionId"] != election_id:
                    raise ValueError(f"Unexpected election ID in {margin}")
                if cell["communeCode"] in wanted:
                    selected[cell["communeCode"]] = context(cell)
        cells[election_id] = selected
        sources.append({"electionId": election_id, "file": str(margin), "sha256": digest(margin), "matchedPlaces": len(selected)})
    temp = Path(str(index) + ".history.tmp")
    counts = {source["electionId"]: 0 for source in sources}
    rows = 0
    with index.open(encoding="utf8") as source, temp.open("w", encoding="utf8") as output:
        for line in source:
            if not line.strip():
                continue
            persona = json.loads(line)
            geography = persona.get("geography") or {}
            code = geography.get("communeCode")
            parent_code = geography.get("parentCommuneCode")
            persona["historicalContext"] = []
            for election_id, by_code in cells.items():
                matched = by_code.get(code) or (by_code.get(parent_code) if parent_code else None)
                if matched:
                    entry = dict(matched)
                    if code != entry["communeCode"]:
                        entry["scope"] = "observed_parent_commune_context"
                    persona["historicalContext"].append(entry)
                    counts[election_id] += 1
            output.write(json.dumps(persona, ensure_ascii=False, separators=(",", ":")) + "\n")
            rows += 1
    temp.replace(index)
    qa = {"rows": rows, "matchedRowsByElection": counts, "sources": sources,
          "warning": "Observed commune context only; not individual vote probability. Exact 2026 COG codes can miss historical commune changes."}
    manifest.update(historyContext=qa)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")
    return qa


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=Path, default=Path("data/radar/personas.jsonl"))
    parser.add_argument("--margins", nargs="+", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(attach(args.index, args.margins), ensure_ascii=False))
