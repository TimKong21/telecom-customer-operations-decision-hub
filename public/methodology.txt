# Report fidelity and web adaptations

This independently hosted edition implements the five pages in the three original PBIX reports. It uses the supplied case workbooks, not Power BI Service. The original PBIX files are unchanged.

## Evidence and limits

`docs/reference/reports.json` contains extracted visual definitions, original filters and queries, theme resources, calculated columns, Power Query steps, relationships, and all **30 named DAX measures**. Local source paths in Power Query expressions are redacted. Extraction uses PBIXRay 0.15.5 and Python's ZIP reader; no model engine runs in the browser.

`docs/reference/model-data-validation.json` records comparison of every retained input against all **12,543 decoded embedded model rows**, aligned by source ID. The retained input projections match. VertiPaq timestamp decoding introduces floating-point noise; the Call Centre report uses the separate Date column and HOUR(DateTime), both of which match. The unused date portion of the workbook's text DateTime field is not a validated input. D&I supporting/random fields outside the published projection are not used.

The TypeScript measure functions and every rendered chart series are checked against independent pandas calculations for default, selected, combined-filter, and empty contexts. These controls validate the translated arithmetic and cohorts. They do **not** constitute live execution of DAX or a claim of pixel-perfect/native Power BI interaction parity. Power BI Desktop was not available for live selected-state comparison in this session.

## Calculation register

| Report / calculation | Implemented definition |
| --- | --- |
| Call counts | Counts of nonblank source call IDs; workbook keys are checked as unique. Answered/resolved measures use CALCULATE replacement of their respective status filters, preserving other context. |
| Call ratings and speed | Average of nonblank ratings / answer-speed observations. The answer-speed gauge uses observed minimum and maximum; satisfaction uses observed maximum. Agent statistics use the same named counts and averages. |
| Calls by hour and month | HOUR of the source DateTime field; calendar month of the separate Date field. Date-range endpoints are inclusive. |
| Churn exploration | Page restriction `Churn = Yes` is retained. Demographic and service measures divide the Yes subgroup by the churned population, matching the original CALCULATE/DIVIDE expressions. MultipleLines excludes No phone service in that visual only. |
| Churn risk | Churned count divided by customer count in context. Original DIVIDE fallback is zero. Ticket and charge charts use sums; blank total charges are excluded from averages and contribute nothing to sums. |
| Tenure | Original inclusive boundaries at 12, 24, 36, 48, 60, 72 months. Labels now state the actual intervals, e.g. 0–12 months, instead of the original misleading `< 1 year`. No records exceed 72 months. |
| Hiring shares | The original measure counts women / (men + women), and vice versa, in context. The original “Hiring history” bar includes all employees. Labels in the web KPIs say workforce share to avoid implying only new hires. |
| Promotions | Counts of FY21 promoted employees, grouped by job level **after FY21 promotions**. Women’s share divides women promoted by all promoted, not by eligible women. The separate eligible-employee promotion rate is not substituted for this measure. |
| Turnover | Original DAX: leavers / ((before-hire headcount + after-hire headcount) / 2). Default: `47 / ((434 + 500) / 2) = 10.0642398%`, displayed **10.1%**. This resolves the previous website’s 9.4% difference. |
| Turnover ratings | Average **FY19** ratings by FY20 level and FY20 leaver status, shown separately for women and men. The former website used FY20 ratings instead. |
| Performance | Nonblank FY20 rating distribution and gender-specific average FY20 ratings. CALCULATE gender predicates replace an existing gender filter, as in the original measures. |
| Executive balance | Four distinct cohorts: FY20 executive level; FY21 executive level; FY20 executives with New hire FY20 = Y; FY20 executives with Promotion in FY20 = Y. |
| Age | Age distribution by FY21 level includes only blank Leaver FY records. The 20–29 count intersects the age slicer with the visual’s fixed age cohort. |

All rates use original denominators, preserve calculation precision, and round only for display. Null means unavailable; ratios without a denominator show an em dash unless the original measure specifies a zero fallback. Count/sum controls show zero for empty populations. Integer counts are compared exactly; floating-point controls use an absolute tolerance of 0.000001, well below displayed precision.

## Interaction and presentation differences

- The site opens directly into Call Centre Trends. The Decision Hub identity, report themes, and original page groupings are retained. Navigation, typography, colours, responsive layout, accessible data tables, compact currency headlines, and explanatory notes are web adaptations. Full currency values remain in headline titles and data tables.
- Original Call Centre Date/Topic and D&I Department/Age/Region slicers are supported. Contract/Internet/Payment slicers on retention are additions. Slicer choices persist between pages within a report; each report has independent state. A full browser reload restores the current report's shared URL state only.
- Multi-values within a slicer are OR; different slicers and separate chart selections are AND. Chart data remains selectable in its own source context. Use Multi-select or Ctrl/Cmd-click to select multiple categories in one chart.
- **Filter** is the default web interaction: chart selections filter target charts, cards, and tables. **Highlight** keeps target chart baselines and adds selected overlays; cards/tables show the selected population. Donuts use an outer context ring and an inner selected ring. **Off** clears/disables chart selection. The web mode is an explicit adaptation, not a claim to reproduce every native Power BI default highlight rule.
- Legend entries identify series; they do not silently hide data or apply report filters. Click chart categories or use View data & select for keyboard-accessible selection. Some aggregate/gauge visuals have no categorical selection because there is no single source category to apply.
- The D&I Page II layout contains a relationship override from Age slicer ID `1f29f52f761c909e503d` to `68e527b121283bcc761c`. The target ID is absent from both current pages. This orphaned override is retained in the extracted evidence and has no web target; no numeric enum interpretation is assumed.
- Original visual filters (churn cohort, no-phone-service exclusion, promoted cohort, executive cohorts, nonblank ratings, and blank Leaver FY) remain distinct from user slicers. User selections cannot expand a fixed visual/page cohort. Reset restores default user filters while retaining those cohort rules.
- Recommendation text is contextual guidance; it does not generate causal claims or predictions from chart selections. The cases are descriptive, fixed snapshots.

## Public data and provenance

The static build publishes only the fields needed for the report interactions. Source customer/employee/call identifiers are replaced with synthetic row keys; unused employee nationality, exact age, random values, and supporting fields are omitted. This is data minimization, not an access-control or anonymization guarantee. Published snapshots remain downloadable. The existing case-material notice continues to apply; the MIT grant does not cover the supplied datasets or reference reports. Review applicable source redistribution terms before public release of the detailed snapshot.

`public/data/manifest.json` includes workbook paths, worksheet names, record counts, null counts, source/data SHA-256 hashes, and default calculation controls. CI regenerates the data and fails if committed generated outputs are stale. A changed PBIX hash requires regenerating its extracted specification before data preparation succeeds.

## Local validation commands

Use Node.js 22.12+ and Python 3.10+:

```text
python -m pip install -r requirements.txt
npm ci
npm run analyze
npm test
npm run build
npm run preview
```

For optional model extraction and embedded-row validation:

```text
python -m pip install -r requirements-extract.txt
npm run extract
python scripts/validate_model_data.py
```

Deployment is manual through the existing GitHub Pages workflow. Local implementation and validation do not publish or modify the live site.
