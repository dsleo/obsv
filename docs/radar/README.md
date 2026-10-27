# Radar 2027: effects on subpopulations

**Status (17 October 2026): working hypothesis explorer.** Radar can turn a sourced event into auditable group filters, show which synthetic personas match, and suggest directional reactions and counterfactuals to test. It does **not** estimate a causal effect, a change in national vote share, or a measured 2027 voting intention.

This README is the entry point for the implementation. The supporting material has distinct purposes:

| Read | For |
| --- | --- |
| [Method note](./method.md) | The concise account of what was built, the data attached to each row, the calibration, and what remains. |
| [Pipeline reference](./pipeline.md) | Source inventory, import commands, QA results, calibration details, and regeneration steps. |

## The claim we can make

> Given an event and an explicit alternative, these are plausible groups to study, the exact filters used to find them, and directional reactions to investigate further.

The output is **conditional on a persona seeing or experiencing the event**. It is based on a few synthetic rows. The model has no measured exposure rate, no validated French event-response model, and no population denominator for a numerical shift. The app labels this output as a hypothesis. Its overview polling and scenario votes remain local demo simulations.

![From a synthetic row and sourced event to testable group hypotheses](./diagrams/data-flow.svg)

## What data enters the workflow?

| Layer | What is stored | What it means |
| --- | --- | --- |
| [Nemotron-Personas-France](https://huggingface.co/datasets/nvidia/Nemotron-Personas-France) | 115,011 rows in 162 nonempty selected communes, kept as **whole communes**; a separate 2,000-row distributed frame supports fast global examples. The pinned dataset revision is `ca99b66bb9cd7bc5dc6e5bef0f77ed7bfc443715`. | A synthetic demographic frame for filtering and exploration. Its row frequencies are not French population shares. |
| Closed tag ontology | 51 allowed tag IDs for recorded demographics and deterministic geographic/group attributes. Explicit professions from biography text remain review-only candidates until audited. | Filterable metadata with provenance. Missing attributes stay unknown. A group cannot be silently defined by an invented tag. |
| [Official election results](https://www.data.gouv.fr/datasets/donnees-des-elections-agregees) | Commune-level 2022 presidential T1, 2024 European T1, 2024 legislative T1, and 2026 municipal T1 context attached to all selected rows. | Observed **place** results, not an individual's ballot. No polling-station address is inferred for a persona. |
| [Voter Autrement 2022](https://zenodo.org/records/18848264) | A modeled 2022 presidential probability vector for each row, including abstention and blank/null, trained on 2,032 usable human stated intentions. | A weak historical prior. It is neither an observed vote nor a 2027 intention. The held-out log-loss gain over survey prevalence was only 0.026. |
| [INSEE geography and RP 2022](https://www.insee.fr/fr/statistiques/8581810?sommaire=8581933) | Commune codes, density, and resident-adult age × sex cells used for local weights. | Geographic context and a synthetic weighting convention. Adult residents are not the registered electorate. |

There are **no row-level 2024 European, legislative, or municipal vote vectors**. Aggregate returns alone cannot identify a person's vote or consistent party loyalty. The 2022 survey's published participant count and downloaded file count still need reconciliation; details are in the [pipeline reference](./pipeline.md).

## How an event becomes a group hypothesis

1. **Describe the event.** The input is dated text with a source URL and an explicit `event versus alternative` comparison.
2. **Propose mechanisms.** An LLM suggests 2–4 potentially affected groups, a reason for each, valid ontology tag IDs, and counterfactuals. The tag vocabulary is closed.
3. **Compile and check filters.** Code validates the IDs and `all` / `any` / `none` logic, resolves named places through INSEE, counts matches, and flags unknown membership attributes, thin support, and unreviewed narrative tags. The LLM never decides which rows belong to a group.
4. **Explore responses.** For each group, code selects at most six matched personas across their historical-prior patterns. Another LLM compares the event with its alternative and gives a direction toward, away, or no clear change by political bloc and abstention. Global scenarios use the separate distributed discovery frame.
5. **Preserve the evidence grade.** These are scenario hypotheses over synthetic rows, not probability-point effects or national vote estimates. A 2027 row baseline is unnecessary for a relative directional question; an absolute 2027 forecast would require one.

The key implementation lives in [ontology and filter compilation](../../src/lib/radar/ontology.ts), [event/group analysis](../../src/server/radar/pipeline.ts), and [relative responses](../../src/server/radar/relativeResponse.ts). The Next.js endpoints are `/api/radar/analyze`, `/api/radar/group-response`, and `/api/radar/global-response`.

## Why and how the 2022 priors are calibrated locally

The survey model supplies a different prior vector $p_i$ for each row. In a supported commune, we find new vectors $q_i$ that match official 2022 shares $s_k$ while minimizing the **weighted change** from those priors:

$$
\begin{aligned}
\underset{\{q_i\}}{\operatorname{minimize}}\quad &\sum_i \alpha_i D_{\mathrm{KL}}(q_i\Vert p_i) \\
\text{subject to}\quad &\sum_i \alpha_i q_{ik}=s_k\quad(\forall k),\\
&\sum_k q_{ik}=1,\quad q_{ik}\geq0.
\end{aligned}
$$

Here $\alpha_i$ is the row's normalized resident-adult weight. The solution applies one shared option-odds multiplier **within the commune**, then renormalizes each row:

$$
q_{ik}=\frac{p_{ik}e^{\lambda_k}}{\sum_r p_{ir}e^{\lambda_r}}.
$$

This preserves differences already present in the priors. It does not create evidence for strong personal loyalties. Calibration runs only with at least 30 rows, effective support of 20, adult-cell coverage of 95%, and no row-option change above 0.20. **73 communes / 113,975 rows** passed; **1,036 rows** retained the survey prior. The largest official-share residual was `9.1e-9`, and the largest accepted row-option move was 0.175.

![The local minimum-change calibration and its acceptance rules](./diagrams/local-calibration.svg)

An exact commune match verifies the arithmetic of the synthetic adjustment. It does **not** validate any persona's actual vote. Matching registered-voter shares with resident-adult row weights is a modeling convention, not a measured electorate distribution.

## Run it locally

The raw and derived indexes under `data/radar/` are git-ignored. The selected-commune calibrated index is about **1.89 GB** and is **not in this branch**. A new machine must build or receive versioned indexes before the live Radar endpoints work. The [pipeline reference](./pipeline.md#reproduce-the-import) gives the source downloads and import order; its [complete-commune section](./pipeline.md#complete-commune-frame-and-local-calibration) gives the index build and calibration commands.

```sh
npm ci
cp .env.example .env.local
# Add your OPENAI_API_KEY and provision the versioned data/radar indexes.
npm run dev
```

Visit `http://localhost:3000/radar`. The `.env.example` file names `RADAR_PERSONA_INDEX`, `RADAR_GLOBAL_PERSONA_INDEX`, and `RADAR_GEOGRAPHY_INDEX`. Never commit API keys, respondent files, or generated persona indexes. For checks, run `npm test` and `npm run build` after the indexes and environment are configured.

## What remains before a numerical effect claim

1. **Validate the historical prior independently.** Check subgroup and held-out-place prediction, survey-count discrepancy, geography changes, and weight stability. The present held-out improvement is small.
2. **Obtain suitable French respondent microdata.** [CEVIPOF ENEF 2024](https://data.sciencespo.fr/dataverse/ENEF2024) documents useful waves, but respondent downloads were restricted (HTTP 403). The public 2024 Voter Autrement experiment is self-selected and too limited to replace it.
3. **Review tags and coverage.** Audit fine profession tags on held-out biographies; add selected places or on-demand frames beyond today's communes, including Corsica.
4. **Measure event response on humans.** Collect exposure and pre/post intention, including null and negative contrasts. The current directional prompt found only **3 of 7** conclusive directions in an adjacent US persuasion sanity check; that is not French-election validation.
5. **Version and distribute deployment data.** Record dataset, source, survey, ontology, and model versions with the generated indexes and their QA reports. Keep the app's evidence labels tied to those versions.

A future numerical *projection* needs a dated human baseline, an exact population denominator, a reproducible group filter, exposure assumptions, and held-out validation for the response task. A randomized human vignette estimates the effect of its wording under survey conditions; it is distinct from the effect of a real news event. Until those gates pass, Radar should continue to show **hypotheses to test**.
