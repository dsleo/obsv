"""Fit a modest 2022 presidential propensity model from human survey responses.

This stage works on either the 2,000-row discovery frame or a selected
complete-commune frame. The survey model is tested on withheld respondents,
then its intercepts are calibrated to metropolitan official 2022 totals on
the *survey frame*. Local calibration is a separate downstream step.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


SURVEY_URL = "https://doi.org/10.5281/zenodo.18848264"
ELECTION_ID = "2022_pres_t1"
VERSION = "voter-autrement-2022-region-national-calibration-v2"
REGIONS = {
    "ile-de-france": "11", "centre-val de loire": "24", "bourgogne-franche-comte": "27",
    "normandie": "28", "hauts-de-france": "32", "grand est": "44",
    "pays de la loire": "52", "bretagne": "53", "nouvelle-aquitaine": "75",
    "occitanie": "76", "auvergne-rhone-alpes": "84",
    "provence-alpes-cote dazur": "93", "corse": "94",
}


def normalized(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower().split())


def survey_work(value: str) -> str:
    v = normalized(value)
    if "retraite" in v: return "retired"
    if "employe" in v: return "employee"
    if "ouvrier" in v: return "worker"
    if "intermediaire" in v: return "intermediate"
    if "cadre" in v: return "executive"
    if "agriculteur" in v: return "farmer_artisan_owner"
    if "etudiant" in v: return "student"
    return "other_inactive"


def persona_work(value: str) -> str:
    v = normalized(value)
    if "retraite" in v: return "retired"
    if "employe" in v: return "employee"
    if "ouvrier" in v: return "worker"
    if "intermediaire" in v: return "intermediate"
    if "cadre" in v or "intellectuelle superieure" in v: return "executive"
    if any(token in v for token in ("agriculteur", "artisan", "commercant", "chef d'entreprise")): return "farmer_artisan_owner"
    if "etudiant" in v: return "student"
    return "other_inactive"


def age_group(age: int) -> str:
    return "18-24" if age < 25 else "25-34" if age < 35 else "35-49" if age < 50 else "50-64" if age < 65 else "65+"


def features(age: str, sex: str, work: str, region: str) -> dict[str, str]:
    return {"age": age, "sex": sex, "work": work, "region": region}


def digest(path: Path) -> str:
    sha = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            sha.update(chunk)
    return sha.hexdigest()


def official_counts(margins: Path) -> tuple[Counter, dict[str, str]]:
    counts = Counter()
    labels = {"abstention": "Abstention", "blank_null": "Blank or null ballot"}
    with margins.open(encoding="utf8") as source:
        for line in source:
            cell = json.loads(line)
            if cell["electionId"] != ELECTION_ID or cell["departmentCode"].startswith(("97", "98")):
                continue
            if cell.get("voteVectorEligible") is False:
                continue
            for option, value in cell["counts"].items():
                counts[option] += value
                if option.startswith("choice_"):
                    labels[option] = cell["choices"][option]["label"]
    if not counts or sum(counts.values()) <= 0:
        raise ValueError("No usable metropolitan 2022 results")
    return counts, labels


def survey_outcome(row: dict, by_name: dict[str, str]) -> str | None:
    will_vote = normalized(row["will_vote"])
    if will_vote == "non": return "abstention"
    if will_vote != "oui": return None
    vote = normalized(row["vote_if_yes"])
    if vote in ("blanc", "nul"): return "blank_null"
    return by_name.get(vote)


def tilt_to_margins(probabilities: np.ndarray, target: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if np.any(target <= 0) or not np.isclose(target.sum(), 1):
        raise ValueError("Official targets must be positive and sum to one")
    multipliers = np.ones(probabilities.shape[1])
    for _ in range(10000):
        calibrated = probabilities * multipliers
        calibrated /= calibrated.sum(axis=1, keepdims=True)
        actual = calibrated.mean(axis=0)
        if np.max(np.abs(actual - target)) < 1e-10:
            return multipliers, actual
        multipliers *= target / actual
        multipliers /= np.max(multipliers)
    raise ValueError("National intercept calibration failed to converge")


def run(index: Path, survey: Path, margins: Path, departments: Path) -> dict:
    official, labels = official_counts(margins)
    department_region = {row["DEP"]: row["REG"] for row in csv.DictReader(departments.open(newline="", encoding="utf8"))}
    by_name = {normalized(label): option for option, label in labels.items() if option.startswith("choice_")}
    rows = list(csv.DictReader(survey.open(newline="", encoding="utf8")))
    x, y = [], []
    exclusions = Counter()
    for row in rows:
        outcome = survey_outcome(row, by_name)
        if outcome is None:
            exclusions["undecided_or_unmatched"] += 1
            continue
        region = REGIONS.get(normalized(row["region"]))
        if not region:
            raise ValueError(f"Unknown survey region: {row['region']}")
        x.append(features(row["age"], row["gender"], survey_work(row["work"]), region))
        y.append(outcome)
    if len(x) < 500: raise ValueError("Too few labeled human responses")
    classes = sorted(official)
    if set(classes) != set(y): raise ValueError(f"Survey outcomes do not cover official options: {set(classes) - set(y)}")
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=.25, random_state=2026, stratify=y)
    def model(c: float):
        return Pipeline([("onehot", ColumnTransformer([("categorical", OneHotEncoder(handle_unknown="ignore"), ["age", "sex", "work", "region"])])),
                         ("multinomial", LogisticRegression(C=c, max_iter=1000))])
    import pandas as pd
    folds = StratifiedKFold(n_splits=4, shuffle=True, random_state=2026)
    cv_scores = {}
    for c in (.01, .03, .1, .3, 1.0):
        losses = []
        for train_idx, valid_idx in folds.split(x_train, y_train):
            learner = model(c).fit(pd.DataFrame([x_train[i] for i in train_idx]), [y_train[i] for i in train_idx])
            predictions = learner.predict_proba(pd.DataFrame([x_train[i] for i in valid_idx]))
            losses.append(log_loss([y_train[i] for i in valid_idx], predictions, labels=learner.named_steps["multinomial"].classes_))
        cv_scores[str(c)] = float(np.mean(losses))
    selected_c = min((float(value) for value in cv_scores), key=lambda value: cv_scores[str(value)])
    held = model(selected_c).fit(pd.DataFrame(x_train), y_train)
    p_test = held.predict_proba(pd.DataFrame(x_test))
    held_classes = held.named_steps["multinomial"].classes_
    baseline = np.array([y_train.count(option) / len(y_train) for option in held_classes])
    heldout_loss = float(log_loss(y_test, p_test, labels=held_classes))
    prevalence_loss = float(log_loss(y_test, np.tile(baseline, (len(y_test), 1)), labels=held_classes))
    by_age = {}
    for group in sorted(set(row["age"] for row in x_test)):
        subset = [i for i, row in enumerate(x_test) if row["age"] == group]
        by_age[group] = {"n": len(subset), "logLoss": float(log_loss([y_test[i] for i in subset], p_test[subset], labels=held_classes))}
    fitted = model(selected_c).fit(pd.DataFrame(x), y)
    fitted_classes = list(fitted.named_steps["multinomial"].classes_)
    if fitted_classes != classes: raise ValueError("Fitted choice ordering differs from official choices")
    survey_probs = fitted.predict_proba(pd.DataFrame(x))
    target = np.array([official[option] / sum(official.values()) for option in classes])
    multipliers, fitted_margins = tilt_to_margins(survey_probs, target)
    qa = {"version": VERSION, "survey": SURVEY_URL, "surveyRows": len(rows), "labeledRows": len(y),
          "excluded": dict(exclusions), "surveySha256": digest(survey), "officialSha256": digest(margins),
          "features": ["age", "sex", "broad_occupation", "official_region"], "heldoutRows": len(y_test),
          "regularizationCV": cv_scores, "selectedC": selected_c,
          "heldoutLogLoss": heldout_loss, "prevalenceLogLoss": prevalence_loss,
          "heldoutByAge": by_age, "nationalMaxShareResidual": float(np.max(np.abs(fitted_margins - target))),
          "calibrationScope": "metropolitan_official_totals_on_human_survey_frame",
          "warning": "Stated 2022 intentions, not verified individual votes. This model alone does not establish persona-level accuracy or local calibration."}
    qa["heldoutImprovementOverPrevalence"] = prevalence_loss - heldout_loss
    qa["pilotHeldoutGainPositive"] = qa["heldoutImprovementOverPrevalence"] > 0
    temp = Path(str(index) + ".prior.tmp")
    count = 0
    with index.open(encoding="utf8") as source, temp.open("w", encoding="utf8") as output:
        batch = []
        def flush():
            nonlocal count
            if not batch: return
            rows = []
            for persona in batch:
                department = (persona.get("geography") or {}).get("departmentCode", "")
                rows.append(features(age_group(persona["age"]), "F" if normalized(persona["sex"]) == "femme" else "H",
                                     persona_work(persona["occupation"]), department_region.get(department, "unknown")))
            vectors = fitted.predict_proba(pd.DataFrame(rows)) * multipliers
            vectors /= vectors.sum(axis=1, keepdims=True)
            for persona, vector in zip(batch, vectors):
                persona["historicalPropensity"] = {
                    "electionId": ELECTION_ID, "scope": "survey_model_national_calibrated",
                    "modelVersion": VERSION, "surveySource": SURVEY_URL,
                    "pilotHeldoutGainPositive": qa["pilotHeldoutGainPositive"],
                    "probabilities": {option: float(value) for option, value in zip(classes, vector)},
                    "choiceLabels": labels,
                }
                output.write(json.dumps(persona, ensure_ascii=False, separators=(",", ":")) + "\n")
            count += len(batch)
            batch.clear()
        for line in source:
            if not line.strip(): continue
            batch.append(json.loads(line))
            if len(batch) >= 2048: flush()
        flush()
    temp.replace(index)
    manifest_path = Path(str(index) + ".manifest.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    qa["personaRows"] = count
    manifest["historyPrior"] = qa
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf8")
    return qa


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--index", type=Path, default=Path("data/radar/personas.jsonl"))
    parser.add_argument("--survey", type=Path, required=True)
    parser.add_argument("--margins", type=Path, required=True)
    parser.add_argument("--departments", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(run(args.index, args.survey, args.margins, args.departments), ensure_ascii=False))
