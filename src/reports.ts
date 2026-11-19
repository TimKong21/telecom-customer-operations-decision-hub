import { rows } from "./engine";
import {
  callMeasures,
  distinct,
  divide,
  inclusionMeasures,
  mean,
  retentionMeasures,
  sum,
  yes,
} from "./measures";
import { emptyState } from "./types";
import type {
  ChartModel,
  Context,
  Filters,
  KPI,
  ReportId,
  Row,
  Scalar,
  Series,
} from "./types";

export const colors = [
  "#007f83",
  "#e4a52c",
  "#be4b50",
  "#5778ad",
  "#8a68a6",
  "#739a68",
];
export const levels = [
  "1 - Executive",
  "2 - Director",
  "3 - Senior Manager",
  "4 - Manager",
  "5 - Senior Officer",
  "6 - Junior Officer",
];
export const loyalty = [
  "0–12 months",
  "13–24 months",
  "25–36 months",
  "37–48 months",
  "49–60 months",
  "61–72 months",
];
export const reportInfo = {
  calls: {
    name: "Call Centre Trends",
    area: "Service operations",
    description:
      "Explore demand, response times, and resolution across the call centre.",
    pages: ["Call centre performance"],
    period: null,
  },
  retention: {
    name: "Customer Retention",
    area: "Customer retention",
    description:
      "Understand who leaves, the services they use, and where churn concentrates.",
    pages: ["Churn exploration", "Customer risk"],
    period: null,
  },
  inclusion: {
    name: "Diversity & Inclusion",
    area: "Diversity & inclusion",
    description:
      "Examine representation, career progression, and employee outcomes.",
    pages: ["Hiring, promotion & turnover", "Performance, leadership & age"],
    period: "FY20–FY21",
  },
};
export const fieldLabels: Record<string, string> = {
  topic: "Topic",
  date: "Date",
  month: "Month",
  hour: "Hour",
  agent: "Agent",
  answered: "Answered",
  resolved: "Resolved",
  contract: "Contract",
  internet: "Internet service",
  payment: "Payment method",
  gender: "Gender",
  churn: "Churn",
  loyalty: "Tenure",
  paperless: "Paperless billing",
  lines: "Multiple lines",
  senior: "Senior citizen",
  partner: "Partner",
  dependents: "Dependents",
  department: "Department",
  age: "Age group",
  region: "Region group",
  level20: "FY20 job level",
  level21: "FY21 job level",
  rating20: "FY20 performance rating",
};
export const slicerFields: Record<ReportId, string[]> = {
  calls: ["topic"],
  retention: ["contract", "internet", "payment"],
  inclusion: ["department", "age", "region"],
};
export const pageFilters = (report: ReportId, page: number): Filters =>
  report === "retention" && page === 1 ? { churn: ["Yes"] } : {};

export function churnByContract(context: Context) {
  // Numerators and denominators describe the same selected customer population.
  const population = rows(context);
  return ["Month-to-month", "One year", "Two year"].map((contract) => ({
    contract,
    ...retentionMeasures({
      all: population,
      state: emptyState(),
      visualFilters: { contract: [contract] },
    }),
  }));
}

function chart(
  context: Context,
  id: string,
  title: string,
  field: string,
  calc: (data: Row[], key: Scalar, scoped: Context) => (number | null)[],
  series: Series[],
  options: Partial<ChartModel> = {},
  filters: Filters = {},
  order?: Scalar[],
): ChartModel {
  const scoped = {
    ...context,
    target: id,
    chart: true,
    visualFilters: filters,
  };
  const data = rows(scoped);
  const keys = order ?? distinct(data, field);
  return {
    id,
    title,
    kind: "bar",
    field,
    series,
    points: keys.map((key) => ({
      key,
      label: key === null ? "(Blank)" : String(key),
      values: calc(
        data.filter((r) => (r[field] ?? null) === key),
        key,
        { ...scoped, visualFilters: { ...filters, [field]: [key] } },
      ),
    })),
    ...options,
  };
}
function count(
  context: Context,
  id: string,
  title: string,
  field: string,
  options: Partial<ChartModel> = {},
  filters: Filters = {},
  order?: Scalar[],
) {
  return chart(
    context,
    id,
    title,
    field,
    (d) => [d.length],
    [{ name: "Count" }],
    options,
    filters,
    order,
  );
}
function distribution(
  context: Context,
  id: string,
  title: string,
  field: string,
  options: Partial<ChartModel> = {},
  filters: Filters = {},
  order?: Scalar[],
) {
  const scoped = {
    ...context,
    target: id,
    chart: true,
    visualFilters: filters,
  };
  return chart(
    context,
    id,
    title,
    field,
    (d) => [divide(d.length, rows(scoped).length, 0)],
    [{ name: "Share" }],
    { format: "percent", horizontal: true, ...options },
    filters,
    order,
  );
}
const genderSeries: Series[] = [
  { name: "Female", color: colors[0] },
  { name: "Male", color: colors[1] },
];

