import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, GaugeChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { colors, format } from "./reports";
import type { ChartModel, Scalar, Selection } from "./types";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  SVGRenderer,
]);
type Props = {
  model: ChartModel;
  highlighted?: ChartModel;
  selections: Selection[];
  onSelect: (
    source: string,
    field: string,
    key: Scalar,
    multi?: boolean,
  ) => void;
  multi: boolean;
  evidenceRef?: (target: HTMLElement | null) => void;
};

function option(
  model: ChartModel,
  highlighted: ChartModel | undefined,
  selected: Scalar[],
  chartWidth: number,
) {
  const palette = model.series.map(
    (s, i) => s.color || colors[i % colors.length],
  );
  const common = {
    animationDuration: 180,
    animationDurationUpdate: 180,
    textStyle: { fontFamily: "Source Sans 3, sans-serif", color: "#52667a" },
    color: palette,
    aria: { enabled: false },
    tooltip: { trigger: "axis", confine: true },
    legend: {
      bottom: 0,
      type: "scroll",
      textStyle: { fontSize: 12 },
      selectedMode: false,
    },
  };
  if (model.kind === "gauge")
    return {
      ...common,
      tooltip: { show: false },
      series: [
        {
          type: "gauge",
          startAngle: 200,
          endAngle: -20,
          min: model.min ?? 0,
          max: model.max ?? 100,
          center: ["50%", "65%"],
          radius: "94%",
          progress: { show: true, width: 12 },
          axisLine: { lineStyle: { width: 12, color: [[1, "#e5edf2"]] } },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          title: { offsetCenter: [0, "18%"], fontSize: 13, color: "#65798c" },
          detail: {
            valueAnimation: true,
            offsetCenter: [0, "-12%"],
            fontSize: 34,
            fontWeight: 600,
            color: "#102b46",
            formatter: () =>
              format(model.points[0]?.values[0] ?? null, model.format),
          },
          data: [
            {
              value: model.points[0]?.values[0] ?? 0,
              name: `${format(model.min ?? 0)} – ${format(model.max ?? 100)}`,
            },
          ],
        },
      ],
    };
  if (model.kind === "donut") {
    const pie = {
      type: "pie",
      name: "Report context",
      radius: ["49%", "71%"],
      center: ["50%", "43%"],
      label: { show: false },
      emphasis: { label: { show: true, formatter: "{b}\n{d}%", fontSize: 14 } },
      itemStyle: { borderRadius: 3, borderColor: "#fff", borderWidth: 3 },
      data: model.points.map((p) => ({
        name: p.label,
        value: p.values[0] ?? 0,
        itemStyle: {
          opacity: selected.length && !selected.includes(p.key) ? 0.25 : 1,
        },
      })),
    };
    return {
      ...common,
      color: colors,
      tooltip: {
        trigger: "item",
        confine: true,
        valueFormatter: (v: number) => format(v),
      },
      series: [
        pie,
        ...(highlighted
          ? [
              {
                ...pie,
                name: "Selection",
                radius: ["27%", "44%"],
                data: model.points.map((p) => ({
                  name: p.label,
                  value:
                    highlighted.points.find((h) => h.key === p.key)
                      ?.values[0] ?? 0,
                  itemStyle: { opacity: 1 },
                })),
              },
            ]
          : []),
      ],
    };
  }
  const left = model.horizontal ? 143 : 42;
  const right = model.kind === "combo" ? 55 : 22;
  const categoryWidth = Math.max(
    1,
    Math.floor((chartWidth - left - right) / Math.max(model.points.length, 1)) - 6,
  );
  const labelWidth = Math.min(90, categoryWidth);
  const category = {
    type: "category",
    data: model.points.map((p) => p.label),
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: "#52667a",
      fontSize: 12,
      lineHeight: model.horizontal ? undefined : 18,
      width: model.horizontal ? 125 : labelWidth,
      overflow: "break",
      interval: 0,
      hideOverlap: !model.horizontal,
    },
    inverse: model.horizontal || undefined,
  };
  const axis = (secondary = false) => ({
    type: "value",
    min: 0,
    axisLabel: {
      color: "#62768a",
      fontSize: 11,
      formatter: (v: number) => {
        const style = model.axisFormats?.[secondary ? 1 : 0] ?? model.format;
        if (style === "percent") return `${v}%`;
        const compact =
          Math.abs(v) >= 1000000
            ? `${+(v / 1000000).toFixed(1)}M`
            : Math.abs(v) >= 1000
              ? `${+(v / 1000).toFixed(1)}k`
              : `${v}`;
        return style === "currency" ? `$${compact}` : compact;
      },
    },
    splitLine: { show: !secondary, lineStyle: { color: "#edf2f6" } },
  });
  const series = model.series.map((s, i) => ({
    name: s.name,
    type: s.type ?? (model.kind === "line" ? "line" : "bar"),
    yAxisIndex: s.axis ?? 0,
    stack: model.stacked ? "total" : undefined,
    barMaxWidth: 34,
    connectNulls: false,
    symbolSize: 6,
    lineStyle: { width: 2.5 },
    itemStyle: { color: palette[i], borderRadius: 2 },
    data: model.points.map((p) => ({
      value: p.values[i],
      itemStyle: {
        opacity:
          highlighted || (selected.length && !selected.includes(p.key))
            ? 0.24
            : 1,
      },
    })),
  }));
  if (highlighted)
    model.series.forEach((s, i) =>
      series.push({
        ...series[i],
        name: s.name,
        stack: undefined,
        barGap: "-100%",
        data: model.points.map((p) => ({
          value:
            highlighted.points.find((h) => h.key === p.key)?.values[i] ?? null,
          itemStyle: { opacity: 1 },
        })),
      } as (typeof series)[number]),
    );
  return {
    ...common,
    grid: {
      left,
      right,
      top: 15,
      bottom:
        model.points.some((p) => p.label.length > 16) && !model.horizontal
          ? 90
          : 63,
    },
    xAxis: model.horizontal ? axis() : category,
    yAxis: model.horizontal
      ? category
      : model.kind === "combo"
        ? [axis(), axis(true)]
        : axis(),
    series,
  };
}

