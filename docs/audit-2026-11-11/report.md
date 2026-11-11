# Publication audit — L’Observatoire

**Date:** 11 November 2026. **Baseline verdict: keep in private preview until the P1 findings are resolved.**

> This is the pre-remediation baseline. Its evidence and scores describe the application as audited; implementation status and current release evidence are recorded in [the prelaunch fixes register](../prelaunch-fixes.md).

The interface has a distinctive editorial identity. The largest launch risks concern the reliability of published material and the interpretation of analysis, followed by chart accessibility and mobile usability. A visual redesign is unnecessary. Keep the newspaper typography, warm paper palette, restrained orange accents, clear masthead, and quiet dark theme; improve the evidence hierarchy and the reading journeys.

**Product direction confirmed during this review:** serve both general readers and analysts, with a simple overview and expandable analytical detail.

## Scope and evidence

Reviewed the homepage, event archive, event detail, candidate directory, candidate detail, method page, and generated 404; explored navigation, filters, chart expansion, article expansion patterns, source presentation, and mobile layouts. Browser exploration preceded source inspection. Reviewed rendering components, chart calculations, collectors, validation, analysis publication/review, dependencies, metadata, and deployment workflows.

Tested a freshly rebuilt static export in Chromium, with 1440×1000 desktop, 390×844 mobile, and a 320px candidate layout. Ran axe-core on six representative pages in both themes, plus desktop method pages. Ran Lighthouse on the production homepage export. Built a separate GitHub Pages configuration and navigated home → candidates → candidate under its repository prefix. Tested an empty event snapshot in that disposable copy.

This is an expert review, not research with representative users, a full security penetration test, factual verification of every news story, a statistical validation of the modelling system, or legal certification. At the time of the audit, real iOS/Android devices, Safari/Firefox, VoiceOver/NVDA, real production headers/CDN behavior, and field Web Vitals remained untested. The configured public domain was not supplied. No application source was changed during the audit itself. The pre-existing working-tree edit to `src/data/radarData.ts` was preserved. The referenced `RTK.md` was not present in the project or checked ancestor directories.

Evidence:

- [Browser findings, screenshots and reproduction steps](browser-findings.md), including [filter-reset video](videos/filter-reset.webm).
- [Mobile axe results](accessibility-results.json), [desktop axe results](accessibility-desktop.json), and [measured chart contrast](chart-contrast.json).
- [Lighthouse report](lighthouse-home-mobile.report.html) and [raw Lighthouse data](lighthouse-home-mobile.report.json).
- [Data/build summary](data-and-build-summary.json), [GitHub Pages metadata check](production-metadata.json), and [empty-feed build failure](empty-feed-build.txt).
- [Dependency audit](npm-audit.json) and [production dependency audit](npm-audit-production.json).

## What works

1. **A coherent editorial identity.** Newsreader and IBM Plex Sans, thin rules, asymmetric headlines, and a restrained palette feel appropriate for a French election publication. Light and dark modes both have a considered treatment. This does not read like a generic dashboard template.
2. **A useful information structure.** Radar → events → candidates is easy to understand. Candidate ranking is scannable, detail pages have clear return links, and source articles are available. Limiting default chart series and initially showing only five source articles are useful progressive-disclosure decisions.
3. **A sound delivery foundation.** Static export keeps model calls and analysis computation off readers’ devices. Fonts are self-hosted by the build. Focus styling and reduced-motion support exist. Analysis content hashes protect against changes after approval. The current build, unit tests, and checked internal links pass.

## Scores

These are expert judgments for this product, not certification or measurements from user research. Technical quality and editorial readiness must be assessed separately.

### Design health: 22/40 — significant improvements needed

| Nielsen heuristic | Score /4 | Main reason |
|---|---:|---|
| Visibility of system status | 2 | Poll freshness, analysis date, and publication/review state are mostly invisible. |
| Match with the real world | 2 | “Impact”, “Progressions”, and “groupes les plus touchés” overstate what synthetic evidence establishes. |
| User control and freedom | 3 | Clear links and back navigation; filters cannot be preserved through reload or shared. |
| Consistency and standards | 3 | Strong visual system; filter vocabulary and evidence units differ across sections. |
| Error prevention | 1 | Draft news is published and debug approval metadata is accepted. |
| Recognition rather than recall | 2 | Readers must remember caveats that are separated from the claims they qualify. |
| Flexibility and efficiency | 2 | Type filters and sorting exist; search, date selection, comparison, and data access are missing. |
| Aesthetic and minimalist design | 3 | Distinctive and readable overall; introductory text and large art delay the useful answer. |
| Error recovery | 2 | Footer navigation helps; default English 404 and feed failures lack a suitable product treatment. |
| Help and documentation | 2 | Illustrated method exists; polling methodology and limitations are insufficiently contextual. |
| **Total** | **22/40** | **The main opportunity is evidence clarity, not decoration.** |

