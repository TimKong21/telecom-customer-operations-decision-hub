export type Scalar = string | number | null;
export type Row = Record<string, Scalar>;
export type ReportId = "calls" | "retention" | "inclusion";
export type Filters = Record<string, Scalar[]>;
export type Interaction = "filter" | "highlight" | "ignore";
export type Selection = { source: string; field: string; values: Scalar[] };
export type ReportState = {
  filters: Filters;
  selections: Selection[];
  interaction: Interaction;
};
export type Context = {
  all: Row[];
  state: ReportState;
  pageFilters?: Filters;
  visualFilters?: Filters;
  target?: string;
  chart?: boolean;
};
export type Point = { label: string; values: (number | null)[]; key: Scalar };
export type Series = {
  name: string;
  color?: string;
  type?: "bar" | "line";
  axis?: number;
};
export type ChartModel = {
  id: string;
  title: string;
  subtitle?: string;
  kind: "bar" | "line" | "donut" | "gauge" | "combo";
  field?: string;
  points: Point[];
  series: Series[];
  format?: "number" | "percent" | "currency" | "decimal";
  axisFormats?: [
    "number" | "percent" | "currency" | "decimal",
    "number" | "percent" | "currency" | "decimal",
  ];
  horizontal?: boolean;
  stacked?: boolean;
  min?: number;
  max?: number;
  wide?: boolean;
  note?: string;
};
export type KPI = {
  label: string;
  value: number | null;
  format?: ChartModel["format"];
  detail?: string;
};
export const emptyState = (): ReportState => ({
  filters: {},
  selections: [],
  interaction: "filter",
});
