import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  initialStates,
  readRoute,
  routeHash,
  rows,
  toggleSelection,
} from "../src/engine";
import {
  inclusionMeasures,
  mean,
  measures,
  retentionMeasures,
} from "../src/measures";
import {
  agentStatistics,
  charts,
  churnByContract,
  format,
  kpis,
  pageFilters,
} from "../src/reports";
import { findings } from "../src/evidence";
import {
  emptyState,
  type Context,
  type Filters,
  type ReportId,
  type Row,
} from "../src/types";
import fixtures from "./fixtures/reference-cases.json";
import visualFixtures from "./fixtures/reference-visuals.json";

const datasets = Object.fromEntries(
  ["calls", "retention", "inclusion"].map((id) => [
    id,
    JSON.parse(readFileSync(`public/data/${id}.json`, "utf8")),
  ]),
) as Record<ReportId, Row[]>;
function context(report: ReportId, filters: Filters = {}): Context {
  return { all: datasets[report], state: { ...emptyState(), filters } };
}

describe("published evidence", () => {
  it("opens canonical presets and round-trips an edited evidence view", () => {
    for (const finding of findings) {
      const { report, page, preset, id } = finding;
      const canonical = routeHash(report, page, preset, id);
      expect(canonical).toBe(`#/${report}/${page}?evidence=${id}`);
      expect(readRoute(canonical)).toEqual({
        report,
        page,
        evidence: id,
        state: preset,
      });
      expect(readRoute(canonical + "&state=bad").state).toEqual(preset);
      const edited = { ...preset, filters: { example: ["selection"] } };
      expect(readRoute(routeHash(report, page, edited, id)).state).toEqual(
        edited,
      );
      expect(routeHash(report, page, preset, id)).toBe(canonical);
    }
    expect(readRoute("#/retention/1?evidence=churn-by-contract")).toEqual({
      report: "retention",
      page: 1,
    });
    expect(readRoute("#/retention/2?evidence=unknown")).toEqual({
      report: "retention",
      page: 2,
    });
  });

  it("supports the published staffing and representation comparisons", () => {
    const hourly = charts("calls", context("calls"), 1).find(
      (chart) => chart.id === "hourly",
    )!;
    const peak = hourly.points.reduce((largest, point) =>
      (point.values[0] ?? 0) > (largest.values[0] ?? 0) ? point : largest,
    );
    expect([peak.key, peak.values[0]]).toEqual([13, 594]);
    const unansweredPeak = hourly.points.reduce((largest, point) =>
      (point.values[1] ?? 0) > (largest.values[1] ?? 0) ? point : largest,
    );
    expect([unansweredPeak.key, ...unansweredPeak.values.slice(0, 2)]).toEqual([
      12, 547, 116,
    ]);
    expect(format(unansweredPeak.values[2], "percent")).toBe("21.2%");
    expect(peak.values[1]).toBe(110);
    expect(format(peak.values[2], "percent")).toBe("18.5%");

    const workforce = charts("inclusion", context("inclusion"), 1).find(
      (chart) => chart.id === "hiring",
    )!;
    expect(
      workforce.points.find((point) => point.key === "1 - Executive")?.values,
    ).toEqual([2, 14]);
    expect(
      workforce.points.find((point) => point.key === "6 - Junior Officer")
        ?.values,
    ).toEqual([109, 95]);
    expect(
      workforce.points.find((point) => point.key === "3 - Senior Manager")?.values,
    ).toEqual([10, 46]);
  });

  it("opens retention evidence with all service groups within month-to-month contracts", () => {
    const route = readRoute("#/retention/2?evidence=churn-by-contract");
    expect(route.state?.filters).toEqual({ contract: ["Month-to-month"] });
    const scoped = context("retention", route.state?.filters);
    expect(rows(scoped)).toHaveLength(3875);
    const service = charts("retention", scoped, route.page).find(
      (chart) => chart.id === "internet-risk",
    )!;
    expect(
      service.points.map(({ key, values }) => [key, values[1], format(values[0], "percent")]),
    ).toEqual([
      ["DSL", 1223, "32.2%"],
      ["Fiber optic", 2128, "54.6%"],
      ["No", 524, "18.9%"],
    ]);
    expect(rows(scoped).filter((row) => row.internet === "Fiber optic" && row.churn === "Yes")).toHaveLength(1162);
  });

  it("compares contract churn against the full population and respects slicers", () => {
    const comparison = churnByContract(context("retention"));
    expect(
      comparison.map((row) => [
        row.count,
        row.churned,
        format(row.churnRate, "percent"),
      ]),
    ).toEqual([
      [3875, 1655, "42.7%"],
      [1473, 166, "11.3%"],
      [1695, 48, "2.8%"],
    ]);
    expect(comparison.reduce((total, row) => total + row.churned, 0)).toBe(
      1869,
    );
    expect(
      churnByContract(context("retention", { contract: ["One year"] })).map(
        (row) => row.count,
      ),
    ).toEqual([0, 1473, 0]);
    const retained = churnByContract(context("retention", { churn: ["No"] }));
    expect(retained.map((row) => row.count)).toEqual([2220, 1307, 1647]);
    expect(retained.map((row) => row.churned)).toEqual([0, 0, 0]);
  });
});

