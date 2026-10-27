"""Run an adjacent human-data check of directional contrast elicitation.

Study 3 of Hackenburg et al. (Nature Communications 2025) randomized US
respondents to pro-policy messages or neutral controls. This evaluates whether
the direction prompt beats an always-"toward" baseline on eight policy-support
subgroups. It does NOT validate French vote-intention effects.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel


SOURCE = "https://doi.org/10.17605/osf.io/8yxvr"
TOPICS = {
    "carbon": "a carbon tax",
    "parental": "a paid parental leave program",
    "child": "a child tax credit",
    "register": "automatic voter registration",
}


def score(frame: pd.DataFrame, topic: str, wave: int) -> pd.Series:
    fields = [f"agre_{topic}_{wave}_1", f"agre_{topic}_{wave}_4", f"agre_{topic}_{wave}_11",
              f"sup_{topic}_{wave}_1", f"vt_{topic}_{wave}_1"]
    values = frame[fields].apply(pd.to_numeric, errors="coerce")
    values.iloc[:, 1] = 100 - values.iloc[:, 1]
    return values.mean(axis=1, skipna=False)


def cases_from_humans(data: Path) -> list[dict]:
    frame = pd.read_csv(data, low_memory=False)
    frame = frame[(frame["atten_check"] == "1,3") & (frame["Finished"] == 1)].copy()
    frame = frame.drop_duplicates("ResponseId")
    cases = []
    rng = np.random.default_rng(2026)
    for topic, policy in TOPICS.items():
        subset = frame[frame["condition"] == topic].copy()
        subset["before"] = score(subset, topic, 1)
        subset["after"] = score(subset, topic, 2)
        subset = subset.dropna(subset=["before", "after"])
        cutoff = float(subset["before"].median())
        for band, group in (("lower", subset[subset["before"] <= cutoff]),
                            ("higher", subset[subset["before"] > cutoff])):
            treatment = (group[group["treatment"] == "treat"]["after"] - group[group["treatment"] == "treat"]["before"]).to_numpy()
            control = (group[group["treatment"] == "control"]["after"] - group[group["treatment"] == "control"]["before"]).to_numpy()
            if min(len(treatment), len(control)) < 30: raise ValueError(f"Insufficient human support: {topic}/{band}")
            estimate = float(treatment.mean() - control.mean())
            boot = np.array([rng.choice(treatment, len(treatment), replace=True).mean() - rng.choice(control, len(control), replace=True).mean()
                             for _ in range(2000)])
            lower, upper = np.quantile(boot, [.025, .975])
            observed = "toward" if lower > 0 else "away" if upper < 0 else "inconclusive"
            cases.append({"id": f"{topic}_{band}", "policy": policy, "baselineBand": band,
                          "meanPreSupport": float(group["before"].mean()),
                          "treatmentN": len(treatment), "controlN": len(control),
                          "humanEffectPoints": estimate, "ci95": [float(lower), float(upper)],
                          "observedDirection": observed})
    return cases


class Prediction(BaseModel):
    id: str
    direction: Literal["toward", "away", "no_clear_change"]
    reason: str


class Predictions(BaseModel):
    predictions: list[Prediction]


def call_model(cases: list[dict]) -> tuple[str, list[dict]]:
    load_dotenv(".env.local")
    if not os.getenv("OPENAI_API_KEY"): raise ValueError("OPENAI_API_KEY missing")
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    client = OpenAI()
    prompt = [{"id": case["id"], "policy": case["policy"], "baselineSupportBand": case["baselineBand"],
               "meanPreSupportOn0To100Scale": round(case["meanPreSupport"], 1)} for case in cases]
    completion = client.chat.completions.parse(
        model=model,
        messages=[{"role": "system", "content":
                   "Predict only the DIRECTION of relative opinion change conditional on exposure. Compare a persuasive message advocating each named policy with a neutral unrelated message. The respondents are US adults; the outcome is policy support, not vote choice. 'No clear change' is appropriate when the contrast is weak or uncertain. Do not give numerical point estimates. Return one prediction per case with its exact ID."},
                  {"role": "user", "content": json.dumps(prompt)}],
        response_format=Predictions,
    )
    parsed = completion.choices[0].message.parsed
    if parsed is None: raise ValueError("No structured model output")
    results = [item.model_dump() for item in parsed.predictions]
    if len(results) != len(cases) or {item["id"] for item in results} != {case["id"] for case in cases}:
        raise ValueError("Model omitted or duplicated benchmark cases")
    return model, results


def run(data: Path, output: Path, use_model: bool) -> dict:
    cases = cases_from_humans(data)
    model, predictions = call_model(cases) if use_model else (None, [])
    by_id = {item["id"]: item for item in predictions}
    for case in cases:
        case["modelPrediction"] = by_id.get(case["id"])
    conclusive = [case for case in cases if case["observedDirection"] != "inconclusive"]
    model_correct = sum(by_id[case["id"]]["direction"] == case["observedDirection"] for case in conclusive) if use_model else None
    always_toward = sum(case["observedDirection"] == "toward" for case in conclusive)
    report = {"source": SOURCE, "dataSha256": hashlib.sha256(data.read_bytes()).hexdigest(),
              "model": model, "cases": cases, "conclusiveCases": len(conclusive),
              "modelCorrect": model_correct, "alwaysTowardCorrect": always_toward,
              "interpretation": "Adjacent directional prompt check only. US policy-persuasion responses do not establish accuracy for French electoral events or vote intention."}
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
    return {key: report[key] for key in ("source", "model", "conclusiveCases", "modelCorrect", "alwaysTowardCorrect", "interpretation")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=Path("data/radar/response-backtest.json"))
    parser.add_argument("--no-model", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(args.data, args.out, not args.no_model)))