### Technical UI health: 15/20 — good foundation with important gaps

| Dimension | Score /4 | Main reason |
|---|---:|---|
| Accessibility | 2 | Chart values have no keyboard-equivalent table; two light-theme lines have insufficient contrast. |
| Performance | 3 | Mobile Lighthouse 92, but homepage/candidate JavaScript contains a large data chunk. |
| Responsive design | 3 | No page-level overflow on tested representative mobile pages; chart interaction remains difficult. |
| Theming | 3 | Both themes work; several dark-panel colors bypass tokens and the light chart palette needs adjustment. |
| Visual anti-patterns | 4 | Intentional editorial composition; no dominant generic AI-interface aesthetic. |
| **Total** | **15/20** | **Good technical structure does not make the content ready to publish.** |

**Anti-pattern verdict: pass.** There is no reason to replace the design system. Repeated oversized serif/italic introductions, very tight headline leading, and multiple dark analysis boxes can be refined, but they are secondary to meaning and usability.

**Cognitive load: moderate, 3 of 8 checklist items fail.** The introductory manifesto competes with the immediate reading task; the desktop archive presents nine equal filter choices; and caveats require readers to retain context while moving between claims and explanations. Grouping, hierarchy within individual sections, and progressive disclosure generally work. Count-based heuristics are diagnostic aids, not a reason to arbitrarily cap every interface at four choices.

## Prioritized findings

**Severity:** P0 blocks a core task completely; P1 is a major issue to fix before public release; P2 has a workaround and should follow; P3 is maintenance/polish. **25 findings: 0 P0, 12 P1, 12 P2, 1 P3.** A P1 can still be a release blocker for a publication even when the interface technically renders.

### F01 · P1 · Draft events bypass publication controls

**Evidence:** all 194 events in the current snapshot have `editorialStatus: "draft"`. [radarData.ts](../../src/data/radarData.ts), around line 101, maps every snapshot event into public data. The event routes, archive, and homepage consume it. [The collector](../../scripts/lib/events-api.mjs) explicitly creates drafts. All 224 analysis approvals identify the reviewer as `dev-bulk-approval (debug phase)`.

**Impact:** the site appears editorially curated while publishing automatically selected drafts and analysis carrying debug approval metadata. This is the root release-control problem behind several visible content defects.

**Fix:** produce a public snapshot containing only explicitly published events; apply that gate before route generation and before data enters client bundles. Exclude retracted material from normal listings and define a correction/tombstone policy for previously public URLs. Require named, production-valid review records for analyses; re-review debug-approved material. Keep event approval and analytical approval separate. **Acceptance:** a draft/retracted fixture has no public route, card, or bundled record; a debug-approved artifact cannot be published. **Suggested command:** `/harden`.

### F02 · P1 · Irrelevant and mismatched stories undermine the news feed

**Evidence:** `/events/` includes a Volkswagen T-Roc road test (`google-28656`, classified `context:justice`). The Doubs/Péchier headline has a description about another trial. Besançon is paired with Dijon text. [Archive evidence](screenshots/events-desktop.png). [pickDescription](../../scripts/lib/events-api.mjs) chooses a long description with low headline overlap; [relevantSummary](../../src/data/radarData.ts) then chooses article text using proper-noun matching. These heuristics do not establish semantic consistency.

**Impact:** a reader cannot rely on the title, summary, event cluster, and election relevance referring to the same story. Sensitive claims involving real people require particular editorial care. This review does not establish whether individual allegations are true or false.

**Fix:** verify the visible feed against original sources; quarantine unrelated clusters; attach summaries to the correct source record; validate place, subject, dates, and category; merge duplicate coverage of the same event. Use automated checks to assist a human publication decision. **Acceptance:** the three concrete mismatches above are corrected or excluded, with regression fixtures for each. **Suggested commands:** `/harden`, `/clarify`.

### F03 · P1 · Missing effect data is reported as “no stable effect”

**Evidence:** [EventSubpopulationAnalysis.tsx:12](../../src/components/events/EventSubpopulationAnalysis.tsx) defaults missing `contrast.effect` to `{}` and line 26 renders “Aucun effet stable détecté”. None of the 224 published analysis artifacts contains `effect`; the publication process deliberately removes it. [Example](screenshots/event-riner-desktop.png).

**Impact:** “not published/not validated” is presented as a scientific finding of no stable effect. Every current group receives that misleading fallback. Method copy also says an uncertainty interval is displayed, while the visible effect rendering does not show `lo`/`hi` even when supplied.

**Fix:** model separate states: withheld/unvalidated, unavailable, unstable, and stable. For current artifacts, say “Effet chiffré non publié : méthode en cours de validation”, or remove that subsection. Do not invent intervals for direction-count percentages. If validated magnitude publication is enabled later, render the actual uncertainty interval and its limitations. **Suggested commands:** `/harden`, `/clarify`.

