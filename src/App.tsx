import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  initialStates,
  readRoute,
  routeHash,
  rows,
  toggleSelection,
} from "./engine";
import { findEvidence, findings } from "./evidence";
import { distinct } from "./measures";
import {
  agentStatistics,
  charts,
  churnByContract,
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
    evidence: initial.evidence,
  });
  const [states, setStates] = useState(() => ({
    ...initialStates(),
    [initial.report]: initial.state ?? emptyState(),
  }));
  const { report, page } = route;
  const evidence = findEvidence(report, page, route.evidence);
  const takeaway = findings.find(
    (finding) => finding.report === report && finding.page === page,
  );
  const state = states[report],
    info = reportInfo[report];
  const [dataset, setDataset] = useState<{
    report: ReportId;
    rows: Row[];
  } | null>(null);
  const data = dataset?.report === report ? dataset.rows : cache.get(report);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [multi, setMulti] = useState(false);
  const [copied, setCopied] = useState<"view" | "evidence" | null>(null);
  const [focusRequest, setFocusRequest] = useState(initial.evidence ? 1 : 0);
  const handledFocus = useRef(0);
  const focusEvidence = useCallback(
    (target: HTMLElement | null) => {
      if (!target || handledFocus.current === focusRequest) return;
      handledFocus.current = focusRequest;
      const details =
        target.querySelector<HTMLDetailsElement>("details.chart-data");
      if (details) details.open = true;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start" });
    },
    [focusRequest],
  );
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const [manifest, setManifest] = useState<{
    datasets: Record<string, { rows: number }>;
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
      setRoute({
        report: next.report,
        page: next.page,
        evidence: next.evidence,
      });
      setStates((s) => ({ ...s, [next.report]: next.state ?? emptyState() }));
      if (next.evidence) setFocusRequest((n) => n + 1);
    };
    addEventListener("hashchange", receive);
    addEventListener("popstate", receive);
    return () => {
      removeEventListener("hashchange", receive);
      removeEventListener("popstate", receive);
    };
  }, []);
  useEffect(() => {
    history.replaceState(
      null,
      "",
      routeHash(report, page, state, route.evidence),
    );
  }, [report, page, state, route.evidence]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
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
          if (!controller.signal.aborted) {
            cache.set(report, result);
            setDataset({ report, rows: result });
          }
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
    setRoute({ report: nextReport, page: nextPage, evidence: undefined });
  };
  const openEvidence = (finding: (typeof findings)[number]) => {
    history.pushState(
      null,
      "",
      routeHash(finding.report, finding.page, finding.preset, finding.id),
    );
    setStates((s) => ({ ...s, [finding.report]: finding.preset }));
    setRoute({
      report: finding.report,
      page: finding.page,
      evidence: finding.id,
    });
    setFocusRequest((n) => n + 1);
  };
  const copyLink = async (hash: string, kind: "view" | "evidence") => {
    const url = new URL(hash, location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
    } catch {
      setCopied(null);
      window.prompt("Copy this report link", url);
    }
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
  const sourceRows = manifest?.datasets[report]?.rows ?? data?.length ?? 0;
  const selectedCount = rows(context).length;
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
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>Telecom Customer Operations Decision Hub</span>
        </header>
        <main id="report-content" tabIndex={-1}>
          <div className="report-intro">
            <div>
              {info.period && <p className="period">{info.period}</p>}
              <h1>{info.name}</h1>
              <p className="intro-description">{info.description}</p>
            </div>
            <button
              className="button share-button"
              onClick={() =>
                copyLink(routeHash(report, page, state, route.evidence), "view")
              }
            >
              {copied === "view" ? "Link copied" : "Share view ↗"}
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
          {takeaway && (
            <section className="takeaway" aria-labelledby="takeaway-title">
              <p className="takeaway-scope">
                Analyst takeaway · {takeaway.scope}
              </p>
              <h2 id="takeaway-title">{takeaway.title}</h2>
              <p>
                {takeaway.finding} {takeaway.nextStep}
              </p>
              <div className="takeaway-actions">
                <a
                  href={routeHash(
                    takeaway.report,
                    takeaway.page,
                    takeaway.preset,
                    takeaway.id,
                  )}
                  onClick={(event) => {
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    openEvidence(takeaway);
                  }}
                >
                  View evidence
                </a>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    copyLink(
                      routeHash(
                        takeaway.report,
                        takeaway.page,
                        takeaway.preset,
                        takeaway.id,
                      ),
                      "evidence",
                    )
                  }
                >
                  {copied === "evidence"
                    ? "Evidence link copied"
                    : "Copy evidence link"}
                </button>
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
                    onClick={() => {
                      update(evidence?.preset ?? emptyState());
                      if (evidence) setFocusRequest((n) => n + 1);
                    }}
                  >
                    {evidence ? "Reset to evidence view" : "↺ Reset report"}
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
                {metrics.map((kpi) => (
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
              {report === "retention" && page === 2 && (
                <section
                  className="visual contract-evidence"
                  aria-labelledby="contract-evidence-title"
                  data-visual="contract-churn"
                  tabIndex={-1}
                  ref={
                    evidence?.target === "contract-churn"
                      ? focusEvidence
                      : undefined
                  }
                >
                  <div className="visual-heading">
                    <h2 id="contract-evidence-title">Churn by contract type</h2>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <caption className="sr-only">
                        Customer counts and churn rates by contract type for the
                        selected population
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Contract type</th>
                          <th scope="col">Customers</th>
                          <th scope="col">Churned customers</th>
                          <th scope="col">Churn rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {churnByContract(context).map((row) => (
                          <tr key={row.contract}>
                            <th scope="row">{row.contract}</th>
                            <td>{format(row.count)}</td>
                            <td>{format(row.churned)}</td>
                            <td>{format(row.churnRate, "percent")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              <div
                className={`report-grid ${report === "calls" ? "calls-grid" : ""}`}
              >
                <Suspense fallback={<p role="status">Loading charts…</p>}>
                  {visualModels.map((model) => (
                    <Chart
                      key={`${report}-${page}-${model.id}`}
                      model={model}
                      highlighted={highlighted.find((h) => h.id === model.id)}
                      selections={state.selections}
                      onSelect={select}
                      multi={multi}
                      evidenceRef={
                        evidence?.target === model.id
                          ? focusEvidence
                          : undefined
                      }
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
                          ...context,
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
            </>
          )}
          <footer>
            <span>
              Based on PwC / Forage case materials. No affiliation or
              endorsement.
            </span>
            <a href={`${base}case-material-notice.txt`}>Case material notice</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
