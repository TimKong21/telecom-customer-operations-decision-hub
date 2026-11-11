import {
  emptyState,
  type Context,
  type Filters,
  type Interaction,
  type ReportId,
  type ReportState,
  type Row,
  type Scalar,
  type Selection,
} from "./types";

export function match(row: Row, filters: Filters) {
  return Object.entries(filters).every(([field, values]) => {
    if (!values.length) return true;
    if (field === "dateFrom") return String(row.date) >= String(values[0]);
    if (field === "dateTo") return String(row.date) <= String(values[0]);
    return values.includes(row[field] ?? null);
  });
}

// Overrides implement CALCULATE's replacement of filters on the named column.
export function rows(
  context: Context,
  overrides: Filters = {},
  remove: string[] = [],
): Row[] {
  const omit = new Set([...Object.keys(overrides), ...remove]);
  const prune = (filters: Filters = {}): Filters =>
    Object.fromEntries(
      Object.entries(filters).filter(([field]) => !omit.has(field)),
    );
  const filters = [
    prune(context.state.filters),
    prune(context.pageFilters),
    prune(context.visualFilters),
    overrides,
  ];
  const selections = context.state.selections.filter(
    (s) =>
      context.state.interaction !== "ignore" &&
      !omit.has(s.field) &&
      s.source !== context.target &&
      (!context.chart || context.state.interaction === "filter"),
  );
  return context.all.filter(
    (row) =>
      filters.every((f) => match(row, f)) &&
      selections.every((s) => s.values.includes(row[s.field] ?? null)),
  );
}

export function toggleSelection(
  current: Selection[],
  source: string,
  field: string,
  value: Scalar,
  multi: boolean,
): Selection[] {
  const existing = current.find((s) => s.source === source);
  const selected = existing?.values.includes(value);
  const values = multi
    ? selected
      ? existing!.values.filter((v) => v !== value)
      : [...(existing?.values ?? []), value]
    : selected && existing?.values.length === 1
      ? []
      : [value];
  return [
    ...current.filter((s) => s.source !== source),
    ...(values.length ? [{ source, field, values }] : []),
  ];
}

const reports = new Set<ReportId>(["calls", "retention", "inclusion"]);
const modes = new Set<Interaction>(["filter", "highlight", "ignore"]);
export function readRoute(hash: string): {
  report: ReportId;
  page: number;
  state?: ReportState;
} {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [candidate, page] = path.split("/");
  const report = reports.has(candidate as ReportId)
    ? (candidate as ReportId)
    : "calls";
  const result: ReturnType<typeof readRoute> = {
    report,
    page: report !== "calls" && page === "2" ? 2 : 1,
  };
  try {
    const encoded = new URLSearchParams(query).get("state");
    if (!encoded || encoded.length > 16000) return result;
    const state = JSON.parse(encoded);
    const scalar = (x: unknown): x is Scalar =>
      x === null ||
      typeof x === "string" ||
      (typeof x === "number" && Number.isFinite(x));
    const filters = (x: unknown): x is Filters =>
      !!x &&
      typeof x === "object" &&
      !Array.isArray(x) &&
      Object.entries(x).every(
        ([k, v]) =>
          k !== "__proto__" &&
          Array.isArray(v) &&
          v.length <= 100 &&
          v.every(scalar),
      );
    if (
      filters(state.filters) &&
      Array.isArray(state.selections) &&
      state.selections.length <= 40 &&
      state.selections.every(
        (s: Selection) =>
          typeof s.source === "string" &&
          typeof s.field === "string" &&
          Array.isArray(s.values) &&
          s.values.every(scalar),
      ) &&
      modes.has(state.interaction)
    )
      result.state = state;
  } catch {
    /* Invalid links open the report in its default state. */
  }
  return result;
}

export function routeHash(report: ReportId, page: number, state: ReportState) {
  const hasState =
    Object.keys(state.filters).length ||
    state.selections.length ||
    state.interaction !== "filter";
  return `#/${report}/${page}${hasState ? `?${new URLSearchParams({ state: JSON.stringify(state) })}` : ""}`;
}
export function initialStates(): Record<ReportId, ReportState> {
  return {
    calls: emptyState(),
    retention: emptyState(),
    inclusion: emptyState(),
  };
}
