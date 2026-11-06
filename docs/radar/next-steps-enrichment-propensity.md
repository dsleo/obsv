# Radar: persona enrichment and vote propensity, status and next steps

Updated 6 Nov 2026. Self-contained note, meant to be lifted out into a ticket or hand-off. It builds on the persona-tag audit ([`tag-audit.md`](./tag-audit.md)) and the propensity validation ([`prior-validation.md`](./prior-validation.md)).

## 1. Where we stand

**Enrichment: done on 11.5 % of the data**
- Nemotron-Personas-France has 1,000,000 rows. We enriched **115,011**, kept as whole communes in 162 places, plus a separate 2,000-row distributed sample used for global scenarios. The other roughly 885,000 rows are untouched.
- 67 closed tag ids (ontology `fr-electorate-5`): the 51 original ones, `education.brevet`, `marital.cohabiting` and 14 named audience clusters such as `cluster.young_farmer`. Every persona has exactly one value per family (age, sex, education, occupation, household, marital, density, commune size).
- The frame is skewed: 87 % of personas live in Paris, Lyon or Marseille and 2.2 % are rural. Rural clusters exist but are thin (145 young farmers, 784 rural retirees).
- 13 profession tags drawn from biographies are unusable, because biography-derived tags are excluded from matching until audited.

**Vote propensity: 2022 only, weak**
- Each persona has a 2022 first-round vector (12 candidates, abstention, blank) from a regularized multinomial model on 2,032 stated intentions (age, sex, broad occupation, region), tilted to official national shares and, in 73 communes (113,975 rows), minimum-KL calibrated to the observed commune result. 1,036 rows in very small communes keep the survey prior.
- 2024 European, 2024 legislative and 2026 municipal results are attached as **commune context only**, never as a persona's vote.

## 2. What was done (to 6 Nov 2026)

| Area | Result | Where |
| --- | --- | --- |
| Tag audit over all 115,011 rows | Found and fixed tagging bugs: couples without children were tagged as with children (61 % shown, 34 % true); "Professions intermédiaires", "Brevet" and "Concubinage" were untagged; Paris/Lyon/Marseille arrondissements had no density, so 43 % of personas had no `geo` tag | `tag-audit.md`, `src/lib/radar/ontology.ts` |
| New tags and clusters | `education.brevet`, `marital.cohabiting`, 14 clusters; all clusters reach the engine's minimum of 20 personas in 3 communes | `ontology.ts`, `tag-audit.md` |
| Index rebuilt | `data:retag` rewrote both indexes as `fr-electorate-5`, preserving all election context and vectors | `scripts/radar/retag-index.ts` |
| LLM segment filters | Deterministic repair of same-family tags, spurious gaps dropped, outcome words moved to "à mesurer": filterable segments went from 12/19 to 19/20 on the demo events | `pipeline/radar/filters.ts` |
| Respondent-level validation | Repeated 5-fold CV, nested regularization, paired bootstrap, leave-one-region-out | `scripts/radar/validate_prior.py`, `prior-validation.md` |
| Commune-level validation | Survey-only prediction against observed 2022 results in 88 communes | `scripts/radar/validate_prior_places.py` |
| Geography regenerated | `geography-2026.json` (34,920 communes) rebuilt from INSEE COG 2026 and the 2026 density workbook; all 207 communes of the index match except the 45 arrondissements, which inherit the parent's values by design. The 2025 workbook is not interchangeable (2022 populations) | `data/radar-geography.lock.json`, `pipeline.md` |
| Survey count reconciled | 2,122 rows against 1,972 published: exactly 150 respondents finished in under 180 s. Dropping them changes no conclusion | `prior-validation.md`, `--min-duration` |

## 3. Takeaways

1. The persona model is a **weak but real** signal: gain of 0.038 nats over predicting prevalence (95 % interval 0.027 to 0.049), under 2 % of the log loss, 28.4 % top-1 accuracy against 25.6 %. Dropping the 150 fast respondents gives 0.0385 [0.027, 0.050].
2. **Adding predictors does not help.** Region, agglomeration size and an age×work interaction are inside the noise; occupation carries most of the signal. The survey has no education, household or commune-size field, so the limit is the data, not the model.
3. The signal **transfers to unseen regions** (leave-one-region-out gain 0.039 to 0.042).
4. In 88 communes the survey-only prediction ranks places in the right direction for the main candidates (correlation 0.54 to 0.76) but with a quarter to a third of the real spread, and has **no skill on abstention** (correlation 0.10). It barely beats a flat national guess. **The local calibration, not the persona model, delivers commune-level accuracy.**
5. Stated abstention in the survey is 4.7 % against about 26 % observed; the abstention part rests on 96 respondents and is rescaled by national intercepts only.
6. Practical rule: the persona vector is weak context and a sampling stratifier. It is not a persona's vote and must not back any abstention claim.
7. Lost work is expensive: the worktree that held the raw survey, election margins and geography was deleted, so the persona vectors cannot be recomputed today. Source data and its hashes must be kept.

## 4. What to do next, in order