### F04 · P1 · Synthetic reaction percentages have excessive apparent authority

**Evidence:** large tiles say “15 % plus enclins à s’abstenir”, while the visible card says “Part du groupe”. Current live analysis contrasts use 48–96 sampled responses; segment effects normally combine repeated runs, rather than representing a survey of that percentage of the real population. [EventArticle.tsx:45](../../src/components/events/EventArticle.tsx), [probabilisticResponse.ts](../../pipeline/radar/probabilisticResponse.ts). On mobile, [event-pages.css:42](../../src/components/events/event-pages.css) moves the impact card above the body and its hypothesis caveat.

**Impact:** readers see an apparently measured claim before learning that the sample is synthetic. “Most affected group” also suggests a broader population comparison than the discovery sample supports.

**Fix:** default to qualitative hypotheses. Put “Hypothèse issue de profils synthétiques — aucune personne interrogée” before the analysis. Use “Publics potentiellement concernés”. Offer sample counts, selection method, run count, date, and model/version in expandable details. If percentages remain, label their denominator precisely and explain they are not a population estimate or a change in vote share. Put the factual summary before the analysis on mobile. **Suggested commands:** `/clarify`, `/distill`, `/arrange`.

### F05 · P1 · Candidate pages present political-bloc reactions as candidate impact

**Evidence:** [CandidateDetail.tsx](../../src/components/candidates/CandidateDetail.tsx) maps a named candidate to a bloc, then [blocSignal](../../src/lib/radar/highlights.ts) sums responses across both group and global contrasts. [CandidateImpacts.tsx](../../src/components/candidates/CandidateImpacts.tsx) calls the results “Les événements qui ont compté”, “Progressions”, “Reculs”, and sorts by “Impact”. The qualification appears after both lists. [Screenshot](screenshots/candidate-lepen-desktop.png).

**Impact:** the same bloc signal appears on several candidates’ pages and can be mistaken for an individual candidate’s measured gain/loss. Pooled discovery groups and global scenarios are not a representative candidate electorate; groups can overlap and each scenario/sample contributes to the denominator.

**Fix:** label the section “Hypothèses de réaction pour le bloc …” before any rows, name the candidates covered, and explain shared bloc results. Prefer a dedicated bloc analysis over repeating candidate claims. Define a valid aggregation strategy; otherwise keep group-level results separate. Do not rank these as demonstrated candidate effects. **Suggested commands:** `/clarify`, `/harden`.

### F06 · P1 · Poll freshness and provenance are not visible where values are read

**Evidence:** the chart range ends on 11 November, but the latest observed poll ends on 5 November; Attal’s latest observation ends on 29 October. Candidate values say “moyenne récente” without an as-of date. [radarData.ts](../../src/data/radarData.ts) discards `source`, fieldwork start, and poll IDs when constructing `pollObservations`. [chart.ts](../../src/lib/chart.ts) computes an unweighted-by-sample Gaussian smooth across retained configurations. Candidate-level availability differs.

**Impact:** the current calendar range can be mistaken for current measurement. Readers cannot verify a plotted point or understand smoothing, scenario changes, and gaps. A smoothed decimal looks more precise than the underlying evidence warrants.

**Fix:** show “Dernier terrain : 5 nov. · Mise à jour du site : …”, and a candidate-specific observation date. Retain poll ID, fieldwork dates, tested scenario, sample size, and source URL. Add “Comment lire ce graphique ?” explaining points, smoothing, inclusion rules, uncertainty, and the difference between time adjacency and causation. Link original notices from a table. **Suggested commands:** `/clarify`, `/harden`.

### F07 · P1 · Poll information is inaccessible by keyboard; the promised table is absent

**Evidence:** [SignalRadar.tsx:79](../../src/components/radar/SignalRadar.tsx) gives poll circles pointer-only handlers and no focusable equivalent. The SVG description promises a table below, but the homepage has zero tables. The candidate chart supplies only SVG `<title>` hover text and a generic image label. Tooltips are `aria-hidden`; screen-reader users cannot obtain the same poll details. Event markers do have keyboard handlers, which should be retained.

**Impact:** keyboard and assistive-technology users cannot inspect the core data. This remains an issue despite a 100 Lighthouse accessibility score.

**Fix:** add an accessible data table with candidate, date, institute, value, sample and source; make it collapsible for the overview. Provide keyboard-operable series selection and equivalent point inspection without forcing hundreds of tab stops. Associate announced detail with the selected point. Test the full flow with keyboard and VoiceOver/NVDA. Relevant standards: [text alternatives](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html), keyboard access, information relationships. **Suggested command:** `/harden`.

### F08 · P1 · Two chart lines fail meaningful-graphics contrast in light mode