describe("independent Python workbook calculation controls", () => {
  for (const f of fixtures)
    it(`${f.report}: ${f.name}`, () => {
      const result = measures(
        f.report as ReportId,
        context(f.report as ReportId, f.filters as Filters),
      );
      for (const [key, expected] of Object.entries(f.expected)) {
        const actual = result[key as keyof typeof result];
        if (typeof expected === "number") {
          if (
            [
              "count",
              "answered",
              "resolved",
              "churned",
              "promotions",
              "leavers",
              "tech",
              "admin",
            ].includes(key)
          )
            expect(actual, key).toBe(expected);
          else
            expect(Math.abs(Number(actual) - expected), key).toBeLessThan(
              0.000001,
            );
        } else expect(actual, key).toBe(expected);
      }
    });
});

describe("every visible chart series against independent pandas controls", () => {
  for (const f of visualFixtures)
    it(`${f.report} page ${f.page}: ${f.name}`, () => {
      const c = {
        ...context(f.report as ReportId, f.filters as Filters),
        pageFilters: pageFilters(f.report as ReportId, f.page),
      };
      const actual = charts(f.report as ReportId, c, f.page);
      expect(actual.map((v) => v.id).sort()).toEqual(
        Object.keys(f.expected).sort(),
      );
      for (const visual of actual) {
        const expected = f.expected[visual.id as keyof typeof f.expected] as {
          key: string | number;
          values: (number | null)[];
        }[];
        expect(
          visual.points.map((p) => p.key),
          visual.id,
        ).toEqual(expected.map((p) => p.key));
        visual.points.forEach((point, index) =>
          point.values.forEach((value, series) => {
            const target = expected[index].values[series];
            if (target === null)
              expect(value, `${visual.id}/${point.key}`).toBeNull();
            else
              expect(
                Math.abs(Number(value) - target),
                `${visual.id}/${point.key}`,
              ).toBeLessThan(0.000001);
          }),
        );
      }
    });
});

describe("report semantics and cohort boundaries", () => {
  it("uses average headcount for original turnover and matches the screenshot", () => {
    expect(inclusionMeasures(context("inclusion")).turnover).toBeCloseTo(
      (47 / 467) * 100,
      10,
    );
    expect(
      kpis("inclusion", context("inclusion"), 1)[3].value?.toFixed(1),
    ).toBe("10.1");
  });
  it("preserves missing charges instead of changing the average denominator", () => {
    const d = datasets.retention;
    expect(d.filter((r) => r.total === null)).toHaveLength(11);
    expect(mean(d, "total")).toBeCloseTo(2283.300440841865, 8);
    expect(
      retentionMeasures(context("retention", { tenure: [0] })).averageTotal,
    ).toBeNull();
  });
  it("uses the original inclusive tenure boundaries with accurate web labels", () => {
    for (const [tenure, label] of [
      [0, "0–12 months"],
      [12, "0–12 months"],
      [13, "13–24 months"],
      [24, "13–24 months"],
      [72, "61–72 months"],
    ])
      expect(
        datasets.retention
          .filter((r) => r.tenure === tenure)
          .every((r) => r.loyalty === label),
      ).toBe(true);
  });
  it("retains churned exploration and an unrestricted risk page", () => {
    expect(
      rows({
        ...context("retention"),
        pageFilters: pageFilters("retention", 1),
      }),
    ).toHaveLength(1869);
    expect(
      rows({
        ...context("retention"),
        pageFilters: pageFilters("retention", 2),
      }),
    ).toHaveLength(7043);
  });
  it("uses FY21 job level for promotions and FY19 leaver ratings", () => {
    const d = charts("inclusion", context("inclusion"), 1);
    const promotions = d.find((c) => c.id === "promotions")!;
    expect(promotions.field).toBe("level21");
    expect(
      promotions.points.find((p) => p.key === "5 - Senior Officer")?.values,
    ).toEqual([11, 7, (11 / 18) * 100]);
    const ratings = d.find((c) => c.id === "turnover-rating-0")!;
    expect(ratings.points.find((p) => p.key === "4 - Manager")?.values).toEqual(
      [2.6470588235294117, 2.5],
    );
  });
  it("keeps executive hires/promotions and current age cohorts distinct", () => {
    const d = charts("inclusion", context("inclusion"), 2);
    const total = (id: string) =>
      d
        .find((c) => c.id === id)!
        .points.reduce((n, p) => n + (p.values[0] ?? 0), 0);
    expect(total("executive20")).toBe(16);
    expect(total("executive-hires")).toBe(4);
    expect(total("executive-promotions")).toBe(2);
    const age = d.find((c) => c.id === "ages")!;
    expect(
      age.points.reduce(
        (n, p) => n + p.values.reduce<number>((a, b) => a + (b ?? 0), 0),
        0,
      ),
    ).toBe(datasets.inclusion.filter((r) => r.leaverFY === null).length);
  });
  it("CALCULATE replaces column filters and preserves other filters", () => {
    const c = context("calls", {
      answered: ["N"],
      topic: ["Technical Support"],
    });
    const agents = agentStatistics(c);
    expect(agents.reduce((n, r) => n + r.answered, 0)).toBe(
      datasets.calls.filter(
        (r) => r.topic === "Technical Support" && r.answered === "Y",
      ).length,
    );
    expect(rows(c).every((r) => r.answered === "N")).toBe(true);
  });
});

