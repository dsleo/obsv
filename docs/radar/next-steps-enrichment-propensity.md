# Radar: what is next for persona enrichment and vote propensity

Written 6 Nov 2026. Self-contained note, meant to be lifted out into a ticket or hand-off. It follows the persona-tag audit ([`tag-audit.md`](./tag-audit.md)) and the propensity validation ([`prior-validation.md`](./prior-validation.md)).

## Where we stand

**Enrichment (done on part of the data)**
- Nemotron-Personas-France has 1,000,000 rows. We enriched **115,011 (11.5 %)**, kept as whole communes in 162 places, plus a separate 2,000-row distributed sample. The other roughly 885,000 rows are untouched.
- Tags: 67 closed tag ids (51 original, `education.brevet`, `marital.cohabiting`, 14 named clusters), ontology `fr-electorate-5`. Every persona has one value per family (age, sex, education, occupation, household, marital, density, commune size).
- The frame is skewed: 87 % of personas live in Paris, Lyon or Marseille, and 2.2 % are rural. Groups such as young farmers (145 personas) exist but are thin.
- 13 profession tags drawn from biographies are unusable, because narrative-rule tags are excluded from matching until audited.

**Vote propensity (done for 2022 only, weak)**
- Each persona has a 2022 first-round vector (12 candidates, abstention, blank) from a regularized multinomial model on 2,032 stated intentions, then tilted to official national shares and, in 73 communes (113,975 rows), minimum-KL calibrated to the observed commune result. 1,036 rows in very small communes keep the survey prior.
- 2024 European, 2024 legislative and 2026 municipal results are attached as **commune context only**, never as a persona's vote.

## Takeaways from the validation

1. The persona model is a **weak but real** signal: gain of 0.038 nats over predicting prevalence (95 % interval 0.027 to 0.049), under 2 % of the log loss, 28.4 % top-1 accuracy against 25.6 %.
2. **Adding predictors does not help.** Region, agglomeration size and an age×work interaction are all inside the noise. Occupation carries most of the signal. The survey has no education, household or commune-size field, so the limit is the data, not the model.
3. The signal **transfers to unseen regions** (leave-one-region-out gain 0.040 to 0.042).
4. Across 88 communes the survey-only prediction ranks places in the right direction for the main candidates (correlation 0.54 to 0.76) with a quarter to a third of the real spread, and has **no skill on abstention** (correlation 0.10). It barely beats a flat national guess. **The local calibration, not the persona model, delivers commune-level accuracy.**
5. Stated abstention in the survey is 4.7 % against about 26 % observed, and the abstention part rests on 96 respondents.
6. The survey file has 2,122 rows but the paper reports 1,972 participants. Unreconciled.
7. Practical rule: the persona vector is weak context and a sampling stratifier. It is not a persona's vote and must not back any abstention claim.

## What to do next, in order

### A. Unblock and reproduce (small)
- **Regenerate the geography file** (`geography-2026.json`). The worktree that held it was deleted; the pipeline cannot run `data:analyze` without it. Use `scripts/radar/build_geography.py` (needs INSEE COG and density downloads) and move the output into a path the repo documents. Done when `npm run data:analyze` runs from a clean checkout plus documented downloads.
- **Keep source data off ephemeral locations.** The raw survey, the election margins and the raw index must live somewhere versioned. `data/radar-index.lock.json` and `scripts/radar/fetch-index.mjs` already pin the two v5 indexes by hash; the host is still undecided.
- **Reconcile the survey count** (2,122 rows versus 1,972 participants) by writing to the dataset authors. Done when the gap is explained or the extra rows are excluded with a reason.

### B. Better individual-level propensity (the real lever, needs new data)
- **Get respondent-level 2024 data.** The CEVIPOF 2024 French electoral survey (ENEF 2024) was published by Sciences Po's data centre (CDSP) in February 2026: a panel of more than 10,000 registered voters in mainland France, covering 2023 to 2024. Whether the microdata is open or access-controlled is not confirmed; for the 2017 edition it was restricted to the academic community under CC BY-SA 4.0. An earlier attempt to download the respondent files returned HTTP 403. Next step: check the dataset record at the CDSP data repository, create an account and file an access request if needed, and ask which variables carry education, household, commune size and 2024 European and legislative vote or abstention.
- **If access is granted:** train 2024 vote and abstention vectors with education, household and place as predictors, evaluated like the 2022 model (repeated cross-validation, paired bootstrap, leave-one-region-out). Adopt a feature only if its interval clears the simpler model.
- **Treat abstention separately.** Use turnout targets rather than inferring it from a survey that over-represents voters. Done when persona-level abstention shows positive correlation with observed commune abstention.

### C. Use the election open data we already have (medium)
- The data.gouv.fr legislative-elections page links the Interior Ministry's polling-station results from 2002 to 2024, including the 2024 first and second rounds, in the "Données des élections agrégées" dataset. This is **aggregate** data, not respondent data, so it cannot train a persona's vote.
- It can: extend commune context and local calibration to communes beyond our 162, add the **second round** (we only hold first rounds), and let us backtest how well the calibrated prior predicts a later election in the same commune. Done when a held-out election (for example 2024 legislative against the 2022 calibration) is scored per commune.

### D. Widen and rebalance the persona frame (medium to large)
- Run the deterministic tagging over all 1,000,000 rows (cheap: tags come from raw fields via `scripts/radar/retag-index.ts` logic).
- Attach commune geography and election context for the remaining communes (needs the election margins for all communes).
- Rebalance toward rural and small communes so clusters such as young farmers and rural retirees reach usable sizes. Done when every named cluster has at least 20 personas in at least 3 communes **outside** Paris, Lyon and Marseille.
- Audit or drop the 13 biography-derived profession tags.

### E. Limits to keep in the product copy until B and C are done
- Say "profils synthétiques" and "hypothèse". No persona-level vote, no abstention claim, no vote-share shift.
- The local calibration matches official totals by construction. A match is a check of arithmetic, not of any individual prediction.

## Sources
- [Voter Autrement 2022 (Zenodo 18848264)](https://doi.org/10.5281/zenodo.18848264), CC-BY 4.0
- [CEVIPOF ENEF 2024, announced by the CDSP](https://www.sciencespo.fr/cdsp/fr/actualites/science-ouverte-l-enquete-electorale-2024-du-cevipof-publiee-par-le-cdsp/)
- [ENEF 2017 on recherche.data.gouv.fr](https://recherche.data.gouv.fr/en/dataset/french-electoral-survey-2017-enef-2017) (precedent for access terms)
- [Legislative elections datasets on data.gouv.fr](https://www.data.gouv.fr/pages/jeux-de-donnees-des-elections-legislatives)
