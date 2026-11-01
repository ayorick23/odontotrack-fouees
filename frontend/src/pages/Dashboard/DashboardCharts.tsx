import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardSeries, SummaryPeriod } from "../../services/dashboard";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_ORDER,
  SINGLE_SERIES_COLOR,
  useChartTheme,
} from "./chartColors";

export type PeriodFilter = SummaryPeriod | "todos";

const PERIOD_FILTERS: Array<{ value: PeriodFilter; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "1a", label: "1A" },
];

export function DashboardCharts({
  series,
  period,
  onPeriodChange,
}: {
  series: DashboardSeries | null;
  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
}) {
  const { axis, grid, surface, cursor, status, tooltipStyle } = useChartTheme();
  const legend = CASE_STATUS_ORDER.map((key) => ({
    label: CASE_STATUS_LABELS[key],
    color: status[key],
  }));
  const slices = (series?.by_status ?? [])
    .filter((row) => row.count > 0)
    .map((row) => ({
      ...row,
      label: CASE_STATUS_LABELS[row.status],
    }));
  const statusTotal = (series?.by_status ?? []).reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const monthCount = series?.months.length ?? 0;

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        title="Pacientes registrados por mes"
        action={
          <PeriodFilters period={period} onPeriodChange={onPeriodChange} />
        }
      >
        {series ? (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={series.months}
                  barCategoryGap="28%"
                  barGap={2}
                  margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                >
                  <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke={axis}
                    tickLine={false}
                    axisLine={false}
                    interval={monthCount > 8 ? 1 : 0}
                    tick={{ fill: axis, fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke={axis}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: axis, fontSize: 11 }}
                  />
                  <Tooltip
                    cursor={{ fill: cursor }}
                    contentStyle={tooltipStyle}
                    labelFormatter={(label, payload) => {
                      const total = payload.reduce(
                        (sum, item) => sum + Number(item.value ?? 0),
                        0,
                      );
                      return `${label} · ${total} registrados`;
                    }}
                  />
                  {/* Apiladas: la altura total es lo registrado ese mes. */}
                  {CASE_STATUS_ORDER.map((key, index) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={CASE_STATUS_LABELS[key]}
                      stackId="estado"
                      fill={status[key]}
                      stroke={surface}
                      strokeWidth={1}
                      radius={
                        index === CASE_STATUS_ORDER.length - 1 ? [4, 4, 0, 0] : 0
                      }
                      maxBarSize={18}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend items={legend} />
          </div>
        ) : (
          <ChartPlaceholder />
        )}
      </ChartCard>

      <ChartCard title="Asignaciones por mes">
        {series ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={series.months}
              margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient id="citasFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SINGLE_SERIES_COLOR} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={SINGLE_SERIES_COLOR} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                stroke={axis}
                tickLine={false}
                axisLine={false}
                interval={monthCount > 8 ? 1 : 0}
                tick={{ fill: axis, fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                stroke={axis}
                tickLine={false}
                axisLine={false}
                tick={{ fill: axis, fontSize: 11 }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="assignments"
                name="Asignaciones"
                stroke={SINGLE_SERIES_COLOR}
                fill="url(#citasFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ChartPlaceholder />
        )}
      </ChartCard>

      <ChartCard title="Estado actual de pacientes" className="xl:max-w-md">
        {series && statusTotal > 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={74}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.status} fill={status[slice.status]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
              {series.by_status.map((row) => (
                <li
                  key={row.status}
                  className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: status[row.status] }}
                  />
                  {CASE_STATUS_LABELS[row.status]} · {row.count}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-slate-400">
            Sin pacientes en este período
          </p>
        )}
      </ChartCard>
    </section>
  );
}

function PeriodFilters({
  period,
  onPeriodChange,
}: {
  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
}) {
  return (
    <div className="flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
      {PERIOD_FILTERS.map((filter) => {
        const selected = period === filter.value;
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onPeriodChange(filter.value)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              selected
                ? "bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

export function ChartLegend({
  items,
}: {
  items: ReadonlyArray<{ label: string; color: string }>;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartCard({
  title,
  action,
  children,
  className = "",
  bodyClassName = "h-72",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Alto del área de la gráfica (clase de Tailwind). */
  bodyClassName?: string;
}) {
  return (
    <article
      className={`rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
        {action}
      </div>
      <div className={`mt-3 ${bodyClassName}`}>{children}</div>
    </article>
  );
}

function ChartPlaceholder() {
  return <div className="h-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
}