**Evidence:** measured CSS stroke/background ratios on `--surface-1`: Lisnard **1.71:1**, Attal **2.20:1**. The other four default series are 3.37:1 or higher. Dark default series pass 3:1. [Measurement](chart-contrast.json), [light screenshot](screenshots/home-light-desktop.png), [tokens.css](../../src/styles/tokens.css).

**Impact:** yellow and orange curves are difficult to perceive on paper backgrounds. All series also use similar solid strokes and depend heavily on matching colors to the legend.

**Fix:** adjust light-theme candidate tokens to at least 3:1 against their plotted backgrounds; also review candidate-detail backgrounds and all expanded series. Add direct end labels and redundant patterns/selected-line emphasis. [WCAG non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) applies to graphical objects needed to understand content. **Suggested commands:** `/colorize`, `/normalize`.

### F09 · P1 · The mobile chart is difficult to understand and operate

**Evidence:** [mobile entry](screenshots/home-mobile.png), [chart](screenshots/chart-mobile-expanded.png). At 390px, plotted data begins around y=620. The chart starts at the right edge of a larger timeline, hides the scrollbar, and shows many closely packed event dots. Events on the same day occupy the same x-coordinate. The legend offers only top-six/all-twelve, rather than choosing relevant candidates. [ScrollChart.tsx](../../src/components/ScrollChart.tsx), [SignalRadar.tsx](../../src/components/radar/SignalRadar.tsx).

**Impact:** readers must discover hidden horizontal movement, map colors to lines, and target dots before getting a clear answer. Same-day overlap makes some markers difficult to choose independently. The long introduction makes the core purpose slower to discover.

**Fix:** start mobile with a dated overview and a compact trend summary; allow two or three selected candidates. Add 30j/90j/Tout range controls, a visible scrolling cue/reset, direct values, and an “events on this date” list or sheet. Aggregate same-day markers. Keep the current full chart as the expanded analytical view. **Suggested commands:** `/arrange`, `/distill`, `/harden`.

### F10 · P1 · Deployment omits important checks and accepts debug approvals

**Evidence:** [pages.yml:39](../../.github/workflows/pages.yml) runs only the 12 Node validator/API tests, not the full 44-test suite, `data:check-analyses`, or browser checks. The separate artifact check fails on five legacy, orphaned demo artifacts with an unpinned model. The current 194 live artifacts use the pinned model; the five failures are not evidence of a wrong live model. [loadAnalysis.ts](../../src/lib/radar/loadAnalysis.ts) checks approval/hash but not model, method, or filename/event ID consistency.

**Impact:** the deployment path can pass while an existing quality check fails. Debug approval labels are sufficient to publish.

**Fix:** separate historical demo fixtures from production artifacts. Run the full tests, artifact checks, and representative browser checks in CI. Validate allowed model/method, artifact event ID, reviewer fields, and production review status at publication/load time. Make a failed editorial gate block deployment. **Suggested command:** `/harden`.

### F11 · P1 · An empty event feed passes validation and breaks the build

**Evidence:** `validateFeed("events", {schemaVersion:1, events:[]})` returns no issues. In an isolated build with that valid empty list, TypeScript fails in `radarData.ts` because JSON inference produces `never[]`. [Build log](empty-feed-build.txt). Independently, [EventsIndex.tsx:25](../../src/components/events/EventsIndex.tsx) assumes `lead.id` exists.

**Impact:** an upstream empty response or a correct publication gate temporarily leaving zero approved stories can prevent releases. The current live deployment would ordinarily remain, but freshness would stop advancing.

**Fix:** type the snapshot against an explicit contract, rather than the incidental contents of a JSON file. Define a minimum-data policy: reject unexpected empty feeds early and keep an auditable last-good snapshot; render an intentional empty state when zero published events is legitimate. Test both cases. **Suggested command:** `/harden`.

### F12 · P1 · Public identity, corrections, and rights readiness are incomplete

**Evidence:** [SiteFooter.tsx](../../src/components/SiteFooter.tsx) links only radar, events, candidates, and method. There is no visible publisher/team identity, funding/independence statement, corrections contact, privacy explanation, or accessible legal-information destination. [legal-review.md](../legal-review.md) is explicitly unvalidated; [production-checklist.md](../production-checklist.md) leaves image rights unresolved.

**Impact:** a publication interpreting political behavior asks for substantial reader trust without showing who is accountable. Hotlinked publisher images require a deliberate rights decision. This finding records unresolved release work; it does not assert a specific legal violation.

**Fix:** add concise About/editorial standards, publisher/contact information, a correction-report route, privacy/data-use information matching actual behavior, and relevant licensing/source credits. Complete the existing professional legal/rights review and record the decision. Add a visible independence/ownership explanation appropriate to the product. **Suggested commands:** `/clarify`, `/harden`.

