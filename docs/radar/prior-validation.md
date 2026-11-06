# Validation of the 2022 survey propensity model

Run on 6 Nov 2026 with `scripts/radar/validate_prior.py` (respondents) and `scripts/radar/validate_prior_places.py` (communes).
Data: Voter Autrement 2022 (Zenodo 18848264, CC-BY 4.0, `voters.csv`, md5 verified) and the retagged persona index. Raw reports: `prior-validation.json`, `prior-validation-places.json`.

## Verdict

The model is a **weak but real** signal. It is good enough to diversify a sample and to give a persona a faint historical lean; it is **not** good enough to say how an individual or a commune votes. Adding features does not help, so the limit is the data, not the model. The local commune calibration, not the persona model, produces commune-level accuracy.

## 1. Held-out respondents (2,032 labelled, 5-fold × 3 repeats, nested CV for regularization, paired bootstrap)

Gain = log-loss improvement over predicting plain prevalence (2.2096). 95% bootstrap interval in brackets.

| Predictors | Gain (nats) | Top-1 accuracy |
| --- | --- | --- |
| prevalence | 0 | 25.6 % |
| age only | 0.014 [0.005, 0.021] | 25.4 % |
| work only | 0.036 [0.024, 0.047] | 28.4 % |
| age+sex+work+region (current) | 0.038 [0.027, 0.049] | 28.4 % |
| age+sex+work | **0.040** [0.027, 0.053] | 28.6 % |
| age+sex+work+agglomeration | 0.039 [0.026, 0.050] | 28.6 % |
| all five predictors | 0.040 [0.029, 0.051] | 28.5 % |
| all five + age×work | 0.040 [0.028, 0.051] | 28.3 % |

- Every model beats prevalence (intervals exclude 0), by under 2 % of the log loss.
- Occupation carries most of the signal. Region, agglomeration size and an age×work interaction add nothing measurable; the differences between the last six rows are inside the noise.
- Leaving a whole region out gives the same gain (0.040 to 0.042), so the signal transfers to unseen regions as well as to unseen respondents.
- Predicted probabilities do differ across people (5th to 95th percentile: Le Pen 0.11 to 0.34, Macron 0.16 to 0.33, Mélenchon 0.07 to 0.20), but individual votes are far noisier than that spread.
- The survey has no education, household or commune-size field, so those cannot be added to this model.

## 2. Observed commune results (88 communes with at least 100 personas, 112,066 personas)

Survey-only prediction (before local calibration, which would match by construction) against observed 2022 first-round shares of registered voters. The model never saw commune data.

| Option | Observed mean ± sd | Predicted mean ± sd | Correlation across communes |
| --- | --- | --- | --- |
| Macron | 0.216 ± 0.059 | 0.197 ± 0.011 | 0.54 |
| Mélenchon | 0.203 ± 0.046 | 0.158 ± 0.010 | 0.71 |
| Le Pen | 0.119 ± 0.062 | 0.164 ± 0.018 | 0.76 |
| Zemmour | 0.057 ± 0.015 | 0.052 ± 0.005 | 0.65 |
| Pécresse | 0.035 ± 0.014 | 0.035 ± 0.004 | 0.58 |
| Abstention | 0.252 ± 0.055 | 0.267 ± 0.011 | 0.10 |

- It ranks communes in the right direction for the main candidates, but with **a quarter to a third of the real spread**.
- It has **no skill on abstention** (correlation 0.10), the outcome our event analysis relies on most.
- Mean absolute error per option is 0.0202, against 0.0212 for one flat national vector and 0.0186 for a flat vector set to the observed mean. The persona model barely beats a flat guess; the local calibration closes the rest.

## 3. Data issues found

- `voters.csv` has 2,122 rows, but the paper reports 1,972 participants. **Reconciled by arithmetic, not yet confirmed by the authors:** exactly 150 respondents have a completion time under 180 seconds (147 under 179 s, 152 under 181 s), and dropping them leaves exactly 1,972. They look different from the rest: 21 % are aged 18 to 24 (8 % in the rest) and 14 % gave an all-zero approval ballot (6 %). `--min-duration 180` applies the cut in `validate_prior.py` and `train_history_prior.py`.
- **Sensitivity:** repeating the respondent-level validation without those 150 (1,888 labelled) leaves every conclusion unchanged: current model gain 0.0385 [0.027, 0.050], best set tied with the simpler ones, leave-one-region-out gain 0.039 to 0.042 (`prior-validation-1972.json`). The delivered persona vectors were fitted on all 2,122 rows and were not recomputed, because the election margins needed to recalibrate were lost with the deleted worktree.
- Stated abstention is 4.7 % (96 of 2,032 labelled), against about 26 % observed in 2022. The abstention part of the model rests on 96 respondents and is rescaled afterwards by national intercepts only.
- Fieldwork ran 1 to 11 April 2022, so these are stated intentions before the election.

## Decision

- Keep the current model; do not add region, agglomeration or interaction terms. `age+sex+work` is statistically tied and simpler.
- Keep the persona vector as weak context and as a sampling stratifier only. Do not present it as a persona's vote.
- Do not use persona-level abstention for any claim.
- Real improvement needs new data: respondent-level microdata with education, household and place (ENEF 2024), or an abstention-focused survey.
