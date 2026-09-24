import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTheme } from "../../hooks/useTheme";
import type { DashboardMonthPoint, DashboardSeries } from "../../services/dashboard";

// Paleta validada (dataviz/validate_palette.js) contra las superficies del
// dashboard: blanco en claro y slate-900 en oscuro. La serie 1 va siempre
// en turquesa y la 2 en violeta.
const TOKENS = {
  light: {
    surface: "#ffffff",
    grid: "#eef2f7",
    axis: "#64748b",
    text: "#334155",
    hover: "#f8fafc",
    tooltipBorder: "#e2e8f0",
    series1: "#0d9488",
    series2: "#7c3aed",
  },
  dark: {
    surface: "#0f172a",
    grid: "#1e293b",
    axis: "#94a3b8",
    text: "#e2e8f0",
    hover: "#1e293b",
    tooltipBorder: "#334155",
    series1: "#0d9488",
    series2: "#8b5cf6",
  },
} as const;

type Tokens = (typeof TOKENS)[keyof typeof TOKENS];

export function DashboardCharts({ series }: { series: DashboardSeries | null }) {
  const { theme } = useTheme();
  const tokens = theme === "dark" ? TOKENS.dark : TOKENS.light;

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        title="Ingresos y asignaciones por mes"
        description="Pacientes registrados frente a pacientes asignados a un estudiante."
        className="xl:col-span-2"
      >
        {series ? (
          <MonthlyFlowChart months={series.months} tokens={tokens} />
        ) : (
          <ChartPlaceholder />
        )}
      </ChartCard>

      <ChartCard
        title="Pendientes por área clínica"
        description="Pacientes registrados en el período que siguen sin asignar."
      >
        {series ? (
          <HorizontalBars
            caption="Pendientes por área clínica"
            rows={series.pending_by_area.map((row) => ({
              name: row.area,
              value: row.count,
            }))}
            valueLabel="Pendientes"
            emptyMessage="No hay pacientes pendientes en este período."
            tokens={tokens}
          />
        ) : (
          <ChartPlaceholder />
        )}
      </ChartCard>

      <ChartCard
        title="Carga por estudiante"
        description="Casos activos hoy, los 10 con más carga. No depende del período."
      >
        {series ? (
          <HorizontalBars
            caption="Carga por estudiante"
            rows={series.student_load.map((row) => ({
              name: row.student,
              value: row.active_cases,
            }))}
            valueLabel="Casos activos"
            emptyMessage="Ningún estudiante tiene casos activos."
            tokens={tokens}
          />
        ) : (
          <ChartPlaceholder />
        )}
      </ChartCard>
    </section>
  );
}

const LINE_SERIES = [
  { key: "patients", label: "Ingresos", color: "series1" },
  { key: "assignments", label: "Asignaciones", color: "series2" },
] as const;

type PointProps = { cx?: number; cy?: number; index?: number };
type LabelProps = { x?: number | string; y?: number | string; index?: number };

function MonthlyFlowChart({
  months,
  tokens,
}: {
  months: DashboardMonthPoint[];
  tokens: Tokens;
}) {
  const last = months.length - 1;
  const lastPoint = months[last];
  // Etiqueta al final de cada línea: la de mayor valor va arriba y la otra
  // abajo, así no se pisan aunque terminen en el mismo punto.
  const patientsOnTop = lastPoint ? lastPoint.patients >= lastPoint.assignments : true;
  const labelOffset = {
    patients: patientsOnTop ? -8 : 14,
    assignments: patientsOnTop ? 14 : -8,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={months} margin={{ top: 12, right: 96, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={tokens.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: tokens.grid }}
              interval="preserveStartEnd"
              minTickGap={16}
              tick={{ fill: tokens.axis, fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: tokens.axis, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ stroke: tokens.axis, strokeWidth: 1 }}
              contentStyle={tooltipStyle(tokens)}
              labelStyle={{ color: tokens.text, fontWeight: 600 }}
            />
            {LINE_SERIES.map((item) => (
              <Line
                key={item.key}
                type="linear"
                dataKey={item.key}
                name={item.label}
                stroke={tokens[item.color]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                isAnimationActive={false}
                activeDot={{ r: 4, stroke: tokens.surface, strokeWidth: 2 }}
                dot={(props: PointProps) =>
                  props.index === last && props.cx !== undefined && props.cy !== undefined ? (
                    <circle
                      key={`${item.key}-end`}
                      cx={props.cx}
                      cy={props.cy}
                      r={4}
                      fill={tokens[item.color]}
                      stroke={tokens.surface}
                      strokeWidth={2}
                    />
                  ) : (
                    <g key={`${item.key}-dot-${props.index}`} />
                  )
                }
                label={(props: LabelProps) =>
                  props.index === last ? (
                    <text
                      key={`${item.key}-label`}
                      x={Number(props.x) + 10}
                      y={Number(props.y) + labelOffset[item.key]}
                      fill={tokens.text}
                      fontSize={11}
                      fontWeight={600}
                    >
                      {item.label}
                    </text>
                  ) : (
                    <g key={`${item.key}-label-${props.index}`} />
                  )
                }
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={LINE_SERIES.map((item) => ({ label: item.label, color: tokens[item.color] }))}
      />
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
    </div>
  );
}

type BarRow = { name: string; value: number };

function HorizontalBars({
  caption,
  rows,
  valueLabel,
  emptyMessage,
  tokens,
}: {
  caption: string;
  rows: BarRow[];
  valueLabel: string;
  emptyMessage: string;
  tokens: Tokens;
}) {
  if (rows.length === 0) {
    return (
      <p className="flex h-full items-center justify-center text-sm text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          barCategoryGap="30%"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke={tokens.grid} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: tokens.axis, fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tickLine={false}
            axisLine={{ stroke: tokens.grid }}
            tick={{ fill: tokens.text, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: tokens.hover }}
            contentStyle={tooltipStyle(tokens)}
            labelStyle={{ color: tokens.text, fontWeight: 600 }}
          />
          <Bar
            dataKey="value"
            name={valueLabel}
            fill={tokens.series1}
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Nombre</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function tooltipStyle(tokens: Tokens) {
  return {
    backgroundColor: tokens.surface,
    border: `1px solid ${tokens.tooltipBorder}`,
    borderRadius: 12,
    color: tokens.text,
    fontSize: 12,
  };
}

function ChartLegend({
  items,
}: {
  items: ReadonlyArray<{ label: string; color: string }>;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"
        >
          <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function ChartCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 ${className}`}
    >
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      <div className="mt-4 h-72">{children}</div>
    </article>
  );
}

function ChartPlaceholder() {
  return <div className="h-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
}
