import type { ReactNode } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
  type DashboardMonthPoint,
  type DashboardSeries,
  type DashboardSummary,
} from "../../services/dashboard";

// Paleta validada (dataviz/validate_palette.js, todos los pares) contra las
// superficies del dashboard: blanco en claro y slate-900 en oscuro. Cada
// slot mantiene su color en todas las gráficas.
const TOKENS = {
  light: {
    surface: "#ffffff",
    grid: "#eef2f7",
    axis: "#64748b",
    text: "#334155",
    tooltipBorder: "#e2e8f0",
    series1: "#0d9488",
    series2: "#7c3aed",
    series3: "#d97706",
  },
  dark: {
    surface: "#0f172a",
    grid: "#1e293b",
    axis: "#94a3b8",
    text: "#e2e8f0",
    tooltipBorder: "#334155",
    series1: "#0d9488",
    series2: "#8b5cf6",
    series3: "#d97706",
  },
} as const;

type Tokens = (typeof TOKENS)[keyof typeof TOKENS];

const LINE_SERIES = [
  { key: "patients", label: "Ingresos", color: "series1" },
  { key: "assignments", label: "Asignaciones", color: "series2" },
] as const;

// Pendiente comparte color con "Ingresos" (así llega todo paciente) y en
// proceso con "Asignaciones" (lo que pasa al asignar).
const STATUS_SLICES: ReadonlyArray<{
  status: CaseStatus;
  label: string;
  color: "series1" | "series2" | "series3";
}> = [
  { status: "pendiente", label: "Pendientes", color: "series1" },
  { status: "en_proceso", label: "En proceso", color: "series2" },
  { status: "finalizado", label: "Finalizados", color: "series3" },
];

export function DashboardCharts({
  series,
  summary,
}: {
  series: DashboardSeries | null;
  summary: DashboardSummary;
}) {
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

      <ChartCard
        title="Estado de los pacientes"
        description="Registrados en el período, según su estado actual."
      >
        <StatusDonut summary={summary} tokens={tokens} />
      </ChartCard>
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

/**
 * Dona de estados: tamaño fijo, no crece con los datos. El total va al
 * centro y la leyenda muestra cantidad y porcentaje de cada estado.
 */
function StatusDonut({ summary, tokens }: { summary: DashboardSummary; tokens: Tokens }) {
  const slices = STATUS_SLICES.map((slice) => ({
    ...slice,
    count: countByStatus(summary, slice.status),
  }));
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);

  if (total === 0) {
    return (
      <p className="flex flex-1 items-center justify-center text-sm text-slate-400">
        Sin pacientes en este período.
      </p>
    );
  }
  const visible = slices.filter((slice) => slice.count > 0);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5">
      <div className="relative">
        <PieChart width={192} height={192}>
          <Pie
            data={visible}
            dataKey="count"
            nameKey="label"
            innerRadius={64}
            outerRadius={94}
            startAngle={90}
            endAngle={-270}
            stroke={tokens.surface}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {visible.map((slice) => (
              <Cell key={slice.status} fill={tokens[slice.color]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle(tokens)} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold text-slate-800 dark:text-slate-100">
            {total.toLocaleString("es-SV")}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">pacientes</span>
        </div>
      </div>
      <ul className="w-full space-y-2" aria-label="Pacientes por estado">
        {slices.map((slice) => (
          <li key={slice.status} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: tokens[slice.color] }}
            />
            <span className="flex-1 text-slate-600 dark:text-slate-300">{slice.label}</span>
            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {slice.count.toLocaleString("es-SV")}
            </span>
            <span className="w-10 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {Math.round((slice.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
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

function ChartPlaceholder() {
  return <div className="h-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;
}
