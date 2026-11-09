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

