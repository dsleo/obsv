"""Stream minimum-KL local calibration of a selected complete-commune frame.

Rows are temporarily spooled by commune so the largest synthetic cities do not
require loading the complete persona JSON objects into memory.
"""
from __future__ import annotations

import argparse
import json
import math
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from scipy.special import logsumexp, softmax


def solve_kl(prior: np.ndarray, target: np.ndarray, weights: np.ndarray) -> tuple[np.ndarray, float]:
    active = target > 0
    if active.sum() < 2:
        raise ValueError("fewer than two observed choices")
    logp = np.log(np.maximum(prior[:, active], 1e-12))
    t = target[active]
    lam = np.zeros(len(t))
    lam[-1] = 0
    for _ in range(100):
        q = softmax(logp + lam, axis=1)
        actual = weights @ q
        residual = float(np.max(np.abs(actual - t)))
        if residual < 1e-8:
            result = np.zeros_like(prior)
            result[:, active] = q
            return result, residual
        gradient = actual[:-1] - t[:-1]
        centered = q[:, :-1]
        hessian = np.diag(actual[:-1]) - centered.T @ (weights[:, None] * centered)
        step = np.linalg.solve(hessian + np.eye(len(gradient)) * 1e-10, gradient)
        objective = float(weights @ logsumexp(logp + lam, axis=1) - t @ lam)
        scale = 1.0
        while scale >= 1 / 4096:
            candidate = lam.copy()
            candidate[:-1] -= scale * step
            proposed = float(weights @ logsumexp(logp + candidate, axis=1) - t @ candidate)
            if proposed < objective or math.isclose(proposed, objective, abs_tol=1e-13):
                lam = candidate
                break
            scale *= 0.5
        else:
            raise ValueError(f"calibration line search failed at residual {residual:.3g}")
    raise ValueError(f"calibration did not converge: {residual:.3g}")