### F13 · P2 · Article extraction and media counts are confusing

**Evidence:** the first event displays 37 articles / 41 media. Several article titles concatenate multiple headlines and outlet names under one publisher label. [Source evidence](screenshots/event-riner-desktop.png). The API’s original outlet count is shown beside a locally filtered/deduplicated article list. The snapshot has 2,801 article records, including 19 without a publisher name.

**Fix:** preserve one article/title/publisher/URL per source record, clean cluster snippets, deduplicate canonical URLs, and calculate displayed unique outlets from the displayed records. If the larger figure describes the original cluster, label that scope explicitly. Add original publication dates and distinguish publisher credit from image credit. **Suggested commands:** `/clarify`, `/harden`.

### F14 · P2 · Input freshness is not bound to approved analysis at publication

**Evidence:** artifacts contain `inputHash`, but [loadAnalysis.ts](../../src/lib/radar/loadAnalysis.ts) validates the artifact’s own approval/content hash only. It does not compare the approved input with the current event. [analyze-events.ts:75](../../scripts/analyze-events.ts) hashes selected source files, but not every relevant dependency/configuration, such as baseline/alternative implementation and all analysis options. Public summaries can also be rewritten by `relevantSummary` after the raw summary was analysed.

**Impact:** refreshed source text or pipeline changes can be paired with an older approved interpretation. This is a verified safeguard gap, not proof that every current artifact is stale.

**Fix:** store a canonical event-input digest and reproducible analysis configuration in each artifact; check them against the public event when building. Invalidate approval on changed input. Include relevant model, data, code/config versions, and sampling settings in cache identity. Show computed/reviewed dates in expandable details. **Suggested command:** `/harden`.

### F15 · P2 · Client bundles carry far more data than the chart needs

**Evidence:** production build reports **823 KB first-load JS on `/`**, **821 KB on candidate detail**, versus about 109–110 KB on event pages. A shared chunk is **1,579,795 bytes uncompressed**. [radarData.ts](../../src/data/radarData.ts) imports the full snapshot, including all event article data, and is imported by client charts.

**Impact:** readers download and parse archive material that is unrelated to the chart. This scales with the news corpus. Lighthouse is currently good, so this is a significant efficiency opportunity rather than a demonstrated severe speed failure.

**Fix:** generate small public chart datasets on the server/build: candidate labels, poll points, trend values, and minimal event markers. Keep article collections on server-rendered detail pages. Precompute smoothing instead of recalculating it repeatedly during client renders if profiling supports that change. Measure the new bundle and production mobile performance. **Suggested command:** `/harden` (with focused performance work).

### F16 · P2 · Archive state cannot be shared or restored

**Evidence:** choosing Campagne leaves the URL `/events/`; reload resets Tous. Reproduced twice. [Before](screenshots/filter-selected.png), [after](screenshots/filter-after-reload.png), [video](videos/filter-reset.webm). [EventGrid.tsx:23](../../src/components/events/EventGrid.tsx) uses local state for type and pagination.

**Fix:** serialize filters, selected candidates, chart range, and archive position/page in URL parameters where useful. Restore them on reload/back navigation. Keep the global featured story visually separate from filtered results and show the result count. **Suggested command:** `/harden`.

### F17 · P2 · Finding a specific event requires excessive browsing

**Evidence:** 194 events, 24 archive cards per expansion, type-only filters, no text search, date range, candidate, topic, or analysis-availability filter. The homepage feed uses major events, while the archive includes notable events; that distinction is not explained. Most context items have no visible category label.

**Fix:** add a clearly labeled search field and a small “Filtrer” disclosure for date, candidate, and topic. Offer “Avec une analyse” if useful, with a clear empty state and reset. Use consistent French topic labels across homepage and archive. Start with search/date/candidate; add complexity only if usage supports it. **Suggested commands:** `/arrange`, `/clarify`, `/harden`.

### F18 · P2 · Group discovery is hidden in a weak carousel

**Evidence:** [EventSubpopulationAnalysis.tsx:49](../../src/components/events/EventSubpopulationAnalysis.tsx) shows one group, arrows, and unlabeled, noninteractive dots. There is no textual “1 sur N” or live announcement. The current 194 analyses contain 653 usable groups, so this is central content rather than a rare state.

**Fix:** show a compact list of group names, an initial short summary, and expandable explanations. If a carousel remains, add “Groupe 1 sur 4”, direct labeled selectors, keyboard support, and an appropriate polite announcement. Explain selection boundaries without exposing internal tag syntax by default. **Suggested commands:** `/arrange`, `/clarify`, `/harden`.

### F19 · P2 · Method information is separated from the moment of doubt

**Evidence:** Méthode is only in the footer. The method page has no `h1` (the sole axe best-practice finding in both themes). It is an attractive long illustration sequence, but does not clearly answer how the live polling average is calculated or provide a compact public limitations/validation summary. Internal trust documentation is much more candid about the currently unestablished event-specific signal.

