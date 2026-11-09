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

_(filled in as work progresses: each entry = what we tried, result, decision)_
