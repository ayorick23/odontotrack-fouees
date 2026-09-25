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
  // Las áreas sin pacientes se ocultan para no dejar huecos en el eje.
  const areaRows = (series?.by_area ?? []).filter((row) =>
    STATUS_SLICES.some((slice) => row[slice.status] > 0),
  );

  return (
    // 6 columnas: arriba dos mitades como en el diseño original y abajo la
    // dona en una tarjeta de 1/3.
    <section className="grid gap-4 xl:grid-cols-6">
      <ChartCard title="Ingresos y asignaciones por mes" className="xl:col-span-3">
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

      <ChartCard title="Pacientes por área clínica" className="xl:col-span-3">
        {series === null ? (
          <ChartPlaceholder />
        ) : areaRows.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-slate-400">
            Sin pacientes en este período
          </p>
        ) : (
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <AreaStatusChart rows={areaRows} colors={colors} />
            </div>
            <ChartLegend items={STATUS_SLICES} />
          </div>
        )}
      </ChartCard>

      <ChartCard title="Estado de los pacientes" className="xl:col-span-2">
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
                <stop offset="0%" stopColor={COLORS[item.color]} stopOpacity={0.15} />
                <stop offset="100%" stopColor={COLORS[item.color]} stopOpacity={0.02} />
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
 * Dona de estados: tamaño fijo, no crece con los datos. Debajo, la cantidad
 * y el porcentaje de cada estado.
 */
function StatusDonut({ summary, colors }: { summary: DashboardSummary; colors: Theme }) {
  const slices = STATUS_SLICES.map((slice) => ({
    ...slice,
    count: countByStatus(summary, slice.status),
  }));
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-slate-400">
        Sin pacientes en este período
      </p>
    );
  }
  const visible = slices.filter((slice) => slice.count > 0);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="count"
              nameKey="legend"
              innerRadius={46}
              outerRadius={66}
              paddingAngle={2}
              stroke="none"
            >
              {visible.map((slice) => (
                <Cell key={slice.status} fill={COLORS[slice.color]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle(colors)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full max-w-xs space-y-1.5" aria-label="Pacientes por estado">
        {slices.map((slice) => (
          <li
            key={slice.status}
            className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[slice.color] }}
            />
            <span className="flex-1">{slice.legend}</span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {slice.count.toLocaleString("es-SV")}
            </span>
            <span className="w-8 text-right">
              {Math.round((slice.count / total) * 100)}%
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
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/15 ${className}`}
    >
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      <div className="mt-3 h-72">{children}</div>
    </article>
  );
}

function ChartPlaceholder() {
  return <div className="h-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
}