export function kpis(report: ReportId, context: Context, page: number): KPI[] {
  if (report === "calls") {
    const m = callMeasures(context);
    return [
      { label: "Total calls", value: m.count },
      {
        label: "Calls answered",
        value: m.answered,
        detail: `${format(divide(m.answered, m.count), "percent")} of selected calls`,
      },
      {
        label: "Calls resolved",
        value: m.resolved,
        detail: `${format(divide(m.resolved, m.count), "percent")} of selected calls`,
      },
      {
        label: "Average satisfaction",
        value: m.satisfaction,
        format: "decimal",
        detail: "On a 1–5 scale",
      },
    ];
  }
  if (report === "retention") {
    const m = retentionMeasures(context);
    return page === 1
      ? [
          { label: "Churned customers", value: m.count },
          { label: "Technical tickets", value: m.tech },
          { label: "Administrative tickets", value: m.admin },
          { label: "Total charges", value: m.total, format: "currency" },
        ]
      : [
          { label: "Customers", value: m.count },
          { label: "Churn rate", value: m.churnRate, format: "percent" },
          { label: "Total charges", value: m.total, format: "currency" },
          {
            label: "Average monthly charge",
            value: m.monthly,
            format: "currency",
          },
        ];
  }
  const m = inclusionMeasures(context);
  return page === 1
    ? [
        { label: "Women in workforce", value: m.womenShare, format: "percent" },
        {
          label: "Men in workforce",
          value: m.womenShare === null ? null : 100 - m.womenShare,
          format: "percent",
        },
        {
          label: "Women’s share of promotions",
          value: m.womenPromoted,
          format: "percent",
          detail: "Among FY21 promotions",
        },
        {
          label: "FY20 turnover",
          value: m.turnover,
          format: "percent",
          detail: "Leavers / average headcount",
        },
      ]
    : [
        {
          label: "Average rating · men",
          value: m.ratingMen,
          format: "decimal",
        },
        {
          label: "Average rating · women",
          value: m.ratingWomen,
          format: "decimal",
        },
        {
          label: "Employees aged 20–29",
          value: rows({ ...context, visualFilters: { age: ["20 to 29"] } })
            .length,
        },
        { label: "Employees selected", value: m.count },
      ];
}

