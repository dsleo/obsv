"""External place check of the survey prior: does the persona-level model, which never saw commune data,
reproduce between-commune differences in the observed 2022 first-round results?

Reads a retagged persona index (rows keep `nationalSurveyProbabilities` where a commune was calibrated, else the
survey prior is already in `probabilities`) and compares, per commune with >= --min-rows personas, the mean survey-only
prediction with the observed shares of registered voters. Baseline: the same national-average vector everywhere.
"""
import argparse, json
from collections import defaultdict
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("--index", required=True); ap.add_argument("--out", required=True); ap.add_argument("--min-rows", type=int, default=100)
a = ap.parse_args()
sums, counts, observed, labels = defaultdict(lambda: defaultdict(float)), defaultdict(int), {}, {}
for line in open(a.index, encoding="utf8"):
    if not line.strip(): continue
    p = json.loads(line); h = p["historicalPropensity"]
    vec = h.get("nationalSurveyProbabilities") or h["probabilities"]
    code = p["geography"]["communeCode"]
    counts[code] += 1
    for k, v in vec.items(): sums[code][k] += v
    if code not in observed:
        ctx = next(c for c in p["historicalContext"] if c["electionId"] == "2022_pres_t1")
        if not ctx["voteVectorEligible"]: observed[code] = None; continue
        o = {"abstention": ctx["abstentionShare"], "blank_null": ctx["blankNullShare"]}
        for c in ctx["choices"]: o[c["id"]] = c["shareOfRegistered"]
        observed[code] = o; labels = h["choiceLabels"]
codes = [c for c in counts if counts[c] >= a.min_rows and observed.get(c)]
keys = sorted(sums[codes[0]])
pred = np.array([[sums[c][k] / counts[c] for k in keys] for c in codes])
obs = np.array([[observed[c].get(k, 0.0) for k in keys] for c in codes])
weights = np.array([counts[c] for c in codes], float)
national = np.average(pred, axis=0, weights=weights)           # same vector everywhere
mae_model = np.abs(pred - obs).mean(); mae_flat = np.abs(national - obs).mean()
mae_flat_obs = np.abs(np.average(obs, axis=0, weights=weights) - obs).mean()   # oracle flat: observed national mean
out = {"communes": len(codes), "personas": int(weights.sum()), "minRows": a.min_rows,
       "maeModel": float(mae_model), "maeFlatPredicted": float(mae_flat), "maeFlatOracle": float(mae_flat_obs), "options": {}}
for j, k in enumerate(keys):
    r = float(np.corrcoef(pred[:, j], obs[:, j])[0, 1]) if obs[:, j].std() > 0 and pred[:, j].std() > 0 else None
    out["options"][labels.get(k, k)] = {"obsMean": float(obs[:, j].mean()), "obsSd": float(obs[:, j].std()), "predMean": float(pred[:, j].mean()), "predSd": float(pred[:, j].std()),
                                         "corr": r, "mae": float(np.abs(pred[:, j] - obs[:, j]).mean()), "maeFlatOracle": float(np.abs(obs[:, j].mean() - obs[:, j]).mean())}
json.dump(out, open(a.out, "w"), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in out.items() if k != "options"}))
for name, v in sorted(out["options"].items(), key=lambda x: -x[1]["obsMean"])[:8]:
    print(f"{name:24s} obs {v['obsMean']:.3f}±{v['obsSd']:.3f}  pred {v['predMean']:.3f}±{v['predSd']:.3f}  corr {v['corr'] if v['corr'] is None else round(v['corr'],2)}  mae {v['mae']:.3f} vs flat-oracle {v['maeFlatOracle']:.3f}")
