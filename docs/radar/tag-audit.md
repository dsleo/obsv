# Radar tag audit (ontology `fr-electorate-5`)

Audit of the persona tags on the 115,011-row complete-commune index, before and after the retag (`npm run data:retag`). "Before" is ontology `fr-electorate-4`. "Communes" counts distinct `geography.communeCode` per tag (Paris, Lyon and Marseille arrondissements count separately). The engine needs at least 20 personas and at least 3 communes for a segment to be `filterable_discovery_sample`.

## Bugs found and fixed

| Problem (v4) | Effect | Fix (v5) |
| --- | --- | --- |
| `couple.*enfant` was tested before `couple.*sans enfant` | All 31,795 "Couple sans enfant" personas were tagged `household.couple_with_children` (70,605 instead of 38,810); `household.couple_no_children` had 0 rows | Check "sans enfant" first |
| Regex `profession intermediaire` did not match the plural "Professions intermédiaires" | 17,110 personas (14.9 %) had no occupation tag; `occupation.intermediate` had 0 rows | `professions? intermediaires?` |
| "Brevet" matched nothing | 7,478 personas (6.5 %) had no education tag | New tag `education.brevet` |
| "Concubinage" matched nothing | 15,883 personas (13.8 %) had no marital tag | New tag `marital.cohabiting` |
| Paris/Lyon/Marseille arrondissements have no INSEE density or population | 50,031 personas (43.5 %) had no `geo.*` or `commune_size.*` tag, so any dense-city segment was undercounted and `none: geo.*` never matched | Inherit density and population from the parent commune (`withParentGeography`) |

After the retag no family is missing for any persona (`missingFamilies` is empty for all rows) and no persona carries two tags of the same single-valued family.

## Tag counts, before and after

| Tag | Before | After | Share (after) | Communes |
| --- | ---: | ---: | ---: | ---: |
| `age.18_24` | 15,225 | 15,225 | 13.2 % | 151 |
| `age.25_34` | 20,918 | 20,918 | 18.2 % | 160 |
| `age.35_49` | 28,375 | 28,375 | 24.7 % | 177 |
| `age.50_64` | 24,751 | 24,751 | 21.5 % | 182 |
| `age.65_74` | 13,028 | 13,028 | 11.3 % | 162 |
| `age.75_plus` | 12,714 | 12,714 | 11.1 % | 159 |
| `commune_size.1000_plus` | 64,504 | 114,535 | 99.6 % | 119 |
| `commune_size.under_1000` | 476 | 476 | 0.4 % | 88 |
| `education.bac_plus_2` | 11,919 | 11,919 | 10.4 % | 153 |
| `education.bac_plus_3_4` | 14,062 | 14,062 | 12.2 % | 151 |
| `education.bac_plus_5_plus` | 22,481 | 22,481 | 19.5 % | 141 |
| `education.baccalaureate` | 22,157 | 22,157 | 19.3 % | 171 |
| `education.brevet` | 0 | 7,478 | 6.5 % | 139 |
| `education.cap_bep` | 17,539 | 17,539 | 15.2 % | 184 |
| `education.no_diploma` | 19,375 | 19,375 | 16.8 % | 169 |
| `former_profession.engineer` | 1,248 | 1,248 | 1.1 % | 78 |
| `former_profession.health` | 8 | 8 | 0.0 % | 5 |
| `former_profession.legal` | 10 | 10 | 0.0 % | 8 |
| `former_profession.teacher` | 144 | 144 | 0.1 % | 48 |
| `former_profession.university_professor` | 2 | 2 | 0.0 % | 2 |
| `geo.dense` | 58,921 | 108,952 | 94.7 % | 72 |
| `geo.intermediate` | 3,561 | 3,561 | 3.1 % | 24 |
| `geo.rural` | 2,498 | 2,498 | 2.2 % | 111 |
| `household.couple_no_children` | 0 | 31,795 | 27.6 % | 187 |
| `household.couple_with_children` | 70,605 | 38,810 | 33.7 % | 186 |
| `household.single` | 34,651 | 34,651 | 30.1 % | 182 |
| `household.single_parent` | 9,755 | 9,755 | 8.5 % | 146 |
| `marital.civil_union` | 6,584 | 6,584 | 5.7 % | 138 |
| `marital.cohabiting` | 0 | 15,883 | 13.8 % | 160 |
| `marital.divorced` | 7,015 | 7,015 | 6.1 % | 148 |
| `marital.married` | 48,138 | 48,138 | 41.9 % | 195 |
| `marital.single` | 30,465 | 30,465 | 26.5 % | 174 |
| `marital.widowed` | 6,926 | 6,926 | 6.0 % | 152 |
| `municipal_system.paris_lyon_marseille` | 100,253 | 100,253 | 87.2 % | 48 |
| `occupation.artisan_merchant_owner` | 3,921 | 3,921 | 3.4 % | 132 |
| `occupation.employee` | 19,936 | 19,936 | 17.3 % | 167 |
| `occupation.executive_professional` | 11,196 | 11,196 | 9.7 % | 147 |
| `occupation.farmer` | 823 | 823 | 0.7 % | 92 |
| `occupation.intermediate` | 0 | 17,110 | 14.9 % | 161 |
| `occupation.other_inactive` | 17,271 | 17,271 | 15.0 % | 152 |
| `occupation.retired` | 29,927 | 29,927 | 26.0 % | 187 |
| `occupation.worker` | 14,827 | 14,827 | 12.9 % | 160 |
| `profession.artisan` | 1,081 | 1,081 | 0.9 % | 105 |
| `profession.engineer` | 374 | 374 | 0.3 % | 70 |
| `profession.farmer` | 357 | 357 | 0.3 % | 74 |
| `profession.health` | 15 | 15 | 0.0 % | 11 |
| `profession.legal` | 3 | 3 | 0.0 % | 3 |
| `profession.teacher` | 39 | 39 | 0.0 % | 15 |
| `sex.female` | 61,522 | 61,522 | 53.5 % | 197 |
| `sex.male` | 53,489 | 53,489 | 46.5 % | 193 |

