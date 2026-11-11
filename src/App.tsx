import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  initialStates,
  readRoute,
  routeHash,
  rows,
  toggleSelection,
} from "./engine";
import { distinct } from "./measures";
import {
  agentStatistics,
  charts,
  fieldLabels,
  format,
  kpis,
  pageFilters,
  reportInfo,
  slicerFields,
} from "./reports";
import {
  emptyState,
  type Context,
  type ReportId,
  type ReportState,
  type Row,
  type Scalar,
} from "./types";

const Chart = lazy(() => import("./Chart"));
const cache = new Map<ReportId, Row[]>();
const base = import.meta.env.BASE_URL;
const ids: ReportId[] = ["calls", "retention", "inclusion"];

function Slicer({
  field,
  data,
  state,
  update,
}: {
  field: string;
  data: Row[];
  state: ReportState;
  update: (state: ReportState) => void;
}) {
  const selected = state.filters[field] ?? [];
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!details.current?.contains(event.target as Node))
        details.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details
      className="slicer"
      ref={details}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          details.current?.removeAttribute("open");
          details.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>
        <span>{fieldLabels[field]}</span>
        <strong>
          {selected.length
            ? selected.length === 1
              ? String(selected[0])
              : `${selected.length} selected`
            : "All"}
        </strong>
        <span className="chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <fieldset>
        <legend className="sr-only">{fieldLabels[field]}</legend>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            const filters = { ...state.filters };
            delete filters[field];
            update({ ...state, filters });
          }}
        >
          Select all / clear
        </button>
        {distinct(data, field).map((value) => (
          <label key={String(value)}>
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => {
                const values = selected.includes(value)
                  ? selected.filter((x) => x !== value)
                  : [...selected, value];
                const filters = { ...state.filters };
                if (values.length) filters[field] = values;
                else delete filters[field];
                update({ ...state, filters });
              }}
            />
            {String(value ?? "(Blank)")}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

export default function App() {
  const initial = useMemo(() => readRoute(location.hash), []);
  const [route, setRoute] = useState({
    report: initial.report,
    page: initial.page,
  });
  const [states, setStates] = useState(() => ({
    ...initialStates(),
    [initial.report]: initial.state ?? emptyState(),
  }));
  const { report, page } = route;
  const state = states[report],
    info = reportInfo[report];
  const [data, setData] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [methodology, setMethodology] = useState(false);
  const methodTrigger = useRef<HTMLElement | null>(null);
  const toggleMethodology = () => {
    if (!methodology)
      methodTrigger.current = document.activeElement as HTMLElement;
    setMethodology((v) => !v);
  };
  useEffect(() => {
    if (methodology) document.getElementById("methodology")?.focus();
    else if (methodTrigger.current) {
      methodTrigger.current.focus({ preventScroll: true });
      methodTrigger.current = null;
    }
  }, [methodology]);
  const [multi, setMulti] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manifest, setManifest] = useState<{
    datasets: Record<string, { rows: number; source: string }>;
  } | null>(null);
  useEffect(() => {
    fetch(`${base}data/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setManifest)
      .catch(() => setManifest(null));
  }, []);
  useEffect(() => {
    const receive = () => {
      const next = readRoute(location.hash);
      setRoute({ report: next.report, page: next.page });
      setStates((s) => ({ ...s, [next.report]: next.state ?? emptyState() }));
    };
    addEventListener("hashchange", receive);
    addEventListener("popstate", receive);
    return () => {
      removeEventListener("hashchange", receive);
      removeEventListener("popstate", receive);
    };
  }, []);
  useEffect(() => {
    history.replaceState(null, "", routeHash(report, page, state));
  }, [report, page, state]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(cache.get(report) ?? null);
    if (!cache.has(report))
      fetch(`${base}data/${report}.json`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok)
            throw new Error(
              "The report data could not be loaded. Check your connection and try again.",
            );
          const result = await response.json();
          if (!Array.isArray(result))
            throw new Error(
              "The report data is unavailable. Try reloading the page.",
            );
          cache.set(report, result);
          setData(result);
        })
        .catch((err) => {
          if (err.name !== "AbortError") setError(err.message);
        });
    return () => controller.abort();
  }, [report, retry]);
  const update = (next: ReportState) =>
    setStates((s) => ({ ...s, [report]: next }));
  const navigate = (nextReport: ReportId, nextPage = 1) => {
    history.pushState(
      null,
      "",
      routeHash(nextReport, nextPage, states[nextReport]),
    );
    setRoute({ report: nextReport, page: nextPage });
  };
  const context: Context = {
    all: data ?? [],
    state,
    pageFilters: pageFilters(report, page),
  };
  const visualModels = data ? charts(report, context, page) : [];
  const highlighted =
    data && state.interaction === "highlight" && state.selections.length
      ? charts(
          report,
          { ...context, state: { ...state, interaction: "filter" } },
          page,
        )
      : [];
  const metrics = data ? kpis(report, context, page) : [];
  const select = (
    source: string,
    field: string,
    key: Scalar,
    multiple = false,
  ) => {
    if (state.interaction === "ignore") return;
    update({
      ...state,
      selections: toggleSelection(
        state.selections,
        source,
        field,
        key,
        multiple,
      ),
    });
  };
  const dateFilter = (field: string, value: string) => {
    const filters = { ...state.filters };
    if (value) filters[field] = [value];
    else delete filters[field];
    update({ ...state, filters });
  };
  const effectiveContext = context;
  const boundedCharts = visualModels;
  const boundedHighlights = highlighted;
  const boundedMetrics = metrics;
  const sourceRows = manifest?.datasets[report]?.rows ?? data?.length ?? 0;
  const selectedCount = rows(effectiveContext).length;
  const hasFilters =
    Object.keys(state.filters).length > 0 || state.selections.length > 0;
  return (
    <div className="app-shell">
      <a
        href="#report-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("report-content")?.focus();
        }}
      >
        Skip to report
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href={`${base}#/calls/1`}
          onClick={(e) => {
            e.preventDefault();
            navigate("calls");
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            Telecom<span>Decision Hub</span>
          </span>
        </a>
        <p className="nav-label">Explore reports</p>
        <nav aria-label="Reports">
          {ids.map((id, i) => (
            <a
              key={id}
              href={routeHash(id, 1, states[id])}
              aria-current={report === id ? "page" : undefined}
              className={report === id ? "nav-link active" : "nav-link"}
              onClick={(e) => {
                e.preventDefault();
                navigate(id);
              }}
            >
              <span className="nav-icon" aria-hidden="true">
                {["▥", "◉", "◇"][i]}
              </span>
              <span>
                {reportInfo[id].area}
                <small>
                  {reportInfo[id].pages.length} report{" "}
                  {reportInfo[id].pages.length === 1 ? "page" : "pages"}
                </small>
              </span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="independent">
            <i /> Independent & interactive
          </span>
          <p>
            Built from the original case reports. Explore the data at your own
            pace.
          </p>
          <button
            className="sidebar-method"
            onClick={toggleMethodology}
            aria-expanded={methodology}
          >
            About this report explorer
          </button>
          <a
            href="https://github.com/TimKong21/telecom-customer-operations-decision-hub"
            target="_blank"
            rel="noreferrer"
          >
            View source on GitHub ↗
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Telecom Customer Operations Decision Hub</span>
          <span className="case-badge">Portfolio case data</span>
        </header>
        <main id="report-content" tabIndex={-1}>
          <div className="report-intro">
            <div>
              <p className="period">{info.period}</p>
              <h1>{info.name}</h1>
              <p className="intro-description">{info.description}</p>
            </div>
            <button
              className="button share-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                } catch {
                  setCopied(false);
                  window.prompt("Copy this report link", location.href);
                }
              }}
            >
              {copied ? "Link copied" : "Share view ↗"}
            </button>
          </div>
          <div className="page-navigation">
            <nav aria-label="Report pages">
              {info.pages.map((name, i) => (
                <a
                  key={name}
                  href={routeHash(report, i + 1, state)}
                  className={page === i + 1 ? "page-tab selected" : "page-tab"}
                  aria-current={page === i + 1 ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(report, i + 1);
                  }}
                >
                  {name}
                </a>
              ))}
            </nav>
            <span>
              {page} / {info.pages.length}
            </span>
          </div>
          {methodology && (
            <section
              id="methodology"
              tabIndex={-1}
              className="methodology"
              aria-label="About this report explorer"
            >
              <div className="method-title">
                <h2>Your reports, independently hosted</h2>
                <button
                  aria-label="Close report information"
                  onClick={() => setMethodology(false)}
                >
                  ×
                </button>
              </div>
              <p>
                Charts and calculations are rebuilt from the three original
                Power BI reports and source workbooks. No Microsoft account or
                Power BI Service is used. All data is a fixed case snapshot.
              </p>
              <div className="method-columns">
                <div>
                  <h3>Calculation fidelity</h3>
                  <p>
                    All 30 named DAX measures were extracted. FY20 turnover is
                    47 / ((434 + 500) / 2) = 10.1%. Promotion charts use the
                    FY21 job level; turnover comparisons use FY19 ratings. Blank
                    charges remain blank in averages.
                  </p>
                </div>
                <div>
                  <h3>Web adaptations</h3>
                  <p>
                    Responsive layouts, persistent slicers between report pages,
                    linked chart filtering, and retention slicers are web
                    enhancements. Choose Highlight for comparative overlays, or
                    Off to disable chart selection. Original interaction
                    defaults have not been validated in Desktop.
                  </p>
                </div>
                <div>
                  <h3>Source & limitations</h3>
                  <p>
                    {manifest?.datasets[report]?.source ??
                      "Source workbook in the repository"}
                    . Model expressions and independent calculation tests
                    support validation; no live DAX engine was used. Read the
                    complete{" "}
                    <a
                      href={`${base}methodology.txt`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      fidelity notes
                    </a>
                    .
                  </p>
                </div>
              </div>
            </section>
          )}
          {error ? (
            <section role="alert" className="load-state">
              <h2>Report unavailable</h2>
              <p>{error}</p>
              <button className="button" onClick={() => setRetry((x) => x + 1)}>
                Try again
              </button>
            </section>
          ) : !data ? (
            <div className="load-state" role="status">
              Loading report data…
            </div>
          ) : (
            <>
              <section className="filter-panel" aria-label="Report filters">
                <div className="filter-top">
                  <span className="filter-label">Filter this report</span>
                  <button
                    className="text-button"
                    onClick={() => update(emptyState())}
                  >
                    ↺ Reset report
                  </button>
                </div>
                <div className="slicer-row">
                  {report === "calls" && (
                    <div className="date-range">
                      <span>Date range</span>
                      <div>
                        <label>
                          <span className="sr-only">From date</span>
                          <input
                            type="date"
                            min="2021-01-01"
                            max="2021-03-31"
                            value={String(state.filters.dateFrom?.[0] ?? "")}
                            onChange={(e) =>
                              dateFilter("dateFrom", e.target.value)
                            }
                          />
                        </label>
                        <span aria-hidden="true">–</span>
                        <label>
                          <span className="sr-only">To date</span>
                          <input
                            type="date"
                            min="2021-01-01"
                            max="2021-03-31"
                            value={String(state.filters.dateTo?.[0] ?? "")}
                            onChange={(e) =>
                              dateFilter("dateTo", e.target.value)
                            }
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  {slicerFields[report].map((field) => (
                    <Slicer
                      key={`${report}-${field}`}
                      field={field}
                      data={data}
                      state={state}
                      update={update}
                    />
                  ))}
                </div>
              </section>
              <div className="exploration-toolbar">
                <p role="status" aria-live="polite">
                  <strong data-testid="selected-count">
                    {selectedCount.toLocaleString()}
                  </strong>{" "}
                  of {sourceRows.toLocaleString()}{" "}
                  {report === "calls"
                    ? "calls"
                    : report === "retention"
                      ? "customers"
                      : "employees"}
                  {report === "retention" && page === 1 && (
                    <span className="scope-tag">Churn = Yes</span>
                  )}
                </p>
                <div className="interaction-controls">
                  <label>
                    Chart interaction{" "}
                    <select
                      value={state.interaction}
                      onChange={(e) =>
                        update({
                          ...state,
                          interaction: e.target
                            .value as ReportState["interaction"],
                          selections:
                            e.target.value === "ignore" ? [] : state.selections,
                        })
                      }
                    >
                      <option value="filter">Filter</option>
                      <option value="highlight">Highlight</option>
                      <option value="ignore">Off</option>
                    </select>
                  </label>
                  <label className="multi-toggle">
                    <input
                      type="checkbox"
                      checked={multi}
                      onChange={(e) => setMulti(e.target.checked)}
                    />
                    Multi-select
                  </label>
                </div>
              </div>
              {hasFilters && (
                <div className="filter-chips" aria-label="Active filters">
                  {Object.entries(state.filters).map(([field, values]) => (
                    <button
                      key={field}
                      onClick={() => {
                        const filters = { ...state.filters };
                        delete filters[field];
                        update({ ...state, filters });
                      }}
                      aria-label={`Remove ${fieldLabels[field] ?? field} filter`}
                    >
                      {fieldLabels[field] ??
                        (field === "dateFrom"
                          ? "From"
                          : field === "dateTo"
                            ? "To"
                            : field)}
                      : {values.join(", ")} <span>×</span>
                    </button>
                  ))}
                  {state.selections.map((s) => (
                    <button
                      key={s.source}
                      onClick={() =>
                        update({
                          ...state,
                          selections: state.selections.filter(
                            (x) => x.source !== s.source,
                          ),
                        })
                      }
                      aria-label={`Clear ${fieldLabels[s.field] ?? s.field} selection`}
                    >
                      {fieldLabels[s.field] ?? s.field}: {s.values.join(", ")}{" "}
                      <span>×</span>
                    </button>
                  ))}
                  {state.selections.length > 0 && (
                    <button
                      className="text-button"
                      onClick={() => update({ ...state, selections: [] })}
                    >
                      Clear chart selections
                    </button>
                  )}
                </div>
              )}
              {selectedCount === 0 && (
                <div className="empty-banner" role="status">
                  <strong>No matching records.</strong> Clear filters or reset
                  the report to explore a broader group.
                </div>
              )}
              <div className="kpi-grid">
                {boundedMetrics.map((kpi) => (
                  <section
                    className="kpi"
                    key={kpi.label}
                    aria-label={kpi.label}
                  >
                    <p>{kpi.label}</p>
                    <strong
                      title={format(kpi.value, kpi.format)}
                      data-testid={`kpi-${kpi.label}`}
                    >
                      {kpi.format === "currency" &&
                      kpi.value !== null &&
                      Math.abs(kpi.value) >= 100000
                        ? kpi.value.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            maximumFractionDigits: 2,
                          })
                        : format(kpi.value, kpi.format)}
                    </strong>
                    {kpi.detail && <small>{kpi.detail}</small>}
                  </section>
                ))}
              </div>
              {report === "inclusion" && page === 1 && (
                <p className="reconciliation-note">
                  Turnover follows the original DAX: leavers ÷ average
                  before/after-hire headcount. The previous hub used total
                  headcount and displayed 9.4%.
                </p>
              )}
              <div
                className={`report-grid ${report === "calls" ? "calls-grid" : ""}`}
              >
                <Suspense fallback={<p role="status">Loading charts…</p>}>
                  {boundedCharts.map((model) => (
                    <Chart
                      key={`${report}-${page}-${model.id}`}
                      model={model}
                      highlighted={boundedHighlights.find(
                        (h) => h.id === model.id,
                      )}
                      selections={state.selections}
                      onSelect={select}
                      multi={multi}
                    />
                  ))}
                </Suspense>
              </div>
              {report === "calls" && (
                <section className="visual agent-table">
                  <div className="visual-heading">
                    <div>
                      <h2>Agent statistics</h2>
                      <p>
                        Select an agent to explore their calls, ratings, and
                        response times.
                      </p>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <caption className="sr-only">
                        Agent statistics for the current report context
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Agent</th>
                          <th scope="col">Answered</th>
                          <th scope="col">Resolved</th>
                          <th scope="col">Avg. satisfaction</th>
                          <th scope="col">Avg. answer speed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentStatistics({
                          ...effectiveContext,
                          target: "agent-statistics",
                        }).map((a) => (
                          <tr key={a.agent}>
                            <th scope="row">
                              <button
                                className="table-select"
                                aria-pressed={state.selections.some(
                                  (s) =>
                                    s.source === "agent-statistics" &&
                                    s.values.includes(a.agent),
                                )}
                                onClick={(e) =>
                                  select(
                                    "agent-statistics",
                                    "agent",
                                    a.agent,
                                    multi || e.ctrlKey || e.metaKey,
                                  )
                                }
                              >
                                {a.agent}
                              </button>
                            </th>
                            <td>{format(a.answered)}</td>
                            <td>{format(a.resolved)}</td>
                            <td>{format(a.satisfaction, "decimal")}</td>
                            <td>{format(a.speed, "decimal")}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              <section className="decision-note">
                <div>
                  <h2>Put the view in context</h2>
                  <p>
                    {report === "calls"
                      ? "Compare answer speed, satisfaction, and resolution together before interpreting differences between agents or topics."
                      : report === "retention"
                        ? "Compare churn rates with segment size and ticket demand. These patterns describe associations, not the effects of an intervention."
                        : "Read promotion shares alongside workforce representation and eligibility. Small cohorts can produce large percentage changes."}
                  </p>
                </div>
                <button className="text-button" onClick={toggleMethodology}>
                  {methodology
                    ? "Hide methodology"
                    : "Methodology & differences"}
                </button>
              </section>
            </>
          )}
          <footer>
            <span>
              Independent portfolio project inspired by the PwC / Forage case
              experience. No affiliation or endorsement.
            </span>
            <span>Fixed case data. No live feed.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
