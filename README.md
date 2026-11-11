# Telecom Customer Operations Decision Hub

An independently hosted, interactive web edition of three Power BI case reports. Visitors explore five report pages with slicers, linked chart selections, KPIs, accessible data tables, and shareable views. No Power BI installation, account, Service, or embedding is required.

## Reports

| Report | Pages | Data |
| --- | --- | --- |
| Call Centre Trends | Call centre performance | 5,000 calls, January–March 2021 |
| Customer Retention | Churn exploration; customer risk | 7,043 customers |
| Diversity & Inclusion | Hiring/promotion/turnover; performance/leadership/age | 500 employees |

The browser runs React + TypeScript and Apache ECharts. Python prepares the supplied workbooks into three independently loaded JSON datasets. A shared filter engine updates related charts and KPIs. The original PBIX files specify the report logic; they are not executed in the browser.

```text
Source workbooks → validated data snapshots → browser filter context
                                                   ↓
                                           measures and visuals
```

## Run locally

Prerequisites: **Node.js 22.12+**, npm, and Python 3.10+. Install Python packages in a virtual environment outside the repository.

```bash
python -m pip install -r requirements.txt
npm ci
npm run analyze
npm test
npm run build
npm run dev
```

Open the URL printed by Vite, including `/telecom-customer-operations-decision-hub/`. To inspect the production build, use `npm run preview` instead of `npm run dev`.

On Windows with multiple Node installations, `./scripts/dev.ps1` selects a compatible Node runtime already on PATH. Use `./scripts/dev.ps1 -Production` to preview the build.

`analyze` checks source schemas, unique IDs, row counts, missing charges, date coverage, and PBIX specification hashes. It regenerates the data manifest and independent pandas reference cases. `test` checks report measures, every chart series under reference contexts, and filter/link behaviour. `build` type-checks and produces `dist/`.

## Explore and share

- Open directly into Call Centre Trends; use the sidebar for the other reports and tabs for report pages.
- Combine slicers; values within one slicer use OR, and separate slicers use AND.
- Select chart categories or use **View data & select**. Enable Multi-select or hold Ctrl/Cmd for multiple categories.
- Choose **Filter**, **Highlight**, or **Off** for chart interactions. Highlight preserves comparison baselines; selected totals update in cards and tables.
- Remove individual filter chips, clear chart selections, or Reset report. Fixed report/visual cohorts remain in place.
- Share view copies a URL containing the current report, page, and filter state. Slicer state is separate for each report and persists between that report’s pages during the session.

Historical `service-operations.html`, `customer-retention.html`, and `diversity-inclusion.html` links redirect to the corresponding explorer report.

## Calculation fidelity

All **30 named DAX measures** and all five PBIX layouts were extracted. Retained workbook input projections were compared to **12,543 embedded model records**. Original filters and fiscal-year groupings are preserved in the calculation specifications.

Report calculations retain FY21 promotion grouping, FY19 turnover ratings, and the average-headcount denominator for turnover. Default FY20 turnover is **10.1%**.

See [fidelity and differences](docs/report-fidelity.md), [extracted specifications](docs/reference/reports.json), and [embedded-input checks](docs/reference/model-data-validation.json). Browser implementations and independent arithmetic controls do not establish complete native Power BI rendering or interaction parity; live DAX execution was not performed.

Optional extraction tools are separate from the build/runtime:

```bash
python -m pip install -r tools/powerbi/requirements.txt
npm run extract
python tools/powerbi/validate_model_data.py
npm run analyze
```

## Repository layout

| Folder | Purpose |
| --- | --- |
| `src/` | React components, report definitions, calculations, and styles |
| `reports/` | Original PBIX reports and source workbooks, grouped by report |
| `tests/` | Calculation/interaction tests and generated reference fixtures |
| `scripts/` | Data preparation, independent reference calculations, and local preview helper |
| `tools/powerbi/` | Optional PBIX extraction and model validation, with separate dependencies |
| `docs/` | Calculation documentation, validation evidence, and original reference screenshots |
| `public/` | Published datasets, required notices, icon, and legacy URL redirects |

Vite builds `index.html`, `src/`, and `public/` into ignored `dist/`. `node_modules/` contains installed application dependencies. Neither is committed. Planning drafts and the superseded website implementation are excluded.

## GitHub Pages deployment

The **Deploy GitHub Pages** workflow remains manual. It installs locked dependencies, regenerates data, checks for stale generated outputs, runs tests, builds the application, and deploys `dist/`. Push/PR validation does not deploy.

After review, push the intended release commit to `main`, then run the existing deployment workflow on `main`. This implementation branch has not been published. The existing live site remains unchanged until that workflow is run.

The Vite base path is `/telecom-customer-operations-decision-hub/`. Hash-based routing supports refreshed deep links on GitHub Pages. The same static output can be hosted by Vercel or Netlify; update the base path if using a domain root. No server/database is required.

## Case-material notice

This independent portfolio project is inspired by the PwC Switzerland / Forage Power BI case experience and is not commissioned, endorsed by, or affiliated with PwC.

Author-created software and documentation use the [MIT License](LICENSE). Supplied workbooks, PBIX files, reference screenshots, trademarks, and case materials are excluded; see [NOTICE.md](NOTICE.md). Public snapshots are downloadable. Source identifiers and unused attributes are omitted, but this is not an access-control guarantee. Confirm applicable case-data redistribution terms before public release of detailed snapshots.
