# Interactive report explorer: assessment and implementation plan

Assessed 2026-11-09. Repository snapshot: `5b3acda7e094f47107b78099f64e7c3941074673` on `main`.

## Recommendation

Upgrade the existing static site into a report-specific browser application. Use the workbooks to generate normalized, filterable data snapshots; use the PBIX layouts, model definitions, and screenshots as the report specification. Implement the required measures and interaction rules explicitly in the web application.

Recommended stack: React + TypeScript + Vite, Apache ECharts, a small shared filter store, pure TypeScript measure functions, and the existing Python workbook-processing pipeline. Deploy static build output through the existing GitHub Pages workflow. No server, database, Power BI Service, Microsoft embedding, or visitor account is needed for this scope.

This is a recommendation based on the inspected asset sizes and record counts. Browser performance should be measured on the first report before adding workers or a larger query engine.

```text
Workbooks ──> validated Python preparation ──> versioned report data
                                                   │
PBIX layouts + model exports ──> report specification│
                                     │             ▼
                              Browser application
                                     │
                       slicers + chart selections
                                     │
                         shared filter context
                                     │
                         measure calculations
                                     │
                        KPIs + charts + tables
```

Power BI Desktop may be useful during migration to export and validate the existing model. It is not part of the deployed application or its refresh pipeline once the transformations and measures have been ported.

## Inspected assets and reuse

The local workspace was empty. A read-only copy of the linked repository was inspected in a temporary directory. Inspection covered source and deployment code, all three workbook ZIP/XML structures, all three PBIX archive layouts, and the first D&I reference screenshot. The PBIX files were not opened in Desktop and their binary models were not decoded.

| Report | Source and scale | Report pages and interactions recovered |
| --- | --- | --- |
| Call Centre Trends | `01 Call-Center-Dataset.xlsx`: one sheet, 5,000 calls, 14 columns, unique call IDs; 2021-01-01 through 2021-03-31 | One 1280×720 page. Date-range and Topic slicers; satisfaction and answer-speed gauges; answer/resolution donuts; hourly line; monthly columns; agent matrix. |
| Customer Churn and Risk Analysis | `02 Churn-Dataset.xlsx`: one sheet, 7,043 customers, 23 columns, unique customer IDs | Two 1280×720 pages. Exploratory page has a page-level `Churn = Yes` filter; risk page has no page-level filter. Demographic/service visuals, charges and tickets, and contract/tenure risk comparisons. No explicit slicer visuals in these pages. |
| Diversity & Inclusion | `03 Diversity-Inclusion-Dataset.xlsx`: six sheets; primary `Pharma Group AG` sheet has 500 employees, 32 columns, unique employee IDs | Two 1280×720 pages. Both have Department, Age Group, and Region Group slicers. Hiring, promotion, time in level, turnover/performance, executive balance, and age visuals. Page II contains an explicit source/target visual-interaction override. |

Reuse directly or adapt:

- Existing report grouping, navigation terminology, source provenance, explanatory content, accessible table approach, and selected style tokens.
- Workbooks as case-data inputs. D&I backing/pivot sheets are supporting material; use the primary employee sheet as the fact table unless model inspection establishes another dependency.
- `scripts/analyze_case_data.py` as a starting point for ingestion and an inventory of existing web calculations. It is not proof of PBIX calculation parity.
- PBIX `Report/Layout`: all three archives expose UTF-16 JSON with page geometry, visual positions/types, field projections, query selections, formatting, filters, and configuration. Theme resources are also present. These provide implementation specifications, not executable browser components.
- Existing GitHub Pages workflow and project-path hosting conventions.
- Original screenshots for visual comparison and default-state reference values.

Rebuild or extend:

- `site/assets/charts.js` currently loads precomputed metrics and renders them once. Its click handlers switch report tabs; it has no shared filter/selection calculation system.
- `site/data/case-metrics.json` is a roughly 23 KB collection of summaries. It cannot answer arbitrary combinations of the proposed slicers because it lacks the required record detail/joint dimensions.
- `scripts/build.mjs` currently copies files and evidence assets into `dist`; a bundled interactive application needs a real dependency/build step.

## Extraction limits and calculation fidelity

The archives contain binary `DataModel` entries and no readable `DataModelSchema` entry. Named measures are referenced by the layouts, including `CountYes`, `ResolvedYes`, `churn rate %`, service percentages, `% turnover`, and `% women promoted`. Their formulas, calculated-column expressions, Power Query transformations, and complete model relationships have not been verified.

During the first implementation phase, export copies from Power BI Desktop to PBIP with PBIR/TMDL where supported. Capture measures, calculated columns, partitions/Power Query expressions, relationships, sort-by columns, formats, and any role/filter assumptions. If export is unavailable, use a compatible local model-extraction tool or inspect/export definitions through Desktop. Keep the original PBIX files unchanged. Do not infer a measure solely from its display name or `queryRef`: some layout query names contain `Sum(...)` while the actual query uses a different aggregation.

