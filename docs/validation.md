# Implementation validation

Validated locally on 2026-11-10 with Node 24.22.1, Python 3.10, pandas 2.3.3, PBIXRay 0.15.5, and a Playwright-controlled Chromium browser.

## Automated checks

- **53 passing Vitest tests**: independent Python workbook controls for all three reports; every rendered chart series across all five pages in default, selected, combined-filter, and empty states; CALCULATE filter replacement; null charges; fiscal-year cohorts; inclusive tenure/date boundaries; selection modes; reset-state primitives; independent report state; shared URLs; invalid URLs.
- **TypeScript check passed** with strict mode; **production Vite build passed**.
- **Embedded input validation passed** for every retained field across 5,000 calls, 7,043 customers, and 500 employees. Source IDs are used only for validation alignment and are replaced in published projections.
- Source counts, unique keys, required fields, missing charges, date coverage, and PBIX hashes pass preparation checks. Generated snapshots use canonical LF bytes so their manifest hashes remain consistent across Windows and Linux.

## Browser checks

| Area | Observed result |
| --- | --- |
| Call Centre filters | Technical Support + January date range updates the population count, KPIs, and chart descriptions; shared URL survives reload; reset restores 5,000 calls. |
| Direct chart interaction | Clicking the Answered donut segment filters the report to 4,054 calls and updates monthly data. Highlight preserves baseline comparisons; Off clears chart selections. |
| Keyboard alternatives | Enter/Space operate the Topic slicer and accessible chart data buttons. Repeated selection deselects. |
| Retention pages | Exploration starts at 1,869 churned customers; Month-to-month selection persists to the risk page; reset restores 7,043 risk customers and 26.5% churn. All seven risk visuals render. |
| D&I pages | Turnover displays 10.1%. Department + Age intersection updates related values and persists across pages. The fixed 20–29 KPI intersects the active age slicer; all four executive cohorts render. |
| Mobile | Call Centre and D&I checked at 390×844 with stacked visuals and no document-level horizontal overflow. Tables remain horizontally scrollable within their own containers. |
| Failure / empty states | Reversed date bounds produce a visible zero-result message. An intentionally aborted dataset request displays the failure panel; Try again restores the report after the request is allowed. |
| Production hosting | All three historical HTML URLs redirect successfully. Both multi-page reports survive direct hash-link refresh under the GitHub Pages repository path. Local fonts, methodology, notices, and icon return successfully. |
| Runtime dependencies | Final production browser pass reports no page errors, failed requests, external-origin requests, or Power BI/Microsoft authentication requests. No console errors or warnings remain in the final production page. |
| Visual review | Desktop screenshots of Call Centre, retention risk, and D&I page II, plus mobile Call Centre/D&I screenshots, were inspected. Combo chart count/percentage axes and small-text contrast were corrected during review. |

## Boundaries of the evidence

These tests validate the independent implementation against decoded model inputs, extracted expressions, original default-state screenshot evidence, and independently computed reference arithmetic. No live DAX engine or Power BI Desktop selected-state comparison was run. The extracted orphaned D&I interaction target has no corresponding current visual. Native Power BI highlighting defaults and pixel-perfect rendering are not claimed.

GitHub Actions validates pull requests and pushes to the release branches. The **Deploy GitHub Pages** workflow is dispatched manually on `main`. It regenerates report data, checks the generated files for drift, runs tests, and publishes the production build. A formal low-end-device performance benchmark has not been conducted.

## Stakeholder presentation and repository cleanup

Removed portfolio/snapshot banners, introductory date labels on Call Centre and Retention, the sidebar promotional block, contextual-advice/methodology sections, and the turnover implementation-history notice. Original calculations and interactive controls remain intact. Source assets are grouped under `reports/`, tests and fixtures under `tests/`, optional extraction tools under `tools/powerbi/`, and original report screenshots under `docs/report-references/`. The superseded site, unused scripts/theme image, planning assessment, and published developer-methodology copy were removed.
