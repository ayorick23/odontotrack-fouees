import { useState, type ReactNode } from "react";
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

import { useTheme } from "../../hooks/useTheme";
import {
  countByStatus,
  type CaseStatus,
  type DashboardAreaStatus,
  type DashboardMonthPoint,
  type DashboardSeries,
  type DashboardSummary,
} from "../../services/dashboard";

// Colores de la marca, los mismos del diseño original del dashboard.
const COLORS = {
  violet: "#8b5cf6",
  teal: "#2ad4c5",
  gray: "#94a3b8",
} as const;

type ColorName = keyof typeof COLORS;

const THEME = {
  light: {
    grid: "#eef2f7",
    hover: "#f8fafc",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e2e8f0",
  },
  dark: {
    grid: "#1e293b",
    hover: "#1e293b",
    tooltipBg: "#0f172a",
    tooltipBorder: "#334155",
  },
} as const;

type Theme = (typeof THEME)[keyof typeof THEME];

const AXIS_COLOR = "#94a3b8";

// Ingresos va en violeta como los pendientes (así llega todo paciente) y
// asignaciones en turquesa como los asignados.
const AREA_SERIES: ReadonlyArray<{
  key: "patients" | "assignments";
  label: string;
  color: ColorName;
}> = [
  { key: "patients", label: "Ingresos", color: "violet" },
  { key: "assignments", label: "Asignaciones", color: "teal" },
];

const STATUS_SLICES: ReadonlyArray<{
  status: CaseStatus;
  label: string;
  legend: string;
  color: ColorName;
}> = [
  { status: "pendiente", label: "Pendientes", legend: "Pendiente de asignación", color: "violet" },
  { status: "en_proceso", label: "Asignados", legend: "Asignado", color: "teal" },
  { status: "finalizado", label: "Finalizados", legend: "Finalizado", color: "gray" },
];

export function DashboardCharts({
  series,
  summary,
}: {
  series: DashboardSeries | null;
  summary: DashboardSummary;
}) {
  const { theme } = useTheme();
  const colors = theme === "dark" ? THEME.dark : THEME.light;

  return (
    // Dos mitades como en el diseño original; la dona va abajo a todo el ancho.
    <section className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Ingresos y asignaciones por mes">
        {series ? (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <MonthlyFlowChart months={series.months} colors={colors} />
            </div>
            <ChartLegend items={AREA_SERIES} />
          </div>
        ) : (
          <ChartPlaceholder />
        )}
      </ChartCard>

      <ChartCard title="Pacientes por área clínica">
        {series ? (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <AreaStatusChart rows={series.by_area} colors={colors} />
            </div>
            <ChartLegend items={STATUS_SLICES} />
          </div>
        ) : (
          <ChartPlaceholder />
        )}
      </ChartCard>

      <ChartCard title="Estado de los pacientes" className="xl:col-span-2" height="auto">
        <StatusDonut summary={summary} colors={colors} />
      </ChartCard>
    </section>
  );
}

