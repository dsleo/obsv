# Prelaunch implementation

Scope: resolve the 2026-11-11 audit, starting with the root causes of feed corruption. Preserve the established editorial design and the existing local image fallback.

- [x] Reproduced feed defects; repaired upstream classification/grouping/source contract and local adaptation; added regression tests and refreshed data. Upstream pull request: `danchemla/sondageTracker#16`.
- [x] Publication policy, input validation, last-good snapshots, empty-data behavior, CI and artifact consistency.
- [x] Compact and honest automatic-simulation labels, denominators, withheld incomplete effects, bloc scope, group disclosure and factual reading order.
- [x] Poll provenance/freshness, accessible data tables, mobile range/candidate controls, chart contrast and event grouping.
- [x] Archive search/filter/URL state, relevant reading, clear method/navigation/error pages.
- [x] Configurable publisher/corrections/privacy/rights surfaces, public-URL guards, sitemap, robots and metadata. Unlicensed images are not rendered.
- [x] Slim client datasets, responsive image policy, dependency updates and documentation.
- [x] Release build, typecheck, 59 automated tests, static-route smoke test, Chromium and Firefox browser checks, and dependency audit.

## Release status

- Automatic publication is the product policy: successful simulations display their automatic provenance; no human reviewer is asserted or required.
- 193 current analysis artifacts pass automatic publication checks. Two incomplete model responses (`google-24988`, `google-2072`) remain withheld rather than being partially published.
- Chromium and Firefox pass the 21 release-browser scenarios, including light/dark mobile accessibility, source-mismatch regressions and touch disclosure. The local WebKit bundle cannot create a page (`PushAPIEnabled` is unsupported by its frozen macOS build); CI still runs the normal WebKit project on a supported runner.
- The application remains a preview until `SITE_PUBLIC=true` is paired with a real HTTPS public URL, publisher identity and corrections contact. Those values are deliberately not invented. The upstream pull request must be merged and its source database rebuilt to remove bad clusters at collection time; the local adapter already prevents the known mismatches from publishing.
