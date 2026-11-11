# Project guidance

Build the Decision Hub as a static, report-specific React/TypeScript application. Preserve the supplied PBIX/workbook originals and keep Power BI Service out of the runtime.

- Read `docs/report-fidelity.md` before changing calculations, cohorts, or interactions. `docs/reference/reports.json` is the extracted source evidence, not an executable model.
- Keep filtering in `src/engine.ts`, measures in `src/measures.ts`, and visual definitions in `src/reports.ts`. Do not calculate report metrics inside chart rendering code.
- Preserve CALCULATE column-filter replacement, independent report state, page/visual cohort restrictions, and null-aware averages. Update independent Python controls when source definitions legitimately change; never alter reference values merely to make a failing test pass.
- Keep source reports in `reports/`, tests/fixtures in `tests/`, and optional extraction dependencies/scripts in `tools/powerbi/`. Keep developer validation details in `docs/`; stakeholder pages should not display implementation history or comparisons with earlier hub versions.
- Run `npm run analyze`, `npm test`, and `npm run build` after relevant changes. Use Node 22.12+; the host may also have an older system Node installed.
- Keep GitHub Pages project-path compatibility and the three historical entry URLs. Deployment remains manual; do not publish without a user request.
- Keep scratch downloads, virtual environments, and browser screenshots under a task-specific local temporary directory. Keep generated report data and intentional test fixtures versioned; do not commit dist, dependencies, or caches.
- Explain architecture from the overall structure first. Use compact diagrams/tables when they clarify relationships; avoid dense or repetitive lists.