Microsoft documents PBIR as report JSON and TMDL as the semantic-model format: [enhanced report format](https://learn.microsoft.com/en-us/power-bi/developer/embedded/projects-enhanced-report-format).

Create a measure register containing source expression, input fields, filter behavior, null rules, denominator, format, TypeScript implementation, reference results, and validation status. Complex DAX context behavior must be translated deliberately; this application will not implement a general DAX engine.

### Confirmed reconciliation points

| Area | Evidence | Required treatment |
| --- | --- | --- |
| D&I promotion | PBIX promotion chart groups by job level after FY21 promotions and filters to promoted employees. Existing web script groups by FY20 level. | Restore the original grouping and cohort, then validate the percentage measure separately. Distinguish share of promotions from promotion rate among eligible employees. |
| D&I turnover comparison | PBIX visual binds FY19 Performance Rating, leaver status, job level, and Gender small multiples. Existing web script uses FY20 ratings grouped by level/Gender. | Recreate the original cohort and rating period; confirm the aggregation from the actual query/model. |
| D&I turnover KPI | Original screenshot shows 10.1%; current site uses 47 leavers / 500 employees = 9.4%. Workbook also has 434 employees flagged in the turnover base; 47 / 434 is about 10.8%, so that flag alone does not explain the reference. | Extract the original measure and reconcile model data/cohorts. Do not silently select a denominator or claim the discrepancy is resolved. If the PBIX snapshot differs, document that explicitly. |
| D&I visual cohorts | PBIX age chart requires blank `Leaver FY`; executive visuals use FY20/FY21 levels and additional new-hire/promotion filters. Current summaries do not reproduce all these individual cohorts. | Apply visual-specific filters in addition to slicers. Validate each executive comparison separately. |
| Churn cohort | Exploratory PBIX page is restricted to churned customers; risk page is not. MultipleLines visual explicitly retains only Yes/No. | Preserve default page scope and visual exclusions; expose active scope clearly. Additional retention slicers are web enhancements. |
| Missing charges and categories | Workbook has 11 blank/whitespace TotalCharges values. Existing script fills missing charges with zero and constructs tenure bands with inclusive upper boundaries. | Match model null/average behavior and exact tenure boundaries. Test boundary values and avoid misleading labels such as treating exactly 12 months as strictly less than one year. |
| Deployment freshness | Current workflow runs `npm run build` only; it does not run `npm run analyze` or install Python dependencies. | Generate and validate data in CI, or verify checked-in outputs against source hashes. Prevent stale summaries from being deployed. |

Independent source controls found during XML inspection: 5,000 calls; 4,054 answered; 3,646 resolved; 7,043 customers; 1,869 churned; 500 employees; 205 women and 295 men; 47 FY20 leavers; 51 FY21 promotions. These are input controls, not confirmation of every report measure.

## Application architecture

### Build-time data preparation

Keep three separate fact datasets: calls, customers, employees. They have no verified shared entity key; report filters should not propagate across these unrelated domains.

Prepare only fields needed by the reports and interactions. Normalize dates/times, numeric values, categorical values, boolean flags, blank values, tenure bands, and ordered job levels. Preserve full calculation precision; format and round only for display. Use stable internal record keys where needed.

Emit one compressed-by-host JSON dataset per report plus a schema/provenance manifest with source hashes, preparation version, row counts, date coverage, and data-quality checks. Lazy-load datasets and chart modules when a report opens. At 12,543 total primary records, plain in-memory filtering is the proposed first implementation; Parquet/DuckDB-WASM or a worker should be added only if profiling justifies the complexity.

All data shipped to a public static site is downloadable, even when a field is hidden in the UI. Publish a minimal report projection and retain the repository's case-material notice. Before expanding from public aggregates to detailed snapshots, check intended redistribution against the source terms. This is a publication consideration, not a blocker to building and validating locally.

### Report definitions and calculation layer

Use versioned, project-specific report definitions rather than an arbitrary PBIX loader. Each page definition should name its dataset, visuals, measure IDs, axes, sort rules, slicers, default scope, visual filters, interaction exceptions, and navigation targets. Use reusable components for cards, slicers, charts, matrices, filter chips, and empty states.

Put calculations in pure TypeScript functions that take the appropriate filter context and return values plus supporting counts. Keep them independent of React and ECharts so they can be tested directly. Compute rates from filtered numerators/denominators and averages from underlying nonblank observations; do not average precomputed percentages or rounded group averages.

### Coordinated interactions

One filter store per report owns slicers, page selection, and chart selections. Apply OR within a multi-select slicer and AND across different slicers. Keep user filters, page restrictions, and visual restrictions distinct. Measure-specific context rules may intentionally remove/replace filters and must follow the extracted DAX specification.

A chart click dispatches a selection into that store, recalculates affected visuals, and updates their KPIs/tables in the same render cycle. Encode target behavior explicitly: filter, highlight, or ignore. Validate the D&I Page II override in Desktop before interpreting its numeric relationship type. Do not assume every visual should filter every other visual.

Retain visible selected states, removable filter chips, multi-select, clear selection, and Reset report. Reset returns to the original report default, including the exploratory churn cohort. Define whether slicers persist between the two pages of a report from the original configuration; any added persistence is a documented enhancement. URL state can support shareable report/filter links without a backend.

ECharts provides click events and interaction actions, but application state must coordinate the report: [events and actions](https://echarts.apache.org/handbook/en/concepts/event/). Provide keyboard-operable slicers and equivalent table/filter controls rather than relying on chart mouse clicks alone.

### Hosting and user experience

Open directly into the Call Centre report, with all-data visuals visible and a three-report switcher. Keep methodology and original evidence available in a secondary panel. Offer a wide report canvas on desktop and a stacked layout on smaller screens; document responsive rearrangement as a presentation difference.

Prefer GitHub Pages because the repository already has its deployment workflow and URL. Use the repository base path and hash-based report/state routes so deep links survive refresh without server rewrites. Vercel or Netlify can serve the same `dist` output if preview workflows or hosting preferences later justify moving. No serverless functions are required.

Update CI to install locked Node/Python dependencies, prepare data, run validation and tests, build, and publish only passing output. Bundle chart dependencies locally rather than relying on a runtime CDN. Vite documents static deployment and GitHub project base paths: [static deployment](https://vite.dev/guide/static-deploy).

## Phased implementation

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 1. Establish the specification | Readable model export; inventory for all five pages; measure register; filter/interaction matrix; default and selected-state reference outputs; discrepancy register. | Every required visual/measure is mapped. Unknown definitions are explicitly tracked; unresolved semantics block a parity claim for affected measures. |
| 2. Deliver Call Centre end to end | Data preparation, shared filter engine, original visual families, Date/Topic slicers, linked selections, agent matrix, reset, and a testable local build. | Default totals match controls and Desktop references; date + topic intersections update all intended visuals. A pilot establishes interaction performance and reusable components. |
| 3. Deliver both retention pages | Churned-customer exploration and full-population risk views; correct charges, service exclusions, tenure bands, and denominator rules; linked selections. | Cohort defaults and reference metrics pass. Any added Contract/Internet/Payment slicers are labeled in the change log as enhancements. |
| 4. Deliver both D&I pages | Original three slicers, FY-specific cohorts, hiring/promotion/turnover/performance/executive/age visuals, and interaction exceptions. | Reconciliations are resolved or individually documented; turnover is not presented as matched while its definition remains unknown. |
| 5. Publish and harden | Responsive/accessibility checks; loading/error/empty states; shared URLs; provenance and differences panel; validated static deployment. | Five pages work without sign-in or Power BI network calls; nested-path assets and refreshed deep links work; deployed output matches the validated build. |

Avoid turning this into a general BI platform: no arbitrary PBIX upload, general report designer, DAX interpreter, live data service, workspace permissions, or server database in the initial delivery.

## Validation and definition of done

- Data checks: exact source counts and IDs, column/schema checks, null counts, date and tenure boundaries, category order, and source hashes.
- Calculation checks: compare every visible KPI/series with captured Power BI outputs at the default state and representative filtered states. Counts must match exactly; compare underlying decimal values at an agreed tolerance and displayed values at the original formatting precision.
- Interaction checks: combined slicers, repeat-click deselection, multi-select, reset, page navigation, original visual-specific exclusions, interaction overrides, and context-sensitive denominators. Include empty cohorts and missing ratings/charges; distinguish an undefined ratio from zero according to the original measure semantics.
- Browser checks: a slicer and a chart selection update both a related KPI and chart; accessible alternate controls produce the same state; mobile layout remains usable; loading failures are visible. Proposed pilot target: routine interactions settle within 200 ms on an agreed reference device, to be measured rather than assumed.
- Delivery checks: regenerate data in CI, build deterministically, verify GitHub Pages base paths and deep links, and inspect network requests to confirm the deployed experience has no Power BI dependency.
- Maintain a difference register covering source snapshot differences, corrected formulas/cohorts, responsive layouts, chart substitutions, added slicers, and any supported interaction changes. Show material differences near affected visuals and link to full methodology.

The first implementation milestone should be the complete Call Centre experience. It exercises the ingestion, measures, slicers, charts, and coordinated updates with the smallest original report, providing a reusable foundation for the remaining four pages.

## Repository evidence

- [Inspected snapshot](https://github.com/TimKong21/telecom-customer-operations-decision-hub/tree/5b3acda7e094f47107b78099f64e7c3941074673)
- [Current analysis script](https://github.com/TimKong21/telecom-customer-operations-decision-hub/blob/5b3acda7e094f47107b78099f64e7c3941074673/scripts/analyze_case_data.py)
- [Current chart runtime](https://github.com/TimKong21/telecom-customer-operations-decision-hub/blob/5b3acda7e094f47107b78099f64e7c3941074673/site/assets/charts.js)
- [Deployment workflow](https://github.com/TimKong21/telecom-customer-operations-decision-hub/blob/5b3acda7e094f47107b78099f64e7c3941074673/.github/workflows/github-pages.yml)
- [Case-material notice](https://github.com/TimKong21/telecom-customer-operations-decision-hub/blob/5b3acda7e094f47107b78099f64e7c3941074673/NOTICE.md)