**Fix:** provide contextual “Comment lire ces résultats ?” links from chart and analysis. Start the method page with a short explanation of observed polls, synthetic hypotheses, and limits; keep the illustrated narrative below. Add a polling-method section, source list, model/data versions, validation status, and change log as expandable material. Use an `h1`. **Suggested commands:** `/clarify`, `/distill`, `/harden`.

### F20 · P2 · Related reading is unrelated by construction

**Evidence:** [EventArticle.tsx:16](../../src/components/events/EventArticle.tsx) chooses the first two other events in the global list for every story, regardless of subject or date relationship.

**Fix:** rank same-story/topic/candidate coverage, excluding duplicates. Include the relationship in the label, such as “Sur le même sujet”. If only newest items are available, say “Dernières actualités” instead of implying relevance. Offer previous/next chronological events as a separate, predictable path. **Suggested commands:** `/clarify`, `/harden`.

### F21 · P2 · SEO configuration is partly complete, with release gaps

**Evidence:** `/events/` and `/candidates/` inherit the homepage title/description. There is no sitemap or robots configuration. Metadata infers the public origin exclusively from `GITHUB_REPOSITORY`; another host/custom domain cannot be configured explicitly. All pages use one generic share image. **Verified positive:** the isolated GitHub Pages build generated correct repository-prefixed assets, page-specific canonicals, and the share-image URL; canonical URLs do not all point to the homepage. [Production metadata](production-metadata.json).

**Fix:** set dedicated directory metadata, an explicit deployment site URL, sitemap and robots rules, and preview indexing policy. Consider article-specific social cards and appropriate structured article metadata after publisher identity is settled. Preserve working canonical/basePath behavior. **Suggested command:** `/harden`.

### F22 · P2 · Touch controls and the error page need a usability pass

**Evidence:** mobile navigation is 38px high, filters 36px, and the all-candidates toggle about 25.6×25.6px. The generated 404 says “This page could not be found.” without the usual masthead. [320px layout](screenshots/candidates-320.png), [404](screenshots/404-mobile.png).

**Fix:** use at least 44px for primary touch controls and give them visible labels where practical. Provide a French 404 with a return action and discovery links. A control below 44px is not automatically a WCAG AA failure: [WCAG 2.2 target minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) uses 24px and specified exceptions. **Suggested commands:** `/harden`, `/polish`.

### F23 · P2 · Collector validation is too permissive and CSV parsing is fragile

**Evidence:** a test event with invalid article/image URLs and invented importance passes [validateFeed](../../scripts/lib/validate.mjs). [sondax.mjs:5](../../scripts/lib/sondax.mjs) splits CSV lines/cells directly; a quoted URL containing a comma is truncated in a local reproduction. Date-order, future-date policy, optional-field types and bounds are not fully enforced. `sondax.test.mjs` exists but is omitted from the default test script and deployment test selection.

**Fix:** validate the complete consumed contract, including nested sources/articles, strings/types, stable IDs, allowed enums, array/response limits and date relationships. Use a standards-compliant CSV parser with quoted-field fixtures. Add collector tests to the default suite. Bound fetched response sizes and maintain last-good data on rejected input. **Suggested command:** `/harden`.

### F24 · P2 · Dependency and image delivery work remains

**Evidence:** `npm audit` reports four vulnerable dependency entries: two critical, one high, one moderate, including transitive development dependencies. `npm audit --omit=dev` reports one high entry, Zod. This is **not** evidence of four remotely exploitable vulnerabilities on the static website. No browser-exposed server endpoints were found. News images are CSS backgrounds hotlinked from publishers, without responsive `srcset`/native lazy loading or explicit image credits/alternative treatment.