def run(args):
    weights = {}
    coverage = {}
    if args.weights:
        with args.weights.open(encoding="utf8") as source:
            for line in source:
                row = json.loads(line)
                weights[row["personaId"]] = row["adultPopulationWeight"]
        audit = json.loads(Path(str(args.weights) + ".qa.json").read_text(encoding="utf8"))
        coverage = {code: entry["coverage"] for code, entry in audit["regions"].items()}
    margins = {}
    with args.margins.open(encoding="utf8") as source:
        for line in source:
            row = json.loads(line)
            margins[row["communeCode"]] = row
    qa = {"scope": "selected_complete_communes_adult_poststratified" if args.weights else "selected_complete_communes_equal_row_weight",
          "calibratedCommunes": 0, "calibratedRows": 0, "uncalibratedRows": 0,
          "maxShareResidual": 0.0, "maxProbabilityChange": 0.0, "minEffectiveRows": None,
          "skipped": {}, "communes": {}}
    with tempfile.TemporaryDirectory(prefix="radar-communes-") as scratch:
        paths = {}
        handles = {}
        counts = Counter()
        try:
            with args.index.open(encoding="utf8") as source:
                for line in source:
                    if not line.strip(): continue
                    row = json.loads(line)
                    geo = row["geography"]
                    code = geo.get("parentCommuneCode") or geo["communeCode"]
                    if code not in handles:
                        paths[code] = Path(scratch) / f"{code}.jsonl"
                        handles[code] = paths[code].open("w", encoding="utf8")
                    handles[code].write(line)
                    counts[code] += 1
        finally:
            for handle in handles.values(): handle.close()
        source_manifest = json.loads(Path(str(args.index) + ".manifest.json").read_text(encoding="utf8"))
        with args.out.open("w", encoding="utf8") as output:
            for code, file in sorted(paths.items()):
                margin = margins.get(code)
                reason = None
                if not margin: reason = "missing_margin"
                elif margin.get("voteVectorEligible") is False: reason = "ineligible_margin"
                elif counts[code] < args.minimum_rows: reason = f"only_{counts[code]}_rows"
                elif args.weights and coverage.get(code, 0) < args.minimum_coverage: reason = "adult_population_cell_coverage_below_threshold"
                options = sorted(margin["counts"]) if margin else []
                prior_list = []
                mass_list = []
                if not reason:
                    with file.open(encoding="utf8") as source:
                        for line in source:
                            row = json.loads(line)
                            historical = row.get("historicalPropensity") or {}
                            if historical.get("electionId") != "2022_pres_t1": raise ValueError(f"missing 2022 prior: {code}")
                            prior_list.append([historical["probabilities"][option] for option in options])
                            mass_list.append(weights[row["id"]] if args.weights else 1.0)
                    mass = np.asarray(mass_list, dtype=float)
                    if not np.isfinite(mass).all() or (mass <= 0).any(): reason = "missing_population_weight"
                    else:
                        mass /= mass.sum()
                        effective = 1 / float(mass @ mass)
                        if effective < args.minimum_effective_rows: reason = f"effective_support_{effective:.1f}"
                if not reason:
                    prior = np.asarray(prior_list, dtype=float)
                    target = np.asarray([margin["counts"][option] / margin["registered"] for option in options])
                    try:
                        fitted, residual = solve_kl(prior, target, mass)
                        max_shift = float(np.max(np.abs(fitted - prior)))
                        if max_shift > args.maximum_change: reason = f"shift_guardrail_{max_shift:.3f}"
                    except (ValueError, np.linalg.LinAlgError) as error:
                        reason = str(error)
                if reason:
                    qa["skipped"][code] = reason
                    qa["uncalibratedRows"] += counts[code]
                else:
                    qa["calibratedCommunes"] += 1
                    qa["calibratedRows"] += counts[code]
                    qa["maxShareResidual"] = max(qa["maxShareResidual"], residual)
                    qa["maxProbabilityChange"] = max(qa["maxProbabilityChange"], max_shift)
                    qa["minEffectiveRows"] = min(qa["minEffectiveRows"] or effective, effective)
                    qa["communes"][code] = {"rows": counts[code], "effectiveRows": effective,
                                            "maxShareResidual": residual, "maxProbabilityChange": max_shift}
                with file.open(encoding="utf8") as source:
                    for i, line in enumerate(source):
                        row = json.loads(line)
                        if not reason:
                            history = row["historicalPropensity"]
                            history["nationalSurveyProbabilities"] = history["probabilities"]
                            history["probabilities"] = {option: float(value) for option, value in zip(options, fitted[i])}
                            history["scope"] = "survey_prior_commune_share_calibrated_adult_poststratification" if args.weights else "survey_prior_commune_share_calibrated_equal_synthetic_rows"
                            history["calibration"] = {"communeCode": code, "electionId": "2022_pres_t1",
                                                      "method": "minimum_KL", "representation": "INSEE_2022_commune_age_sex_adults" if args.weights else "equal_synthetic_rows"}
                        output.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    Path(str(args.out) + ".qa.json").write_text(json.dumps(qa, indent=2), encoding="utf8")
    source_manifest["localCalibration"] = {key: value for key, value in qa.items() if key != "communes"}
    Path(str(args.out) + ".manifest.json").write_text(json.dumps(source_manifest, ensure_ascii=False, indent=2), encoding="utf8")
    return {key: value for key, value in qa.items() if key != "communes"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=Path, default=Path("data/radar/complete-communes-personas.jsonl"))
    parser.add_argument("--margins", type=Path, default=Path("data/radar/margins/2022_pres_t1.jsonl"))
    parser.add_argument("--weights", type=Path)
    parser.add_argument("--out", type=Path, default=Path("data/radar/complete-communes-calibrated.jsonl"))
    parser.add_argument("--minimum-rows", type=int, default=30)
    parser.add_argument("--minimum-effective-rows", type=float, default=20)
    parser.add_argument("--minimum-coverage", type=float, default=0.95)
    parser.add_argument("--maximum-change", type=float, default=0.2)
    print(json.dumps(run(parser.parse_args())))
