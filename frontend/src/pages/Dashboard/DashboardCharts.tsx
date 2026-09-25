import type { ReactNode } from "react";
import {
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
    tooltipBorder: "#e2e8f0",
    series1: "#0d9488",
    series2: "#7c3aed",
  },
  dark: {
    surface: "#0f172a",
    grid: "#1e293b",
    axis: "#94a3b8",
    text: "#e2e8f0",
    tooltipBorder: "#334155",
    series1: "#0d9488",
    series2: "#8b5cf6",
  },
} as const;

type Tokens = (typeof TOKENS)[keyof typeof TOKENS];

const LINE_SERIES = [
  { key: "patients", label: "Ingresos", color: "series1" },
  { key: "assignments", label: "Asignaciones", color: "series2" },
] as const;

export function DashboardCharts({ series }: { series: DashboardSeries | null }) {
  const { theme } = useTheme();
  const tokens = theme === "dark" ? TOKENS.dark : TOKENS.light;

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <ChartCard
        title="Ingresos y asignaciones por mes"
        description="Pacientes registrados frente a pacientes asignados a un estudiante."
        action={
          series ? (
            <SeriesTotals
              items={LINE_SERIES.map((item) => ({
                label: item.label,
                color: tokens[item.color],
                total: series.months.reduce((sum, month) => sum + month[item.key], 0),
              }))}
            />
          ) : null
        }
        className="xl:col-span-2"
      >
        <div className="min-h-72 flex-1">
          {series ? (
            <MonthlyFlowChart months={series.months} tokens={tokens} />
          ) : (
            <ChartPlaceholder />
          )}
        </div>
      </ChartCard>

      <div className="grid content-start gap-4">
        <ChartCard
          title="Pendientes por área clínica"
          description="Registrados en el período que siguen sin asignar."
        >
          {series ? (
            <BarList
              caption="Pendientes por área clínica"
              rows={series.pending_by_area.map((row) => ({
                name: row.area,
                value: row.count,
              }))}
              valueLabel="Pendientes"
              emptyMessage="No hay pacientes pendientes en este período."
              color={tokens.series1}
            />
          ) : (
            <ChartPlaceholder className="h-40" />
          )}
        </ChartCard>

        <ChartCard
          title="Carga por estudiante"
          description="Casos activos hoy, los 10 con más carga. No depende del período."
        >
          {series ? (
            <BarList
              caption="Carga por estudiante"
              rows={series.student_load.map((row) => ({
                name: row.student,
                value: row.active_cases,
              }))}
              valueLabel="Casos activos"
              emptyMessage="Ningún estudiante tiene casos activos."
              color={tokens.series1}
            />
          ) : (
            <ChartPlaceholder className="h-32" />
          )}
        </ChartCard>
      </div>
    </section>
  );
}

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
    <>
      <ResponsiveContainer width="100%" height="100%" minHeight={288}>
        <LineChart data={months} margin={{ top: 12, right: 88, left: -16, bottom: 0 }}>
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
            contentStyle={{
              backgroundColor: tokens.surface,
              border: `1px solid ${tokens.tooltipBorder}`,
              borderRadius: 12,
              color: tokens.text,
              fontSize: 12,
            }}
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

type BarRow = { name: string; value: number };

/**
 * Lista de barras horizontales: nombre, barra y valor en cada fila. Crece
 * con los datos (3 filas ocupan 3 filas) y el valor se lee sin tooltip.
 */
function BarList({
  caption,
  rows,
  valueLabel,
  emptyMessage,
  color,
}: {
  caption: string;
  rows: BarRow[];
  valueLabel: string;
  emptyMessage: string;
  color: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">{emptyMessage}</p>;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <table className="w-full table-fixed text-sm">
      <caption className="sr-only">{caption}</caption>
      <colgroup>
        <col className="w-2/5" />
        <col />
      </colgroup>
      <thead className="sr-only">
        <tr>
          <th scope="col">Nombre</th>
          <th scope="col">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <th
              scope="row"
              title={row.name}
              className="truncate py-1.5 pr-3 text-left text-xs font-normal text-slate-600 dark:text-slate-300"
            >
              {row.name}
            </th>
            <td className="py-1.5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div
                    aria-hidden="true"
                    className="h-2.5 rounded-r-[4px]"
                    style={{
                      width: `${(row.value / max) * 100}%`,
                      minWidth: 2,
                      backgroundColor: color,
                    }}
                  />
                </div>
                <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {row.value}
                </span>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SeriesTotals({
  items,
}: {
  items: ReadonlyArray<{ label: string; color: string; total: number }>;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-label="Totales del período">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {item.total.toLocaleString("es-SV")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ChartCard({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`flex flex-col rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-4 flex flex-1 flex-col">{children}</div>
    </article>
  );
}

function ChartPlaceholder({ className = "h-full" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800 ${className}`} />
  );
}
