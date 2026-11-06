"""Validate the 2022 survey propensity model against alternatives with repeated cross-validation.

The survey (Voter Autrement 2022, Zenodo 18848264, CC-BY 4.0) has 5 usable predictors:
age, gender, work, region and agglomeration_size. This script answers, on withheld
respondents, whether each predictor set beats predicting prevalence, and whether the
gain survives (a) repeated resampling with a paired bootstrap interval and (b) leaving a
whole region out. It writes a JSON report; it never modifies a persona index.
"""
from __future__ import annotations

import argparse
import json
import unicodedata
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BLOC = {  # engine bloc definitions; Lassalle and Dupont-Aignan (sovereigntist) stay "other"
    "Nathalie Arthaud": "radical_left", "Philippe Poutou": "radical_left", "Jean-Luc Mélenchon": "radical_left",
    "Fabien Roussel": "left", "Anne Hidalgo": "left", "Yannick Jadot": "left",
    "Emmanuel Macron": "center", "Valérie Pécresse": "right",
    "Marine Le Pen": "far_right", "Éric Zemmour": "far_right", "Eric Zemmour": "far_right",
    "Jean Lassalle": "other", "Nicolas Dupont-Aignan": "other",
}
SPECS = {
    "prevalence": [],
    "age": ["age"],
    "work": ["work"],
    "age+sex+work+region (current)": ["age", "sex", "work", "region"],
    "age+sex+work": ["age", "sex", "work"],
    "age+sex+work+agglomeration": ["age", "sex", "work", "agglo"],
    "age+work+region+agglomeration": ["age", "work", "region", "agglo"],
    "all five": ["age", "sex", "work", "region", "agglo"],
    "all five + age×work": ["age", "sex", "work", "region", "agglo", "age_work"],
}


def norm(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode().lower().split())


def work_group(value: str) -> str:  # same grouping as train_history_prior.survey_work
    v = norm(value)
    for key, label in (("retraite", "retired"), ("employe", "employee"), ("ouvrier", "worker"), ("intermediaire", "intermediate"),
                       ("cadre", "executive"), ("agriculteur", "farmer_artisan_owner"), ("etudiant", "student")):
        if key in v:
            return label
    return "other_inactive"


def load(voters: Path, min_duration: float = 0) -> pd.DataFrame:
    rows = pd.read_csv(voters)
    rows = rows[rows["duration"] >= min_duration]  # 180 s reproduces the 1,972 published participants exactly
    outcomes = []
    for _, row in rows.iterrows():
        will = norm(row["will_vote"])
        if will == "non":
            outcomes.append("abstention")
        elif will != "oui":
            outcomes.append(None)
        else:
            vote = norm(row["vote_if_yes"])
            outcomes.append("blank_null" if vote in ("blanc", "nul") else next((name for name in BLOC if norm(name) == vote), None))
    rows["y"] = outcomes
    rows = rows[rows["y"].notna()].copy()
    rows["sex"] = rows["gender"]
    rows["agglo"] = rows["agglomeration_size"].fillna("unknown")
    rows["work"] = rows["work"].map(work_group)
    rows["age_work"] = rows["age"].astype(str) + "|" + rows["work"]
    rows["bloc"] = rows["y"].map(lambda v: v if v in ("abstention", "blank_null") else BLOC[v])
    return rows.reset_index(drop=True)


def make_model(cols: list[str], c: float):
    return Pipeline([("onehot", ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), cols)])),
                     ("lr", LogisticRegression(C=c, max_iter=2000))])


def fit_predict(train: pd.DataFrame, test: pd.DataFrame, cols: list[str], classes: list[str]) -> np.ndarray:
    """Probabilities over `classes`; C chosen by inner 3-fold CV on the training rows only."""
    if not cols:
        prevalence = train["y"].value_counts(normalize=True).reindex(classes).fillna(0).to_numpy()
        return np.tile(prevalence, (len(test), 1))
    best_c, best = 0.03, np.inf
    inner = RepeatedStratifiedKFold(n_splits=3, n_repeats=1, random_state=1)
    for c in (0.01, 0.03, 0.1, 0.3):
        losses = []
        for a, b in inner.split(train, train["bloc"]):
            model = make_model(cols, c).fit(train.iloc[a][cols], train.iloc[a]["y"])
            losses.append(log_loss_rows(train.iloc[b]["y"], proba(model, train.iloc[b][cols], classes), classes).mean())
        if np.mean(losses) < best:
            best, best_c = np.mean(losses), c
    model = make_model(cols, best_c).fit(train[cols], train["y"])
    return proba(model, test[cols], classes)


def proba(model, frame: pd.DataFrame, classes: list[str]) -> np.ndarray:
    raw = model.predict_proba(frame)
    out = np.full((len(frame), len(classes)), 1e-6)
    for j, label in enumerate(model.named_steps["lr"].classes_):
        out[:, classes.index(label)] = raw[:, j]
    return out / out.sum(axis=1, keepdims=True)