describe("coordinated interactions and links", () => {
  it("intersects slicers, unions multi-values, and applies inclusive dates", () => {
    const c = context("calls", {
      topic: ["Technical Support", "Contract related"],
      dateFrom: ["2021-01-01"],
      dateTo: ["2021-01-31"],
    });
    expect(rows(c).length).toBe(
      datasets.calls.filter(
        (r) =>
          ["Technical Support", "Contract related"].includes(String(r.topic)) &&
          String(r.date) <= "2021-01-31",
      ).length,
    );
    expect(
      rows(
        context("calls", { dateFrom: ["2021-03-31"], dateTo: ["2021-01-01"] }),
      ),
    ).toHaveLength(0);
  });
  it("filters targets while leaving the source categories selectable", () => {
    const c = context("calls");
    c.state.selections = [
      { source: "answered", field: "answered", values: ["Y"] },
    ];
    expect(rows(c)).toHaveLength(4054);
    expect(rows({ ...c, target: "answered", chart: true })).toHaveLength(5000);
    expect(
      charts("calls", c, 1)
        .find((v) => v.id === "monthly")!
        .points.reduce((n, p) => n + (p.values[1] ?? 0), 0),
    ).toBe(0);
  });
  it("highlight retains chart totals while filtering KPI context; off ignores selection", () => {
    const c = context("calls");
    c.state = {
      ...c.state,
      interaction: "highlight",
      selections: [{ source: "answered", field: "answered", values: ["Y"] }],
    };
    expect(rows({ ...c, chart: true, target: "monthly" })).toHaveLength(5000);
    expect(rows(c)).toHaveLength(4054);
    expect(
      rows({ ...c, state: { ...c.state, interaction: "ignore" } }),
    ).toHaveLength(5000);
  });
  it("supports multi-select and repeat-click deselection", () => {
    const first = toggleSelection([], "x", "topic", "A", false);
    expect(toggleSelection(first, "x", "topic", "A", false)).toEqual([]);
    const multi = toggleSelection(first, "x", "topic", "B", true);
    expect(multi[0].values).toEqual(["A", "B"]);
    expect(toggleSelection(multi, "x", "topic", "A", true)[0].values).toEqual([
      "B",
    ]);
  });
  it("round-trips share state, rejects malformed state, and isolates report state", () => {
    const s = { ...emptyState(), filters: { topic: ["Technical Support"] } };
    expect(readRoute(routeHash("calls", 1, s)).state).toEqual(s);
    expect(readRoute("#/inclusion/2?state=bad")).toEqual({
      report: "inclusion",
      page: 2,
    });
    expect(readRoute("#/missing/7")).toEqual({ report: "calls", page: 1 });
    const states = initialStates();
    states.calls.filters.topic = ["A"];
    expect(states.inclusion.filters).toEqual({});
  });
  it("all five pages produce finite values or explicit missing values", () => {
    for (const report of ["calls", "retention", "inclusion"] as ReportId[])
      for (const page of report === "calls" ? [1] : [1, 2])
        for (const filters of [{}, { id: ["missing"] }] as Filters[]) {
          const c = {
            ...context(report, filters),
            pageFilters: pageFilters(report, page),
          };
          for (const visual of charts(report, c, page))
            for (const point of visual.points)
              for (const value of point.values)
                expect(
                  value === null || Number.isFinite(value),
                  visual.id,
                ).toBe(true);
        }
  });
});
