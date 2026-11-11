import { rows } from "./engine";
import type { Context, ReportId, Row } from "./types";

export const sum = (data: Row[], field: string) =>
  data.reduce(
    (n, r) => n + (typeof r[field] === "number" ? (r[field] as number) : 0),
    0,
  );
export function mean(data: Row[], field: string): number | null {
  const valid = data.filter(
    (r) => typeof r[field] === "number" && Number.isFinite(r[field]),
  );
  return valid.length ? sum(valid, field) / valid.length : null;
}
export const divide = (
  n: number,
  d: number,
  alternate: number | null = null,
) => (d ? (n / d) * 100 : alternate);
export const yes = (data: Row[], field: string, value = "Yes") =>
  data.filter((r) => r[field] === value).length;
export const distinct = (data: Row[], field: string) =>
  [...new Set(data.map((r) => r[field] ?? null))].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true }),
  );

export function callMeasures(context: Context) {
  const data = rows(context);
  return {
    count: data.length,
    answered: rows(context, { answered: ["Y"] }).length,
    resolved: rows(context, { resolved: ["Y"] }).length,
    satisfaction: mean(data, "satisfaction"),
    speed: mean(data, "speed"),
  };
}
export function retentionMeasures(context: Context) {
  const data = rows(context),
    churned = rows(context, { churn: ["Yes"] });
  return {
    count: data.length,
    churned: churned.length,
    churnRate: divide(churned.length, data.length, 0),
    total: sum(data, "total"),
    monthly: mean(data, "monthly"),
    averageTotal: mean(data, "total"),
    tech: sum(data, "tech"),
    admin: sum(data, "admin"),
  };
}
export function inclusionMeasures(context: Context) {
  const data = rows(context);
  const men = rows(context, { gender: ["Male"] }),
    women = rows(context, { gender: ["Female"] });
  const before = rows(context, { turnoverBase: ["Y"] }).length;
  const after = men.length + women.length;
  const promoted = rows(context, { promoted21: ["Yes"] });
  return {
    count: data.length,
    womenShare: divide(women.length, after),
    turnover: divide(
      rows(context, { leaver: ["Yes"] }).length,
      (before + after) / 2,
    ),
    womenPromoted: divide(
      rows(context, { promoted21: ["Yes"], gender: ["Female"] }).length,
      promoted.length,
    ),
    ratingMen: mean(men, "rating20"),
    ratingWomen: mean(women, "rating20"),
    promotions: promoted.length,
    leavers: rows(context, { leaver: ["Yes"] }).length,
  };
}
export const measures = (report: ReportId, context: Context) =>
  report === "calls"
    ? callMeasures(context)
    : report === "retention"
      ? retentionMeasures(context)
      : inclusionMeasures(context);
