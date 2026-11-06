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

### A. Unblock and reproduce (done 6 Nov, except the items marked open)
- **Geography file regenerated.** `data/radar/geography-2026.json` (34,920 communes) was rebuilt from INSEE COG 2026 (`v_commune_2026.csv`, `v_departement_2026.csv`) and the 2026 density workbook (`fichier_diffusion_2026.xlsx`, population 2023) with `scripts/radar/build_geography.py`. Inputs, URLs and hashes are in `data/radar-geography.lock.json`. All 207 communes of the v5 persona index match on code, department, parent commune, density and population; the only differences are the 45 Paris/Lyon/Marseille arrondissements, where the index inherits the parent commune's values by design. The 2025 workbook is not interchangeable: it carries 2022 populations.
- **Survey count reconciled** (2,122 rows against 1,972 published): exactly the 150 respondents under 180 seconds. Open: confirm with the authors, then refit the prior with `--min-duration 180` when the election margins are available again.
- **Open: keep source data off ephemeral locations.** The raw election margins, the raw index and the Zenodo files are not versioned; the worktree that held them was deleted. `data/radar-index.lock.json` pins the two v5 indexes; the host is still undecided.

### B. Better individual-level propensity (the real lever, needs new data)
- **Get respondent-level 2024 data.** The CEVIPOF 2024 French electoral survey (ENEF 2024) was published by Sciences Po's data centre (CDSP) in February 2026: a panel of more than 10,000 registered voters in mainland France, covering 2023 to 2024. Whether the microdata is open or access-controlled is not confirmed; for the 2017 edition it was restricted to the academic community under CC BY-SA 4.0. An earlier attempt to download the respondent files returned HTTP 403. Next step: check the dataset record at the CDSP data repository, create an account and file an access request if needed, and ask which variables carry education, household, commune size and 2024 European and legislative vote or abstention.
- **If access is granted:** train 2024 vote and abstention vectors with education, household and place as predictors, evaluated like the 2022 model (repeated cross-validation, paired bootstrap, leave-one-region-out). Adopt a feature only if its interval clears the simpler model.
- **Treat abstention separately.** Use turnout targets rather than inferring it from a survey that over-represents voters. Done when persona-level abstention shows positive correlation with observed commune abstention.

### C. Use aggregate election data to improve the model (medium, highest value without microdata)
The data.gouv.fr legislative-elections page links the Interior Ministry's polling-station results from 2002 to 2024 (2024 first and second rounds included), part of the "Données des élections agrégées" dataset. It is **aggregate**, so it cannot give a persona's vote, but it can address the model's two weak points (little spread between places, no skill on abstention):
1. **Ecological model across all communes.** Join polling-station results (about 35,000 communes) to INSEE census composition by commune (age, sex, occupation, diploma, household) and fit vote and turnout shares on that composition. Unlike the survey, this sees education and household, and it sees every region. Use it to replace or reweight the survey prior. Known risk: ecological fallacy (cross-commune patterns are not individual behaviour). Control: score it exactly like the survey model, with the commune-level check in `validate_prior_places.py` on held-out communes; adopt it only if it recovers more of the real between-commune spread (the survey model recovers a quarter to a third) and shows positive correlation on abstention.
2. **Abstention.** Turnout is observed at every polling station, so abstention can be learned from data far larger than the 96 abstainers in the survey.
3. **More elections as constraints.** Add the 2024 European and legislative first rounds and the second rounds as calibration targets, and estimate 2022-to-2024 vote transitions per commune, to give personas 2024-consistent vectors without individual-level 2024 data.
4. **Backtest.** Score the 2022 calibration against 2024 results in the same communes (temporal hold-out), and score the calibrated prior on communes outside the 162 selected ones.
Done when the ecological prior beats the survey prior on held-out communes, with the metrics recorded in `prior-validation.md`.

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