function MonthlyFlowChart({
  months,
  colors,
}: {
  months: DashboardMonthPoint[];
  colors: Theme;
}) {
  const monthCount = months.length;

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        {/* Margen derecho para que la última etiqueta del eje no se corte. */}
        <AreaChart data={months} margin={{ top: 8, right: 20, left: -18, bottom: 0 }}>
          <defs>
            {AREA_SERIES.map((item) => (
              <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS[item.color]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS[item.color]} stopOpacity={0.04} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            stroke={AXIS_COLOR}
            tickLine={false}
            axisLine={false}
            interval={monthCount > 8 ? 1 : 0}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          />
          <YAxis
            allowDecimals={false}
            stroke={AXIS_COLOR}
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          />
          <Tooltip contentStyle={tooltipStyle(colors)} />
          {AREA_SERIES.map((item) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={COLORS[item.color]}
              fill={`url(#fill-${item.key})`}
              strokeWidth={2.5}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>Ingresos y asignaciones por mes</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            <th scope="col">Ingresos</th>
            <th scope="col">Asignaciones</th>
          </tr>
        </thead>
        <tbody>
          {months.map((row) => (
            <tr key={row.month}>
              <th scope="row">{row.label}</th>
              <td>{row.patients}</td>
              <td>{row.assignments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function AreaStatusChart({
  rows,
  colors,
}: {
  rows: DashboardAreaStatus[];
  colors: Theme;
}) {
  const [chartWidth, setChartWidth] = useState(0);
  // Ancho de cada área (el eje Y y los márgenes ocupan ~52px).
  const slot = rows.length > 0 ? (chartWidth - 52) / rows.length : 0;
  const longestWord = Math.max(
    0,
    ...rows.flatMap((row) => row.area.split(" ").map((word) => word.length)),
  );
  // ~6px por letra a 11px. Si la palabra más larga no cabe en su columna,
  // las etiquetas se inclinan para no encimarse; si cabe, van rectas y los
  // nombres de varias palabras pasan a dos líneas.
  const tilted = slot > 0 && longestWord * 6 > slot - 8;

  return (
    <>
      <ResponsiveContainer
        width="100%"
        height="100%"
        onResize={(width) => setChartWidth(width)}
      >
        <BarChart
          data={rows}
          barCategoryGap="28%"
          barGap={2}
          // Inclinada, la primera etiqueta sobresale a la izquierda: más margen.
          margin={{ top: 8, right: 8, left: tilted ? 24 : -18, bottom: 0 }}
        >
          <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="area"
            interval={0}
            height={tilted ? 64 : 36}
            angle={tilted ? -30 : 0}
            textAnchor={tilted ? "end" : "middle"}
            stroke={AXIS_COLOR}
            tickLine={false}
            axisLine={false}
            tick={{
              fill: AXIS_COLOR,
              fontSize: 11,
              width: tilted ? undefined : Math.max(slot - 8, 40),
            }}
          />
          <YAxis
            allowDecimals={false}
            stroke={AXIS_COLOR}
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
          />
          <Tooltip cursor={{ fill: colors.hover }} contentStyle={tooltipStyle(colors)} />
          {STATUS_SLICES.map((slice) => (
            <Bar
              key={slice.status}
              dataKey={slice.status}
              name={slice.label}
              fill={COLORS[slice.color]}
              radius={[4, 4, 0, 0]}
              maxBarSize={6}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>Pacientes por área clínica</caption>
        <thead>
          <tr>
            <th scope="col">Área</th>
            {STATUS_SLICES.map((slice) => (
              <th key={slice.status} scope="col">
                {slice.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.area}>
              <th scope="row">{row.area}</th>
              {STATUS_SLICES.map((slice) => (
                <td key={slice.status}>{row[slice.status]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/**
 * Dona de estados: tamaño fijo, no crece con los datos. A su lado van la
 * cantidad y el porcentaje de cada estado (en pantallas chicas, debajo).
 */
function StatusDonut({ summary, colors }: { summary: DashboardSummary; colors: Theme }) {
  const slices = STATUS_SLICES.map((slice) => ({
    ...slice,
    count: countByStatus(summary, slice.status),
  }));
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-slate-400">
        Sin pacientes en este período
      </p>
    );
  }
  const visible = slices.filter((slice) => slice.count > 0);

  return (
    <div className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-12">
      <div className="size-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="count"
              nameKey="legend"
              innerRadius={52}
              outerRadius={74}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {visible.map((slice) => (
                <Cell key={slice.status} fill={COLORS[slice.color]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle(colors)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul
        className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3"
        aria-label="Pacientes por estado"
      >
        {slices.map((slice) => (
          <li
            key={slice.status}
            className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60"
          >
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[slice.color] }}
              />
              {slice.legend}
            </span>
            <span className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
                {slice.count.toLocaleString("es-SV")}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {Math.round((slice.count / total) * 100)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function tooltipStyle(colors: Theme) {
  return {
    backgroundColor: colors.tooltipBg,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: 12,
    color: AXIS_COLOR,
    fontSize: 12,
  };
}

function ChartLegend({
  items,
}: {
  items: ReadonlyArray<{ label: string; color: ColorName }>;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: COLORS[item.color] }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function ChartCard({
  title,
  children,
  className = "",
  height = "fixed",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  /** "fixed" = alto de gráfica (h-72); "auto" = crece con el contenido. */
  height?: "fixed" | "auto";
}) {
  return (
    <article
      className={`rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 ${className}`}
    >
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      <div className={`mt-3 ${height === "fixed" ? "h-72" : ""}`}>{children}</div>
    </article>
  );
}

function ChartPlaceholder() {
  return <div className="h-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
}