export function charts(
  report: ReportId,
  context: Context,
  page: number,
): ChartModel[] {
  if (report === "calls") {
    const data = rows(context),
      ratings = data.flatMap((r) =>
        typeof r.satisfaction === "number" ? [r.satisfaction] : [],
      ),
      speeds = data.flatMap((r) =>
        typeof r.speed === "number" ? [r.speed] : [],
      );
    return [
      {
        id: "satisfaction",
        title: "Average satisfaction",
        kind: "gauge",
        points: [
          {
            key: "",
            label: "Satisfaction",
            values: [mean(data, "satisfaction")],
          },
        ],
        series: [{ name: "Rating" }],
        min: 0,
        max: ratings.length ? Math.max(...ratings) : 5,
        format: "decimal",
        subtitle: "Average nonblank rating / observed maximum",
      },
      count(
        context,
        "answered",
        "Calls answered",
        "answered",
        { kind: "donut" },
        {},
        ["Y", "N"],
      ),
      count(
        context,
        "resolved",
        "Calls resolved",
        "resolved",
        { kind: "donut" },
        {},
        ["Y", "N"],
      ),
      {
        id: "answer-speed",
        title: "Average answer speed",
        kind: "gauge",
        points: [{ key: "", label: "Seconds", values: [mean(data, "speed")] }],
        series: [{ name: "Seconds" }],
        min: speeds.length ? Math.min(...speeds) : 0,
        max: speeds.length ? Math.max(...speeds) : 1,
        format: "decimal",
        subtitle: "Seconds / observed minimum and maximum",
      },
      chart(
        context,
        "hourly",
        "Call volume and unanswered calls by hour",
        "hour",
        (data) => {
          const unanswered = yes(data, "answered", "N");
          return [data.length, unanswered, divide(unanswered, data.length)];
        },
        [
          { name: "Total calls", type: "line", color: colors[0] },
          { name: "Unanswered calls", type: "bar", color: colors[2] },
          { name: "Unanswered rate (%)", type: "line", axis: 1, color: colors[1] },
        ],
        {
          kind: "combo",
          axisFormats: ["number", "percent"],
          wide: true,
          subtitle: "Call counts on the left axis and unanswered rate on the right",
        },
      ),
      chart(
        context,
        "monthly",
        "Calls by month",
        "month",
        (d) => [yes(d, "answered", "Y"), yes(d, "answered", "N")],
        [
          { name: "Answered", color: colors[0] },
          { name: "Not answered", color: colors[2] },
        ],
        { stacked: true, wide: true },
      ),
    ];
  }
  if (report === "retention" && page === 1) {
    const m = retentionMeasures(context);
    const demographics = ["senior", "partner", "dependents"].map((field) => {
      const scoped = {
        ...context,
        target: `demographic-${field}`,
        chart: true,
      };
      const data = rows(scoped);
      return {
        id: `demographic-${field}`,
        title: `${fieldLabels[field]} share`,
        kind: "gauge",
        min: 0,
        max: 100,
        points: [
          {
            key: "",
            label: "Share",
            values: [
              divide(
                rows(scoped, {
                  [field]: [field === "senior" ? 1 : "Yes"],
                  churn: ["Yes"],
                }).length,
                rows(scoped, { churn: ["Yes"] }).length,
                0,
              ),
            ],
          },
        ],
        series: [{ name: "Percent" }],
        format: "percent",
        subtitle: `${data.length.toLocaleString()} churned customers in context`,
      } as ChartModel;
    });
    const services = [
      ["phone", "Phone service"],
      ["tv", "Streaming TV"],
      ["movies", "Streaming movies"],
      ["protection", "Device protection"],
      ["backup", "Online backup"],
      ["support", "Tech support"],
      ["security", "Online security"],
    ];
    return [
      count(context, "gender", "Gender", "gender", { kind: "donut" }),
      ...demographics,
      distribution(
        context,
        "loyalty",
        "Subscription length",
        "loyalty",
        {},
        {},
        loyalty,
      ),
      distribution(context, "payment", "Payment method", "payment"),
      distribution(context, "contracts", "Contract type", "contract"),
      count(context, "paperless", "Paperless billing", "paperless", {
        kind: "donut",
      }),
      {
        id: "average-charges",
        title: "Average charges",
        subtitle: "Blank total charges are excluded from averages",
        kind: "bar",
        format: "currency",
        horizontal: true,
        points: [
          { key: "monthly", label: "Monthly", values: [m.monthly] },
          { key: "total", label: "Total", values: [m.averageTotal] },
        ],
        series: [{ name: "Average charge" }],
      },
      {
        id: "services",
        title: "Services subscribed",
        kind: "bar",
        horizontal: true,
        format: "percent",
        points: services.map(([field, label]) => ({
          key: field,
          label,
          values: [
            divide(
              rows(
                { ...context, target: "services", chart: true },
                { [field]: ["Yes"], churn: ["Yes"] },
              ).length,
              rows(
                { ...context, target: "services", chart: true },
                { churn: ["Yes"] },
              ).length,
              0,
            ),
          ],
        })),
        series: [{ name: "Adoption" }],
        note: "Percent of churned customers with each service. Categories overlap.",
      },
      count(
        context,
        "lines",
        "Multiple phone lines",
        "lines",
        {
          kind: "donut",
          note: "Excludes customers without phone service.",
        },
        { lines: ["Yes", "No"] },
      ),
      count(context, "internet", "Internet service", "internet", {
        kind: "donut",
      }),
    ];
  }
  if (report === "retention") {
    const risk = (
      id: string,
      title: string,
      field: string,
      second: "count" | "monthly",
      filters: Filters = {},
      order?: Scalar[],
    ) =>
      chart(
        context,
        id,
        title,
        field,
        (d, _key, scoped) => [
          divide(rows(scoped, { churn: ["Yes"] }).length, d.length, 0),
          second === "count" ? d.length : sum(d, "monthly"),
        ],
        [
          { name: "Churn rate (%)", type: "bar", color: colors[2] },
          {
            name: second === "count" ? "Customers" : "Monthly charges ($)",
            type: "line",
            axis: 1,
            color: colors[0],
          },
        ],
        {
          kind: "combo",
          axisFormats: ["percent", second === "count" ? "number" : "currency"],
          subtitle: "Churn rate on left axis; volume on right axis",
        },
        filters,
        order,
      );
    return [
      risk("internet-risk", "Churn by internet service", "internet", "count"),
      chart(
        context,
        "tickets",
        "Tickets by churn outcome",
        "churn",
        (d) => [sum(d, "admin"), sum(d, "tech")],
        [{ name: "Administrative" }, { name: "Technical", color: colors[1] }],
      ),
      chart(
        context,
        "charges",
        "Total charges by churn outcome",
        "churn",
        (d) =>
          ["DSL", "Fiber optic", "No"].map((s) =>
            sum(
              d.filter((r) => r.internet === s),
              "total",
            ),
          ),
        [
          { name: "DSL" },
          { name: "Fiber optic", color: colors[1] },
          { name: "No internet", color: colors[3] },
        ],
        { horizontal: true, stacked: true, format: "currency" },
      ),
      risk("payment-risk", "Churn by payment method", "payment", "monthly"),
      ...["Month-to-month", "One year", "Two year"].map((contract, i) =>
        risk(
          `tenure-${i}`,
          `${contract}: tenure & churn`,
          "loyalty",
          "monthly",
          { contract: [contract] },
          loyalty,
        ),
      ),
    ];
  }
  if (page === 1) {
    return [
      chart(
        context,
        "hiring",
        "Hiring history by job level",
        "level20",
        (d) => [yes(d, "gender", "Female"), yes(d, "gender", "Male")],
        genderSeries,
        {
          horizontal: true,
          wide: true,
          note: "Includes the full workforce, not only new hires.",
        },
        {},
        levels,
      ),
      chart(
        context,
        "promotions",
        "FY21 promotions",
        "level21",
        (d, _k, scoped) => [
          yes(d, "gender", "Female"),
          yes(d, "gender", "Male"),
          inclusionMeasures(scoped).womenPromoted,
        ],
        [
          ...genderSeries,
          {
            name: "Women’s share (%)",
            type: "line",
            axis: 1,
            color: colors[2],
          },
        ],
        {
          kind: "combo",
          axisFormats: ["number", "percent"],
          wide: true,
          subtitle: "Grouped by job level after FY21 promotions",
        },
        { promoted21: ["Yes"] },
        levels.slice(0, 5),
      ),
      chart(
        context,
        "time-level",
        "Average time in job level",
        "level20",
        (d) =>
          ["Female", "Male"].map((g) =>
            mean(
              d.filter((r) => r.gender === g),
              "yearsInLevel",
            ),
          ),
        genderSeries,
        {
          horizontal: true,
          format: "decimal",
          wide: true,
          subtitle: "Years at the FY20 job level",
        },
        {},
        levels,
      ),
      ...["Female", "Male"].map((gender, i) =>
        chart(
          context,
          `turnover-rating-${i}`,
          `${gender}: rating & turnover`,
          "level20",
          (d) =>
            ["No", "Yes"].map((leaver) =>
              mean(
                d.filter((r) => r.leaver === leaver),
                "rating19",
              ),
            ),
          [
            { name: "Stayed", color: colors[3], type: "line" },
            { name: "Left FY20", color: colors[2], type: "line" },
          ],
          {
            kind: "line",
            format: "decimal",
            wide: i === 1,
            subtitle: "Average FY19 performance rating, by FY20 leaver status",
          },
          { gender: [gender] },
          levels,
        ),
      ),
    ];
  }
  const executive = (id: string, title: string, filters: Filters) =>
    count(context, id, title, "gender", { kind: "donut" }, filters, [
      "Female",
      "Male",
    ]);
  return [
    chart(
      context,
      "ratings",
      "FY20 performance distribution",
      "gender",
      (d) => [1, 2, 3, 4].map((v) => d.filter((r) => r.rating20 === v).length),
      [1, 2, 3, 4].map((v, i) => ({ name: `Rating ${v}`, color: colors[i] })),
      {
        wide: true,
        subtitle: "Count of employees with a nonblank FY20 rating",
      },
      { rating20: [1, 2, 3, 4] },
    ),
    executive("executive20", "Executive balance · FY20", {
      level20: ["1 - Executive"],
    }),
    executive("executive21", "Executive balance · FY21", {
      level21: ["1 - Executive"],
    }),
    executive("executive-hires", "Executive hires · FY20", {
      level20: ["1 - Executive"],
      newHire: ["Y"],
    }),
    executive("executive-promotions", "Executive promotions · FY20", {
      level20: ["1 - Executive"],
      promoted20: ["Y"],
    }),
    chart(
      context,
      "ages",
      "Age profile by FY21 job level",
      "age",
      (d) => levels.map((l) => d.filter((r) => r.level21 === l).length),
      levels.map((l, i) => ({ name: l, color: colors[i] })),
      {
        stacked: true,
        wide: true,
        subtitle: "Current employees by age group and FY21 job level",
      },
      { leaverFY: [null] },
    ),
  ];
}

export function agentStatistics(context: Context) {
  return distinct(rows(context), "agent").map((agent) => {
    const scoped = { ...context, visualFilters: { agent: [agent] } },
      m = callMeasures(scoped);
    return {
      agent: String(agent),
      answered: m.answered,
      resolved: m.resolved,
      satisfaction: m.satisfaction,
      speed: m.speed,
    };
  });
}
export function format(
  value: number | null,
  style: ChartModel["format"] = "number",
) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (style === "percent")
    return `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  if (style === "currency")
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  return value.toLocaleString("en-US", {
    minimumFractionDigits: style === "decimal" ? 2 : 0,
    maximumFractionDigits: style === "decimal" ? 2 : 0,
  });
}