def log_loss_rows(y, p: np.ndarray, classes: list[str]) -> np.ndarray:
    idx = np.array([classes.index(v) for v in y])
    return -np.log(np.clip(p[np.arange(len(idx)), idx], 1e-9, 1))


def bloc_matrix(p: np.ndarray, classes: list[str], blocs: list[str]) -> np.ndarray:
    out = np.zeros((len(p), len(blocs)))
    for j, label in enumerate(classes):
        out[:, blocs.index(label if label in ("abstention", "blank_null") else BLOC[label])] += p[:, j]
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voters", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=Path("docs/radar/prior-validation.json"))
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--min-duration", type=float, default=0, help="drop respondents faster than this many seconds")
    args = parser.parse_args()
    data = load(args.voters, args.min_duration)
    classes = sorted(data["y"].unique())
    blocs = sorted(data["bloc"].unique())
    n = len(data)
    rng = np.random.default_rng(2026)
    cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=args.repeats, random_state=2026)
    folds = list(cv.split(data, data["bloc"]))
    per_resp = {name: np.zeros((args.repeats, n)) for name in SPECS}
    per_resp_bloc = {name: np.zeros((args.repeats, n)) for name in SPECS}
    correct = {name: np.zeros((args.repeats, n)) for name in SPECS}
    brier = {name: np.zeros((args.repeats, n)) for name in SPECS}
    onehot = np.zeros((n, len(classes)))
    onehot[np.arange(n), [classes.index(v) for v in data["y"]]] = 1
    bloc_idx = np.array([blocs.index(v) for v in data["bloc"]])
    for k, (train_idx, test_idx) in enumerate(folds):
        r = k // 5
        train, test = data.iloc[train_idx], data.iloc[test_idx]
        for name, cols in SPECS.items():
            p = fit_predict(train, test, cols, classes)
            per_resp[name][r, test_idx] = log_loss_rows(test["y"], p, classes)
            pb = bloc_matrix(p, classes, blocs)
            per_resp_bloc[name][r, test_idx] = -np.log(np.clip(pb[np.arange(len(test_idx)), bloc_idx[test_idx]], 1e-9, 1))
            correct[name][r, test_idx] = (p.argmax(axis=1) == onehot[test_idx].argmax(axis=1)).astype(float)
            brier[name][r, test_idx] = ((p - onehot[test_idx]) ** 2).sum(axis=1)
    base = "prevalence"
    report = {"respondents": n, "classes": classes, "blocs": blocs, "repeats": args.repeats, "specs": {}}
    for name in SPECS:
        mean_loss = per_resp[name].mean(axis=0)          # per respondent, averaged over repeats
        diff = per_resp[base].mean(axis=0) - mean_loss    # positive = better than prevalence
        boot = [diff[rng.integers(0, n, n)].mean() for _ in range(2000)]
        dbloc = per_resp_bloc[base].mean(axis=0) - per_resp_bloc[name].mean(axis=0)
        bootb = [dbloc[rng.integers(0, n, n)].mean() for _ in range(2000)]
        report["specs"][name] = {
            "logLoss": float(mean_loss.mean()), "gainVsPrevalence": float(diff.mean()),
            "gainCI95": [float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5))],
            "blocLogLoss": float(per_resp_bloc[name].mean()), "blocGain": float(dbloc.mean()),
            "blocGainCI95": [float(np.percentile(bootb, 2.5)), float(np.percentile(bootb, 97.5))],
            "top1Accuracy": float(correct[name].mean()), "brier": float(brier[name].mean()),
        }
    # Leave-one-region-out: does region transfer to places never seen?
    loro = {}
    regions = sorted(data["region"].unique())
    for name in ("prevalence", "age+sex+work", "age+sex+work+region (current)", "age+sex+work+agglomeration", "all five"):
        losses = np.zeros(n)
        for region in regions:
            test_mask = (data["region"] == region).to_numpy()
            p = fit_predict(data[~test_mask], data[test_mask], SPECS[name], classes)
            losses[test_mask] = log_loss_rows(data[test_mask]["y"], p, classes)
        loro[name] = float(losses.mean())
    report["leaveOneRegionOut"] = {name: {"logLoss": v, "gainVsPrevalence": loro["prevalence"] - v} for name, v in loro.items()}
    # How far can the best model move a persona away from the average? (heterogeneity)
    best = max((s for s in SPECS if s != base), key=lambda s: report["specs"][s]["gainVsPrevalence"])
    report["bestSpec"] = best
    model = make_model(SPECS[best], 0.1).fit(data[SPECS[best]], data["y"])
    p = proba(model, data[SPECS[best]], classes)
    prevalence = data["y"].value_counts(normalize=True).reindex(classes).to_numpy()
    report["heterogeneity"] = {label: {"prevalence": float(prevalence[j]), "p05": float(np.percentile(p[:, j], 5)), "p95": float(np.percentile(p[:, j], 95))}
                               for j, label in enumerate(classes) if prevalence[j] >= 0.04}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps({"respondents": n, "best": best, **{k: report["specs"][k] for k in report["specs"]}}, ensure_ascii=False, indent=1)[:6000])


if __name__ == "__main__":
    main()
