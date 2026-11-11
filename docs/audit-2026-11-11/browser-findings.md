# Browser findings — L’Observatoire

Date: 2026-11-11. Target: local static export at http://127.0.0.1:4173. Desktop: 1440×1000; mobile: 390×844 and 320px. Nine browser findings: six P1/high and three P2/medium. Findings are observations, not verification of news claims. See [the final report](report.md) for source-verified causes and updated recommendations.

## ISSUE-001 — Precise simulation results read like measured voter behavior (P1)

URL: /events/ (Teddy Riner detail, reached through the first homepage item).
Evidence: [full event page](screenshots/event-riner-desktop.png). Repro video: N/A (visible on load).

Open the first homepage event. The prominent summary and reaction tiles show “15 % plus enclins à s’abstenir” and “4 % … centre”. The supporting caption says this is a hypothesis, while the same block ends “Aucun effet stable détecté”. Readers receive contradictory confidence signals. The displayed description names real people and allegations; this audit does not establish their truth. Require verified editorial sourcing and a publication gate, and label synthetic samples and instability directly beside every numerical claim. Hide unstable magnitudes until validated.

## ISSUE-002 — Chart evidence and accessibility promise are missing in the visible homepage (P1)

URL: /. Evidence: [homepage](screenshots/home-desktop.png). Repro video: N/A.

Open the homepage. The chart has six series and dense event markers, but no visible source, last observation date, smoothing explanation, uncertainty, or data-table control. Its accessible description says values are available in a table below; the page accessibility tree contains no such table. Distinguish the displayed calendar range from observed data freshness and provide a usable table with source links.

## ISSUE-003 — Source list contains merged headlines and inconsistent counts (P1)

URL: Teddy Riner event detail. Evidence: [event page](screenshots/event-riner-desktop.png). Repro video: N/A.

Open the first event and read “Les articles de cette actualité”: 37 articles / 41 médias; some items combine multiple outlet names and headlines under one outlet label (e.g. Le Monde.fr, POLITICO, Washington Post in one item). This makes corroboration difficult. Validate article extraction, deduplicate source records, and explain/count unique outlets consistently.

## ISSUE-004 — Candidate page attributes bloc reactions to a named candidate (P1)

URL: /candidates/le-pen/. Evidence: [candidate page](screenshots/candidate-lepen-desktop.png). Repro video: N/A.

Open Marine Le Pen from Candidats. “Les événements qui ont compté”, “Progressions” and “Reculs” rank events with precise percentages. Only after both lists does the note disclose that the numbers concern a political bloc, are synthetic, and are not measured effects. Put the unit, denominator and synthetic nature before the list; use labels that do not imply demonstrated candidate-level causality.

## ISSUE-005 — Irrelevant and mismatched material appears in election archive (P1)

URL: /events/. Evidence: [archive](screenshots/events-desktop.png). Repro video: N/A.

Open the archive. A Volkswagen T-Roc road-test photo is an election event. The Doubs/Péchier headline is paired with a different corruption-trial description, and Besançon is paired with Dijon copy. The feed includes repeated protest stories. Improve relevance filtering, event clustering, semantic title/summary validation, dates, and human editorial approval before publication.

## ISSUE-006 — Mobile chart lacks a readable overview and usable event selection (P1)

URL: /. Evidence: [mobile entry](screenshots/home-mobile.png), [chart](screenshots/chart-mobile.png), [expanded chart](screenshots/chart-mobile-expanded.png). Repro video: N/A (static layout).

At 390×844, the introduction occupies most of the first viewport. The graph begins near y=620 and uses a horizontal viewport that initially shows the later part of the time range. Numerous event dots are packed into a narrow strip without visible titles; the earlier dates and left-side markers are clipped inside the chart scroll area. Provide a mobile summary, a clearly labeled range selector and an event list for the selected day. Do not require precision tapping on tightly packed dots.

## ISSUE-007 — Archive filters are not shareable and reset on reload (P2)

URL: /events/. Evidence: [selected filter](screenshots/filter-selected.png), [after reload](screenshots/filter-after-reload.png), [repro video](videos/filter-reset.webm).

1. Open /events/ at mobile width and choose “Campagne”; the list filters (first screenshot).
2. Observe that the URL remains /events/.
3. Reload; “Tous” and the unfiltered list return (second screenshot).

Reproduced twice. Serialize filters and pagination in URL search parameters and restore them on load/back navigation.

## ISSUE-008 — Error page is in English in a French publication (P2)

URL: /404/. Evidence: [404 mobile](screenshots/404-mobile.png). Repro video: N/A.

Open the generated 404 page: “This page could not be found.” appears without the usual masthead or an immediate contextual recovery action. Provide a French error page with a clear return link and event/candidate discovery options. The footer does provide general navigation.

## ISSUE-009 — Navigation and chart controls are small on touch screens (P2)

URL: / and /candidates/. Evidence: [320px candidates](screenshots/candidates-320.png), [mobile chart](screenshots/chart-mobile-expanded.png). Repro video: N/A.

At mobile widths, measured navigation links are 38px high, filters are 36px high, and the chart’s all-candidates toggle is 25.6×25.6px. These are below the 44px usability target (not by themselves proof of a WCAG 2.2 AA violation; that standard uses 24px plus exceptions). Make key controls at least 44px high and separate dense chart markers.