**Fix:** assess and update affected dependency chains in a tested change, rather than applying a forced audit update blindly. Keep test/dev servers private. Replace news backgrounds with responsive image elements where appropriate, dimensions/aspect ratios, useful fallback, and lazy loading below the fold. Establish permitted image sourcing/hosting and correct attribution. Treat illustrative images as decorative where they add no information; provide meaningful alternatives when they do. Verify production caching, compression, referrer behavior and third-party image failures. Advisories: [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [Tinypool maintainer explanation](https://github.com/tinylibs/tinypool/security/advisories/GHSA-85c8-ppgw-ccpr). **Suggested commands:** `/harden`, `/normalize`.

### F25 · P3 · Styles and release documentation have accumulated drift

**Evidence:** `radar.css` contains earlier layouts followed by overrides and empty media queries. Analysis panels contain repeated hard-coded dark colors outside theme tokens. README/legal/production documents still describe removed demonstration series, old event routes, and earlier checklist assumptions that no longer match the actual data implementation. The offline Python utilities have no discovered requirements/lock file; their tests initially needed an isolated environment provisioned for this audit.

**Fix:** consolidate current selectors, remove unused rules, tokenize repeated panel values, and update the runbook after functional fixes. Keep a small set of reusable masthead, article metadata, evidence-status and expansion components. Avoid a broad refactor while resolving publication defects. **Suggested commands:** `/normalize`, `/extract`, `/polish`.

## Recommended experience

### Homepage: answer the reader’s question immediately

Keep the masthead. Reduce the manifesto to one concise line. Open with a dated summary: what the polls currently show, when the most recent observation was collected, and which verified stories are new. Use editorial summaries rather than another row of decorative statistic cards.

Below that, show a readable chart with direct candidate labels, a time range, and a small candidate selector. Explain “points = observations; courbes = moyenne lissée; repères = événements, sans preuve de causalité”. Put data and methodology behind clearly named disclosures. Keep detailed analysis optional.

### Event detail: facts → evidence → possible interpretation

Use this order: headline/date/topic → verified two-sentence factual summary → original source links → why the event is relevant → clearly labeled synthetic hypothesis → potentially concerned groups → optional alternative scenario → genuinely related reading.

The first screen should communicate what happened and how we know. Large photography can remain, but should not push factual context and sourcing behind a prediction-style card. On mobile, preserve the same semantic and visual reading order.

### Candidate detail: polls first, bloc hypotheses separately

Show the dated average, recent observed polls and their sources, with a clear explanation of the baseline used for change. Distinguish “personnalités testées par les sondages” from verified candidacy status unless the latter is sourced. Let analysts compare two or three candidates. If reaction data exists only at bloc level, label that limitation before it is displayed and link to the bloc explanation.

### Archive: retrieval plus browsing

Lead with search and visible result counts. Put date/candidate/topic filters behind one manageable disclosure; keep active filters visible and shareable. Preserve position when returning from an event. Use a readable chronological list option on mobile. Collapse duplicate coverage into a coherent story with multiple sources rather than many near-identical cards.

### Method: short answers with optional depth

Start with three answers: “D’où viennent les sondages ?”, “Que simule le modèle ?”, “Qu’est-ce qu’on ne peut pas en conclure ?”. Then offer the existing illustrations, detailed methods, validation results, versions, and change history. Add a correction link where readers are likely to question a claim.

## Persona walkthroughs

| Persona and task | Specific friction | Desired outcome |
|---|---|---|
| Jordan, first visit: understand what changed | The homepage promises to identify who switches vote; event percentages and observed polling are not clearly distinguished at the point of reading. | Understand in one short visit which statements are reported facts and which are hypotheses. |
| Sam, keyboard/assistive technology: inspect a poll | Event links can be focused, but poll values are pointer-only and the announced table is absent; method has no h1. | Obtain date, candidate, value, sample and source without a pointer. |
| Casey, mobile: follow today’s news | Introduction delays the chart; event dots overlap; analysis card precedes the factual body/caveat. | Read a dated summary, choose a story, and see its evidence without precision gestures. |
| Léa, journalist/analyst: verify and share a claim | Poll source fields are discarded from the chart model, source headlines are merged, filters have no shareable state, bloc aggregation is easy to misread. | Open a reproducible view with original sources, scope, version, sample and limitations. |

These are expert walkthroughs against the stated audience, not sessions conducted with those people.

## Additions in priority order

| When | Addition | Why it earns its complexity |
|---|---|---|
| Before launch | Public evidence-status labels and per-view freshness | Helps every reader interpret the central promise correctly. |
| Before launch | Source-linked accessible polling table | Gives readers and analysts the same verifiable facts. |
| Before launch | About/editorial standards, corrections contact, privacy/licensing information | Makes accountability and data use visible. |
| Before launch | Explicit data/review release gates and last-good snapshot policy | Prevents recurrence after the current feed is cleaned. |
| Next | Archive search, date/candidate filters, URL state | Makes a growing archive useful beyond the latest stories. |
| Next | Candidate comparison and chart range controls | Answers practical analytical questions without making the overview harder. |
| Next | Plain-language group list and expandable model details | Serves both audiences with one coherent experience. |
| Next | CSV download of public polling observations, with provenance/license metadata | Supports verification and citation. Do not export synthetic claims as if they were polls. |
| Later | RSS or optional update digest, saved views/bookmarks, topic pages | Helps repeat use after trust and core retrieval are proven. |
| Later | Lightweight production quality monitoring | Observe collection failures, stale data and field performance; use privacy-conscious measurement matching the published policy. |

Accounts, comments, gamification, personalized political recommendations, and more animation are not priorities for the stated reading/analysis jobs. They add maintenance and moderation work without resolving the present problems.

## Verification results

| Check | Result and interpretation |
|---|---|
| TypeScript | `tsc --noEmit` passed against the current snapshot. |
| Default tests | `npm test`: 12 Node tests + 32 Vitest tests passed, 44 total. |
| Collector tests outside default suite | `node --test scripts/sondax.test.mjs`: 2 passed. |
| Offline Python tests | All 3 passed in a temporary virtual environment with NumPy 2.5.4, SciPy 1.18.1, and PyArrow 26.0.1. The system Python initially lacked these dependencies; nothing was installed into the project or global Python environment. [Test output](python-tests.txt). |
| Input validation | `npm run data:validate` passed current feeds. Does not establish editorial accuracy. |
| Analysis artifact validation | Failed: 5 of 224 legacy artifacts use an unpinned model; all five are outside the current event set. |
| Production compilation/export | `next build` passed. Called directly to use the existing validated snapshot without regenerating incoming data. |
| Route smoke | 209 configured routes present; this smoke script excludes the method/404 routes. |
| Static link scan | 212 HTML files, 2,606 local link occurrences, no missing local target found. Does not check every external source. |
| GitHub Pages build/navigation | Separate repository-prefix build passed; correct assets, canonicals, OG image URL, and navigation through candidate detail. |
| Empty event snapshot | Failed in isolated build: inferred JSON type becomes `never[]`; archive also assumes a lead exists. |
| Automated accessibility | axe-core 4.14.0: no automated violations on five representative routes in either theme. Method has missing-h1 best-practice finding in both themes and on desktop. |
| Manual accessibility | Verified chart-table absence, pointer-only poll inspection, and low light-theme chart contrast. Automated checks do not establish WCAG conformance. |
| Mobile layout | No document-level horizontal overflow on the six representative 390px pages; candidate roster also fits 320px. Horizontal chart scrolling is intentional but poorly signposted. |
| Browser console | No JavaScript errors observed in the explored primary flows or repository-prefix navigation. |
| Secret-value scan | No matches for configured API secret values in exported HTML/JS/JSON/text. Not a historical repository secret scan. |
| Dependency audit | Four vulnerable dependency entries overall; one high production entry. Static deployment limits runtime exposure; assess build/dev exposure separately. |

**Lighthouse 13.6.0, one local production-export mobile run:** Performance **92**, Accessibility **100**, Best Practices **100**, SEO **100**. FCP **1.5s**, LCP **1.5s**, Speed Index **4.1s**, Total Blocking Time **270ms**, CLS **0**. These are lab results on a local Python static server, using Lighthouse’s simulated mobile throttling. That server does not represent production compression/caching. The 2.31 MiB transfer recorded locally is not a prediction of deployed compressed bytes. Lighthouse SEO 100 does not detect all missing publishing features.

Use [Core Web Vitals](https://web.dev/articles/vitals) to verify the deployed experience with field data; the local run does not provide a real-user INP measurement.

## Suggested work sequence and release criteria

1. **`/harden` — publication and data integrity:** F01–F03, F10–F12; clean/re-review the actual feed, implement production review gates, fix empty snapshots, wire mandatory CI checks. Accept only verified public records.
2. **`/clarify` — facts and hypotheses:** F04–F06, F13, F19; correct the units, prominence, freshness, provenance and method statements. A new reader should be able to explain the difference between a poll and a synthetic hypothesis without opening a separate essay.
3. **`/harden` and `/colorize` — chart access:** F07–F09; source-linked table, keyboard-equivalent inspection, contrast, same-day event selection, and mobile range/candidate controls.
4. **`/arrange` and `/distill` — overview with optional depth:** apply the recommended homepage/event hierarchy; simplify group discovery and archive entry. Add search/URL state and improve relevant reading as the next focused pass.
5. **`/normalize` and `/harden` — delivery readiness:** trim chart bundles, strengthen the collector, update dependencies, settle image delivery, metadata, domain configuration and monitoring/runbooks.
6. **`/polish` — final visual/accessibility verification:** consolidate styles and finish touch targets, headings, French error states, and responsive details after functional changes.

Before public launch, require: no draft/retracted/debug-approved content in public output; corrected known feed mismatches; accurate noncausal/synthetic labeling; source/date access for every plotted observation; keyboard-readable chart data; passing contrast; tested empty/upstream-failure paths; passing production CI and artifact validation; accountable editorial/contact/rights information; and a deployed-domain smoke check. Then test the core journeys on real iOS Safari and Android Chrome, plus keyboard and screen reader.

After the P1 work, run five short usability sessions spanning casual readers and analysts: ask each person to explain a trend, verify an event, distinguish observation from simulation, find an older story, and share their view. Measure successful interpretation and completion, not just whether the page looks appealing. Re-run `/critique` and `/audit` against the revised release candidate. The suggested passes can be performed individually or together; the priority order above reflects the confirmed overview-plus-detail direction.
