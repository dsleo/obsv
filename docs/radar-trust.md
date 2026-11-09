# Making the subpopulation analysis trustworthy

Branch `feature/radar-trust`. Log of problems found in the first full backfill, what we tried, and whether it worked.
Rule: every fix is measured (before/after) with the checks below, not judged by eye.

## Baseline (method `radar-directional-v1`, 99 events, 115,011 personas, `gpt-4.1-mini-2025-04-14`)

Backfill result, measured on `data/generated/analyses/*.json`:

| Metric | Baseline |
|---|---|
| Events analysed | 99 |
| Events with no usable segment | 20 (20 %) |
| Segments by status | 286 ok, 47 invalid_filter, 34 insufficient_sample, 16 incomplete_membership (of 383) |

(Runtime: the first attempt rescanned the 1.8 GB persona file about 5× per event and took > 1 h for ~25 events. After the slim in-memory index, all 99 events took a few minutes.)

## Problems found (review of the first 19 finished events)

| # | Problem | Evidence |
|---|---|---|
| P1 | No turnout / magnitude estimate: only counts "toward / away / no change" on 6 personas; abstention almost never moves | 1 event of 19 shows any abstention change |
| P2 | Segments are generic archetypes reused for every event | "Salariés modestes" = 34,763 people (30 % of the index) in most events |
| P3 | Empty / invalid segment filters | 20 of 99 events have no usable segment (incl. Le Pen's Orléans launch) |
| P4 | Unanimous 6/0 outcomes: stereotyping, not variance | Mélenchon programme: every segment +6 radical_left, −6 centre, −6 far right |
| P5 | Global scenarios contradict each other (6 personas from a 2,000-row sample) | Attal primary: global_1 centre +2 / far right −2 vs global_2 left +3 / centre +6 / far right −6 |
| P6 | Counterfactuals sometimes invent an intervention unrelated to the event | Trappes attack → "dialogue workshops" |
| P7 | Incoherent bloc moves (toward several blocs at once; far right "away" when a left candidate withdraws) | Macron coalition, Ruffin withdrawal |
| P8 | No way to know whether the method predicts anything real | no backtest existed |

## Measurement tools

- **Backtest** (`scripts/backtest-analyses.ts`): predicted direction per bloc vs the real change in polls around the event; reported with a permutation baseline (chance level).
- **Structure metrics**: share of events with ≥ 1 usable segment, segment size distribution, segment diversity.
- **Stability**: run twice with different seeds, share of identical directions.
- **Controls**: unrelated events that should produce ~0 shift (false-positive rate).

## Log

### 1. Backtest of the baseline (P8) — `scripts/backtest-analyses.ts`

Predicted net shift per bloc (sum of toward − away over all contrasts / sampled personas) vs the real change in first-round polls (mean share in the N days after the event minus the N days up to it; blocs mapped to poll candidates in one constant). Permutation baseline: artifacts shuffled across events 2,000×.

| window | scope | events | pairs used for sign | sign agreement | chance | p | Pearson |
|---|---|---|---|---|---|---|---|
| 7 d | all blocs | 85 | 161 | 56.5 % | 49.0 % | 0.024 | 0.04 |
| 7 d | blocs of the named candidates | 85 | 67 | 52.2 % | 49.6 % | 0.37 | −0.11 |
| 14 d | all blocs | 91 | 169 | 51.5 % | 51.6 % | 0.52 | 0.00 |
| 14 d | blocs of the named candidates | 91 | 64 | 51.6 % | 51.7 % | 0.48 | −0.04 |

**Reading:** baseline is indistinguishable from chance (one nominally significant cell out of four, which is expected by luck; correlations ≈ 0). Caveats: only 47 polls, median 6 polls within ±7 d of an event, overlapping windows (pairs are not independent, so the p-values are optimistic), many event candidates belong to no polled bloc (Ruffin, Polony, Lecornu, Villepin…).
**Decision:** every later change is scored with this harness; "trustworthy" means beating chance here, not just looking plausible.

### 2. Probability output with bigger, repeated samples (P1, P4, P7) — `pipeline/radar/probabilisticResponse.ts`, `--method v2`

What changed vs `radar-directional-v1`:
- Each persona gets a **baseline** distribution over 5 blocs + abstention (deterministic mapping of its 2022 survey-model propensity, e.g. Mélenchon/Poutou/Arthaud → radical left).
- The model returns two distributions per persona, **with** and **without** the event (counterfactual in the same call), each summing to 1, told to stay at baseline unless the event gives a concrete reason. Effect = difference. Because both sum to 1, a gain for one bloc is a loss for another or for abstention: incoherent "toward several blocs at once" (P7) is impossible by construction.
- Abstention is estimated explicitly (P1), in points.
- Bloc order is shuffled in the prompt (seeded) against positional bias.
- 24 personas per run per segment (was 6), 2 independent runs (different sample seeds), 48 per run for the global scenario. Mean effect with bootstrap 95 % interval over personas; `stable` = same sign in both runs.
- Artifact: new optional `effect` per bloc, `runs`, `mechanisms`; the old `summary` counts are kept (|Δ| ≥ 2 pts) so the UI keeps working.

First look at 3 events (13 contrasts): mean |effect| 0.92 pt, max 4.2 pt, 35 % of bloc effects stable and significant. Effects are of plausible size (communist-group endorsement of Mélenchon: radical left +3 to +4 pt, far right −2 to −4 pt, abstention ~+1 pt) and weak/unstable effects are visibly flagged (e.g. second global scenario for the Glucksmann/LFI event). Caveat: the interval only covers persona sampling, not model variability; the `stable` flag covers part of that.

### 3. Segment proposal: validation, repair loop, event specificity (P2, P3, P5, P6) — `pipeline/radar/pipeline.ts`, `segmentRepair.ts`

- Reject segments with < 100 personas (20 for a named commune), > 25 % of the index, < 3 communes, duplicates (Jaccard > 0.8 on member ids), or a stock archetype that shares no word with the event.
- Up to 2 LLM repair rounds that receive the rejected segments with exact reasons; then a deterministic fallback (widen the place, drop `none`, drop the last `all` tag, move to a cluster), each step logged in `repairs`.
- Prompt now asks for publics specifically concerned by the event's mechanism and at least one narrow segment.
- Global scenario is a template (the event / the event does not happen), not model-invented. A segment counterfactual with < 2 content words in common with the event is replaced by the template.
- Finding: most baseline failures were **named places absent from the index** (Orléans, Trappes, Angers have 0 personas) and `any`/`all` conflicts, not invented tag ids (the schema enum already blocks those).

Result on the full 99-event run (v2 run, all 312 retained segments usable):

| | baseline | after |
|---|---|---|
| events with ≥ 1 usable segment | 79 (80 %) | 99 (100 %) |
| usable segments / total | 286 / 383 | 312 / 312 (rejected ones are dropped) |
| median segment size | 8,781 | 4,569 |
| distinct segment names | 208 / 383 | 288 / 312 |
| most common name | "Jeunes diplômés urbains" ×34 + "Salariés modestes" ×20 | "Jeunes diplômés urbains de moins de 35 ans" ×10 |

Remaining: 7 of 26 events tested in isolation end with exactly 2 segments; fallback segments skip the specificity check and can end up as stock archetypes (e.g. a generic audience for Trappes); place-specific segments are impossible while the index has no persona in the place.

### 4. Control events and false positives (P4) — `scripts/fixtures/control-events.json`, `scripts/score-effects.ts`

6 neutral events (football calendar, weather alert, stamp price, jazz festival, car launch, rugby result) run through v2.

| | controls (6 events, 26 contrasts) | real events (99 events, 407 contrasts) |
|---|---|---|
| mean absolute effect per bloc | 0.29 pt | 0.80 pt |
| bloc effects stable across runs AND CI excludes 0 AND ≥ 1 pt | 3.8 % | 28.6 % |
| max absolute effect | 1.7 pt | 5.3 pt |

So v2 separates real events from noise by a factor ~3 in size and ~7 in "significant" rate: false positives are low but not zero. **Systematic bias found:** the far-right effect is negative on the controls too (−0.44 pt on average) and in 82 of 99 real events; abstention rises on almost any event (+0.30 pt on controls, +0.81 pt on real events). The model has a reflex "an event lowers the far right / raises abstention".

### 5. Full v2 run vs real polls

| window | scope | sign agreement | chance | p |
|---|---|---|---|---|
| 7 d | all blocs | 51.6 % | 50.8 % | 0.41 |
| 7 d | concerned blocs | 42.6 % | 45.9 % | 0.70 |
| 14 d | all blocs | 57.4 % | 57.6 % | 0.53 |
| 14 d | concerned blocs | 50.0 % | 57.7 % | 0.90 |

Placebo-corrected (control mean subtracted per bloc, `BIAS_DIR=...`): no change, still chance (14 d all blocs 58.8 % vs 62.1 % chance). Weekly aggregate (`scripts/backtest-weekly.ts`, 45 bloc-weeks): Pearson 0.12 (0.11 corrected), not distinguishable from 0 at that n.

**Scale check (cumulative effects over the 99 events vs real poll drift, September → November):** radical left +27 pt vs +1.3 real; left +22 vs −0.8; centre −33 vs 0.0; right +0.3 vs +0.1; far right −97 vs −2.3. The effects are conditional on a persona being fully aware of the event; real exposure and persistence are a small fraction, so these numbers are not population effects.

### 6. What the backtest teaches us (`scripts/backtest-learn.ts`, v2 run, ±14 d, 455 event×bloc pairs, 91 events)

All 99 collected events are already used (91 have polls on both sides). The API only has events from 2026-09 (checked: 0 events before September), and there are ~13 first-round polls a month in Sept–Oct, so there is no more data to add from the API.

| Slice | Sign agreement | Reading |
|---|---|---|
| overall | 57 % of 176 (majority-sign guess: 51 %) | barely above a constant guess |
| **detrended** (per-bloc mean predicted and observed removed) | **53 % of 212**, slope −0.01, R² 0.0004 | the signal is gone once each bloc's overall drift is removed |
| centre | 73 % raw, **56 % detrended** | the raw score only reflected "centre falls over the period" (predicted −0.36 pt, observed −0.77 pt) |
| radical left / far right | 39 % / 44 % raw | model predicts far right −0.95 pt on average while polls show +0.08: the systematic bias costs accuracy |
| \|predicted\| 0.5–1 / 1–2 / ≥ 2 pt | 70 % / 46 % / 36 % | **the bigger the prediction, the worse it is**: overconfidence |
| major / notable events | 68 % / 54 % | small n (41 vs 135 pairs) |
| endorsement, candidacy / campaign_visit | 65 % / 31 % | small n, to re-test |
| global scenario only / segments only | 53 % / 58 % | no clear gain from the segments |
| pairs with ≥ 8 polls around | 63 % of 127 | cleaner outcome helps a little |
| regression observed = slope × predicted | slope 0.04, R² 0.003 | predicted effects ~25× larger than observed; explain < 1 % of variance |

Learnings to apply (ordered): (1) do not publish magnitudes; (2) cap or shrink large predicted effects (large = least reliable); (3) remove the per-bloc bias with a larger control set (25–30) and verify the correction is stable; (4) anchor baselines on **current** 2026 poll levels instead of the 2022 survey prior; (5) test whether event type or importance genuinely predicts reliability on more data; (6) a richer outcome than 47 polls (more pollsters, daily trackers, or a past campaign) is the real bottleneck.

## Where each problem stands

| # | Problem | Status |
|---|---|---|
| P1 | No turnout / magnitude | **Fixed in form**: v2 gives effect in points with interval and an explicit abstention effect. Not validated (see P8) and biased up on abstention (+0.3 to +0.8 pt on any event). |
| P2 | Generic segments | **Largely fixed**: no segment > 25 %, 288 distinct names over 312, narrower. Some fallback segments still generic. |
| P3 | Empty / invalid segments | **Fixed**: 99/99 events with usable segments (was 79/99). |
| P4 | Unanimity / stereotyping | **Improved**: with 24 personas × 2 runs and an explicit "stay at baseline" rule only 28.6 % of bloc effects are stable-significant; controls ≈ 0. A far-right-negative / abstention-positive reflex remains. |
| P5 | Contradictory global scenarios | **Fixed by design**: one template scenario, 48 personas × 2 runs. |
| P6 | Invented counterfactuals | **Fixed**: relevance check (fired 1 time in 79 segments tested). |
| P7 | Incoherent bloc moves | **Fixed by construction** (distributions sum to 1). |
| P8 | No validation | **Harness built; method not validated.** Baseline and v2 are both at chance against polls. |

## Conclusions and what it would take to trust the numbers

1. The **structure** is now sound and measured (usable segments, specificity, stability, controls). This part can ship as hypotheses with the existing "hypothesis" label and human approval.
2. The **magnitudes are not trustworthy**: not validated against polls, overstated ≥ 10× in cumulative terms, with a systematic bias. Do not present them as estimated vote changes. If shown, show them as "effect if fully exposed", with the interval and the stability flag, or as ranks (who is most affected) only.
3. **Why the backtest cannot confirm anything yet:** 47 polls, ~6 polls per ±7-day window, poll sampling noise of ~±1–2 pt per bloc-week, against true per-event effects of a fraction of a point. With ~180 usable pairs the test only detects a method that is right ≥ ~57–60 % of the time. A null result here means "not demonstrated", not "disproved". Confounding (many events per week) adds to it.
4. Next steps, in order of value:
   - Add an **exposure / persistence factor** (e.g. share of the population reached by the event, from `publisher_count` and a decay) so cumulative effects are comparable to polls; fit it on the weekly series.
   - **More controls (20–30)** and subtract the per-bloc bias only if it is stable; re-test with the backtest.
   - Backtest on **past real shocks with known outcomes** (not only the Sept–Nov window), e.g. 2022 events with the 2022 polls, which gives far more power.
   - Make the segment index **geo-complete** (persona coverage for Orléans, Trappes, Angers…) so place-specific events get place-specific segments.
   - Ask for **human review** of the 10 largest predicted effects before publishing anything.

## Reproduce

```sh
npm run data:analyze -- --method v2 --out data/generated/analyses-v2   # new method, separate output dir
npm run data:analyze -- --method v2 --events scripts/fixtures/control-events.json --out /tmp/ctrl
npx tsx scripts/score-effects.ts /tmp/ctrl
npx tsx scripts/backtest-analyses.ts data/generated/analyses-v2        # per-event sign agreement vs polls
BIAS_DIR=/tmp/ctrl npx tsx scripts/backtest-weekly.ts data/generated/analyses-v2
```