Tags with no row in either version: `household.other`, `profession.liberal_explicit`, `profession.university_professor` (`household.other` and the two narrative professions never occur).

## Named clusters (new)

Each cluster is a deterministic rule over base tags, stored as a `cluster.*` tag so the model can ask for it directly (see `CLUSTERS` in `src/lib/radar/ontology.ts`).

| Cluster | Before | After | Share | Communes | Usable (>=20 personas, >=3 communes) |
| --- | ---: | ---: | ---: | ---: | --- |
| `cluster.independent` | 0 | 3,921 | 3.4 % | 132 | yes |
| `cluster.isolated_senior` | 0 | 5,405 | 4.7 % | 145 | yes |
| `cluster.modest_wage_earner` | 0 | 34,763 | 30.2 % | 182 | yes |
| `cluster.older_farmer` | 0 | 384 | 0.3 % | 79 | yes |
| `cluster.older_worker` | 0 | 3,663 | 3.2 % | 136 | yes |
| `cluster.retired_couple` | 0 | 16,266 | 14.1 % | 170 | yes |
| `cluster.retiree_no_diploma` | 0 | 12,520 | 10.9 % | 163 | yes |
| `cluster.rural_retiree` | 0 | 784 | 0.7 % | 91 | yes |
| `cluster.single_mother` | 0 | 7,855 | 6.8 % | 141 | yes |
| `cluster.urban_executive` | 0 | 10,635 | 9.2 % | 72 | yes |
| `cluster.young_family` | 0 | 26,388 | 22.9 % | 176 | yes |
| `cluster.young_farmer` | 0 | 145 | 0.1 % | 42 | yes |
| `cluster.young_urban_graduate` | 0 | 11,394 | 9.9 % | 72 | yes |
| `cluster.young_without_activity` | 0 | 8,781 | 7.6 % | 138 | yes |

All 14 clusters pass the engine's minimum. Thin ones to treat with care: `cluster.young_farmer` (145 personas in 42 communes), `cluster.older_farmer` (384), `cluster.rural_retiree` (784). With a 6-persona sample they are usable but noisy.

## Remaining limits

- **Frame skew.** 87.2 % of personas (100,253) live in Paris, Lyon or Marseille (`municipal_system.paris_lyon_marseille`), and after inheritance 94.7 % are `geo.dense`. Only 2,498 (2.2 %) are `geo.rural` and 476 (0.4 %) are in communes under 1,000 inhabitants. Rural and farm-related segments therefore rest on a few hundred rows; counts are not population shares.
- **Parent density is a proxy.** An arrondissement inherits the parent commune's density and population, which is a modelling choice rather than an INSEE value for the arrondissement.
- **Narrative profession tags are unusable.** The 13 `profession.*` and `former_profession.*` tags come from regexes over generated biographies (`narrative_rule`), which the engine excludes from matching and from the tag list shown to the model. Several are tiny (`profession.legal` 3, `profession.university_professor` 0, `former_profession.health` 8). They need a human audit before use.
- **Coarse source fields.** `occupation.other_inactive` mixes students, unemployed and inactive people; `education.no_diploma` includes "Sans diplôme ou CEP"; `household` has no "other" category in the data, so `household.other` stays empty. No income, pension, tenure, employer or union field exists, so clusters such as "low pensions" are approximations (`cluster.retiree_no_diploma` is education-based, not pension-based).
- **Age is the dataset snapshot age**, not age at any past election.
- **Regression tests** for these fixes are in `src/lib/radar/ontology.test.ts`; the index itself is not versioned (`data/radar/` is gitignored).