### A. Make the work reproducible (small, do first)
- **Re-download and pin the election margins** from the data.gouv.fr "Données des élections agrégées" dataset with `scripts/radar/import_elections.py`, and record URLs and hashes in a lock file next to `data/radar-geography.lock.json`. Without them, the prior cannot be refit or recalibrated.
- **Refit the prior** with `train_history_prior.py --min-duration 180`, then re-run local calibration and the commune check. Expect small changes only.
- **Write to the survey authors** to confirm the under-180-second exclusion behind the 1,972 figure.
- **Host the persona indexes** somewhere versioned (`data/radar-index.lock.json` already pins them; the host is still open).
- Done when a clean checkout plus documented downloads rebuilds the indexes and the vectors.

### B. Use aggregate election data to improve the prior (medium, highest value without microdata)
The data.gouv.fr legislative-elections page links the Interior Ministry's polling-station results from 2002 to 2024, including the 2024 first and second rounds. It is **aggregate**, so it cannot give a persona's vote, but it targets the two weak points (too little spread between places, no skill on abstention):
1. **Ecological model across all communes.** Join polling-station results (about 35,000 communes) to INSEE census composition by commune (age, sex, occupation, diploma, household) and fit vote and turnout shares on it. Unlike the survey, it sees education and household, and every region. Use it to replace or reweight the survey prior. Risk: ecological fallacy, since cross-commune patterns are not individual behaviour. Control: score it with `validate_prior_places.py` on held-out communes; adopt it only if it recovers clearly more of the real between-commune spread than the survey model's quarter to a third.
2. **Abstention.** Turnout is observed at every polling station, so abstention can be learned from far more data than 96 survey abstainers. Done when persona-level abstention correlates positively with observed commune abstention.
3. **More elections as constraints.** Add the 2024 European and legislative first rounds and the second rounds as calibration targets, and estimate 2022-to-2024 vote transitions per commune, to give personas 2024-consistent vectors without individual data.
4. **Backtest.** Score the 2022 calibration against 2024 results in the same communes (temporal hold-out), and score the national model on communes outside the 162 selected.
- Done when the ecological prior beats the survey prior on held-out communes and the metrics are recorded in `prior-validation.md`.

### C. Individual-level 2024 data (needs access)
- The CEVIPOF 2024 French electoral survey (ENEF 2024) was published by Sciences Po's data centre (CDSP) in February 2026: a panel of more than 10,000 registered voters in mainland France, covering 2023 to 2024. Whether the microdata is open or access-controlled is **not confirmed**; the 2017 edition was restricted to the academic community, and an earlier download attempt of the 2024 respondent files returned HTTP 403.
- Next step: check the dataset record at the CDSP data repository, create an account and file an access request if needed, and ask which variables carry education, household, commune size and 2024 European and legislative vote or abstention.
- If granted: train 2024 vote and abstention vectors with education, household and place, validated like the 2022 model (repeated CV, paired bootstrap, leave-one-region-out). Adopt a feature only if its interval clears the simpler model.

### D. Widen and rebalance the persona frame (medium to large)
- Run the deterministic tagging over all 1,000,000 rows (cheap: tags come from raw fields, via the `retag-index.ts` logic).
- Attach commune geography and election context for the remaining communes (needs the margins from A).
- Rebalance toward rural and small communes so clusters such as young farmers and rural retirees become usable. Done when every named cluster has at least 20 personas in at least 3 communes **outside** Paris, Lyon and Marseille.
- Audit or drop the 13 biography-derived profession tags.

### E. How the vectors are used in event analysis (small, independent)
- Enlarge the sample per group from 6 personas and repeat each analysis several times to measure stability; at 6 personas the direction counts are noisy.
- Keep the prior only as a sampling stratifier and weak context. Stop presenting any persona-level lean as a prediction.
- Validate the event-response step on past events with pre and post survey data; an earlier US sanity check had the directional prompt right on only 3 of 7 conclusive contrasts.

### F. Product wording until B and C are done
- Say "profils synthétiques" and "hypothèse". No persona-level vote, no abstention claim, no vote-share shift.
- The local calibration matches official totals by construction. A match checks the arithmetic, not any individual prediction.

## 5. Sources
- [Voter Autrement 2022 (Zenodo 18848264)](https://doi.org/10.5281/zenodo.18848264), CC-BY 4.0
- [CEVIPOF ENEF 2024, announced by the CDSP](https://www.sciencespo.fr/cdsp/fr/actualites/science-ouverte-l-enquete-electorale-2024-du-cevipof-publiee-par-le-cdsp/)
- [ENEF 2017 on recherche.data.gouv.fr](https://recherche.data.gouv.fr/en/dataset/french-electoral-survey-2017-enef-2017) (precedent for access terms)
- [Legislative elections datasets on data.gouv.fr](https://www.data.gouv.fr/pages/jeux-de-donnees-des-elections-legislatives)
- [INSEE COG 2026](https://www.insee.fr/fr/information/8740222) and [INSEE density grid](https://www.insee.fr/fr/information/8571524)