export default function Chart({
  model,
  highlighted,
  selections,
  onSelect,
  multi,
  evidenceRef,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const current = useRef({ model, onSelect, multi });
  current.current = { model, onSelect, multi };
  const selected = selections.find((s) => s.source === model.id)?.values ?? [];
  useEffect(() => {
    if (!host.current) return;
    const chart = echarts.init(host.current, undefined, { renderer: "svg" });
    instance.current = chart;
    chart.on("click", (params: unknown) => {
      const p = params as {
        dataIndex?: number;
        event?: { event?: MouseEvent };
      };
      const { model: m, onSelect: select, multi: multiple } = current.current;
      if (m.field && p.dataIndex !== undefined && m.points[p.dataIndex])
        select(
          m.id,
          m.field,
          m.points[p.dataIndex].key,
          multiple || p.event?.event?.ctrlKey || p.event?.event?.metaKey,
        );
    });
    const resize = new ResizeObserver(() => {
      chart.resize();
      setChartWidth(chart.getWidth());
    });
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      chart.dispose();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const chart = instance.current;
    if (!chart) return;
    chart.setOption(
      {
        ...option(model, highlighted, selected, chartWidth || chart.getWidth()),
        animation: !reduced,
      },
      true,
    );
  }, [model, highlighted, selections, chartWidth]);
  const empty = model.points.every((p) =>
    p.values.every((v) => v === null || v === 0),
  );
  const formatSeriesValue = (value: number | null, index: number) =>
    format(value, model.axisFormats?.[model.series[index]?.axis ?? 0] ?? model.format);
  return (
    <section
      className={`visual ${model.wide ? "visual-wide" : ""}`}
      aria-labelledby={`title-${model.id}`}
      data-visual={model.id}
      tabIndex={evidenceRef ? -1 : undefined}
      ref={evidenceRef}
    >
      <div className="visual-heading">
        <div>
          <h2 id={`title-${model.id}`}>{model.title}</h2>
          {model.subtitle && <p>{model.subtitle}</p>}
        </div>
        {selected.length > 0 && (
          <span className="selection-indicator">Selected</span>
        )}
      </div>
      <div
        className={`chart ${model.kind === "gauge" ? "chart-gauge" : ""}`}
        ref={host}
        role="img"
        aria-label={`${model.title}. ${model.points.map((p) => `${p.label}: ${p.values.map((v, i) => `${model.series[i]?.name} ${formatSeriesValue(v, i)}`).join(", ")}`).join("; ")}. Data and keyboard selection available below.`}
      />
      {empty && (
        <p className="empty-chart">
          No values in this context. Clear a selection to broaden the view.
        </p>
      )}
      {highlighted && model.kind === "donut" && (
        <p className="chart-note">
          Outer ring: report context. Inner ring: selection.
        </p>
      )}
      {model.note && <p className="chart-note">{model.note}</p>}
      <details className="chart-data">
        <summary>View data{model.field ? " & select" : ""}</summary>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">{model.title}</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                {model.series.map((s) => (
                  <th scope="col" key={s.name}>
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.points.map((p) => (
                <tr key={String(p.key)}>
                  <th scope="row">
                    {model.field ? (
                      <button
                        className="table-select"
                        aria-pressed={selected.includes(p.key)}
                        onClick={(e) =>
                          onSelect(
                            model.id,
                            model.field!,
                            p.key,
                            multi || e.ctrlKey || e.metaKey,
                          )
                        }
                      >
                        {p.label}
                      </button>
                    ) : (
                      p.label
                    )}
                  </th>
                  {p.values.map((v, i) => (
                    <td key={i}>{formatSeriesValue(v, i)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
