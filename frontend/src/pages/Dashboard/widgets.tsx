import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import type {
  CaseStatusCounts,
  DashboardAreaStatus,
  DashboardMetric,
  MonthCount,
  Occupancy,
} from "../../services/dashboard";
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_ORDER,
  SINGLE_SERIES_COLOR,
  useChartTheme,
} from "./chartColors";

/**
 * Piezas del dashboard (maqueta aprobada el 2026-11-01). Son SVG y HTML
 * simples para que se vean igual que la maqueta; los colores salen de
 * chartColors.ts (validados para contraste y daltonismo).
 *
 * Tooltips: cualquier elemento con `data-tip` muestra su texto al pasar el
 * mouse (TipLayer). Se pone como texto, nunca como HTML.
 */

export const CARD = "rounded-2xl bg-white dark:bg-slate-900";

export function TipLayer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) {
      return;
    }
    function onMove(event: MouseEvent) {
      const target = (event.target as Element).closest<HTMLElement | SVGElement>("[data-tip]");
      const text = target?.getAttribute("data-tip");
      setTip(text ? { text, x: event.clientX, y: event.clientY } : null);
      const cross = target?.getAttribute("data-cross");
      root?.querySelectorAll<SVGLineElement>("[data-crossline]").forEach((line) => {
        const owner = target?.closest("svg") === line.closest("svg");
        line.style.visibility = cross && owner ? "visible" : "hidden";
        if (cross && owner) {
          line.setAttribute("x1", cross);
          line.setAttribute("x2", cross);
        }
      });
    }
    function onLeave() {
      setTip(null);
    }
    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    return () => {
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} className="contents">
      {children}
      {tip ? (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 whitespace-pre-line rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-xl dark:bg-slate-700"
          style={{ left: tip.x + 14, top: tip.y + 14 }}
        >
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}

export function Card({
  title,
  action,
  className = "",
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${CARD} flex min-h-0 flex-col p-4 ${className}`} aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300">
      {children} →
    </Link>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </span>
  );
}

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const id = useId();
  if (values.length < 2) {
    return null;
  }
  const w = 120;
  const h = 36;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((value, index) => [
    index * (w / (values.length - 1)),
    h - 4 - ((value - min) / (max - min || 1)) * (h - 8),
  ]);
  const d = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-28 shrink-0" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type KpiSpec = {
  label: string;
  metric: DashboardMetric | undefined;
  icon: ReactNode;
  /** Si bajar es bueno (p. ej. diagnósticos por validar). */
  lowerIsBetter?: boolean;
  featured?: boolean;
};

export function KpiCard({ label, metric, icon, lowerIsBetter = false, featured = false }: KpiSpec) {
  const value = metric?.value;
  const trend = metric?.trend ?? null;
  const good = trend == null ? null : lowerIsBetter ? trend <= 0 : trend >= 0;
  const trendTone = featured
    ? "text-teal-100"
    : good
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <article
      className={`flex flex-col justify-between rounded-2xl p-4 ${featured ? "bg-teal-700 text-white" : CARD}`}
      aria-label={label}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-xl ${
            featured ? "bg-white/15" : "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
          }`}
        >
          {icon}
        </span>
        <p className={`text-xs font-medium ${featured ? "text-teal-50" : "text-slate-500"}`}>{label}</p>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <p
            className={`text-[28px] font-semibold leading-none tracking-tight tabular-nums ${
              featured ? "" : "text-slate-900 dark:text-white"
            }`}
          >
            {value == null ? "—" : value.toLocaleString("es-SV")}
            {metric?.unit && value != null ? (
              <span className="ml-1 text-sm font-medium opacity-70">{metric.unit}</span>
            ) : null}
          </p>
          {trend == null ? null : (
            <p className={`mt-1.5 text-[11px] font-medium ${trendTone}`}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%{" "}
              <span className={featured ? "text-teal-100/80" : "text-slate-400"}>
                {metric?.trend_label ?? "vs mes anterior"}
              </span>
            </p>
          )}
        </div>
        <Sparkline values={metric?.spark ?? []} color={featured ? "#ffffff" : SINGLE_SERIES_COLOR} />
      </div>
    </article>
  );
}

export function RankBars({
  rows,
  empty,
}: {
  rows: Array<{ name: string; value: number; hint?: string }>;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.name} data-tip={`${row.name}${row.hint ? ` (${row.hint})` : ""}: ${row.value}`}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="truncate text-slate-600 dark:text-slate-300">{row.name}</span>
            <b className="font-semibold text-slate-800 dark:text-slate-100">{row.value}</b>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full"
              style={{ width: `${(row.value / max) * 100}%`, background: SINGLE_SERIES_COLOR }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div data-tip={label}>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: SINGLE_SERIES_COLOR }}
        />
      </div>
    </div>
  );
}

/** Barras por mes con el mes actual (el último) resaltado. */
export function MonthBars({ rows, unit }: { rows: MonthCount[]; unit: string }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  const current = rows.length - 1;
  return (
    <div className="flex h-full items-end gap-1.5">
      {rows.map((row, index) => (
        <div
          key={row.month}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          data-tip={`${row.label}: ${row.count} ${unit}`}
        >
          {index === current ? (
            <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900">
              {row.count}
            </span>
          ) : null}
          <div
            className="w-full rounded-t-md rounded-b-sm"
            style={{
              height: `${Math.max((row.count / max) * 78, row.count ? 3 : 1)}%`,
              background: index === current ? SINGLE_SERIES_COLOR : "rgba(13,148,136,.18)",
            }}
          />
          <span
            className={`text-[10px] ${
              index === current ? "font-semibold text-slate-700 dark:text-slate-200" : "text-slate-400"
            }`}
          >
            {row.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function StatusDonut({ counts }: { counts: CaseStatusCounts }) {
  const { status } = useChartTheme();
  const total = CASE_STATUS_ORDER.reduce((sum, key) => sum + counts[key], 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex h-full items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-full max-h-40 shrink-0 -rotate-90" aria-hidden="true">
        {total === 0 ? (
          <circle r={r} cx="70" cy="70" fill="none" strokeWidth="16" className="stroke-slate-100 dark:stroke-slate-800" />
        ) : (
          CASE_STATUS_ORDER.filter((key) => counts[key] > 0).map((key) => {
            const length = (counts[key] / total) * c;
            const arc = (
              <circle
                key={key}
                r={r}
                cx="70"
                cy="70"
                fill="none"
                stroke={status[key]}
                strokeWidth="16"
                strokeDasharray={`${Math.max(length - 3, 0.5)} ${c}`}
                strokeDashoffset={-offset}
                data-tip={`${CASE_STATUS_LABELS[key]}: ${counts[key]} (${Math.round((counts[key] / total) * 100)}%)`}
              />
            );
            offset += length;
            return arc;
          })
        )}
      </svg>
      <div className="space-y-2">
        <p className="text-[26px] font-semibold leading-none text-slate-900 dark:text-white">
          {total}
          <span className="ml-1 text-xs font-medium text-slate-400">pacientes</span>
        </p>
        {CASE_STATUS_ORDER.map((key) => (
          <p key={key} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="size-2 rounded-full" style={{ background: status[key] }} />
            {CASE_STATUS_LABELS[key]}
            <b className="ml-auto pl-3 font-semibold text-slate-700 dark:text-slate-200">{counts[key]}</b>
          </p>
        ))}
      </div>
    </div>
  );
}

export function AreaStatusBars({ rows }: { rows: DashboardAreaStatus[] }) {
  const { status } = useChartTheme();
  const data = rows
    .map((row) => ({ ...row, total: CASE_STATUS_ORDER.reduce((sum, key) => sum + row[key], 0) }))
    .filter((row) => row.total > 0)
    .slice(0, 5);
  const max = Math.max(...data.map((row) => row.total), 1);
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Sin pacientes registrados.</p>
      ) : (
        <ul className="space-y-2.5">
          {data.map((row) => (
            <li key={row.area}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{row.area}</span>
                <b className="font-semibold text-slate-800 dark:text-slate-100">{row.total}</b>
              </div>
              <div className="flex h-2 gap-[2px]">
                {CASE_STATUS_ORDER.filter((key) => row[key] > 0).map((key) => (
                  <div
                    key={key}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${(row[key] / max) * 100}%`, background: status[key] }}
                    data-tip={`${row.area} · ${CASE_STATUS_LABELS[key]}: ${row[key]}`}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Legend items={CASE_STATUS_ORDER.map((key) => [CASE_STATUS_LABELS[key], status[key]])} />
    </div>
  );
}

const HEAT_LIGHT = ["#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0d9488"];
const HEAT_DARK = ["#0f1f24", "#123b3a", "#115e59", "#0f766e", "#0d9488", "#14b8a6", "#2dd4bf"];

/** Citas por día y franja: una sola gama de teal (claro = pocas). */
export function OccupancyHeatmap({ data }: { data: Occupancy }) {
  const { dark } = useChartTheme();
  const scale = dark ? HEAT_DARK : HEAT_LIGHT;
  const max = Math.max(...data.cells.flat(), 1);
  const tone = (value: number) =>
    scale[value === 0 ? 0 : Math.max(1, Math.round((value / max) * (scale.length - 1)))];
  return (
    <div
      className="grid h-full gap-1"
      style={{
        gridTemplateColumns: `auto repeat(${data.days.length}, 1fr)`,
        gridTemplateRows: `repeat(${data.slots.length}, 1fr) auto`,
      }}
    >
      {data.slots.map((slot, slotIndex) => [
        <span key={`label-${slot}`} className="self-center pr-1 text-right text-[10px] leading-none text-slate-400">
          {slot}
        </span>,
        ...data.days.map((day, dayIndex) => {
          const value = data.cells[dayIndex]?.[slotIndex] ?? 0;
          return (
            <div
              key={`${day}-${slot}`}
              className="rounded-md"
              style={{ background: tone(value) }}
              data-tip={`${day} ${slot} h: ${value} ${value === 1 ? "cita" : "citas"}`}
            />
          );
        }),
      ])}
      <span />
      {data.days.map((day) => (
        <span key={day} className="text-center text-[10px] text-slate-400">
          {day}
        </span>
      ))}
    </div>
  );
}

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/** Línea de tiempo del día (7 a 17 h) con la hora actual. */
export function AgendaToday({
  rows,
}: {
  rows: Array<{
    id: number;
    starts_at: string;
    duration_minutes: number;
    status: string;
    patient_name: string;
    student_name: string;
  }>;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const position = (hour: number) => ((hour - 7) / 10) * 100;
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const time = new Intl.DateTimeFormat("es-SV", { hour: "2-digit", minute: "2-digit" });

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No hay citas para hoy.</p>;
  }
  return (
    <div className="relative h-full min-h-32">
      <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-slate-400">
        {HOURS.map((hour) => (
          <span key={hour}>{hour}h</span>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-5 top-0">
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="absolute bottom-0 top-0 border-l border-dashed border-slate-200 dark:border-slate-800"
            style={{ left: `${position(hour)}%` }}
          />
        ))}
        {nowHour >= 7 && nowHour <= 17 ? (
          <div className="absolute bottom-0 top-0 z-10 w-px bg-rose-500" style={{ left: `${position(nowHour)}%` }}>
            <span className="absolute -left-1 -top-1 size-2 rounded-full bg-rose-500" />
          </div>
        ) : null}
        {rows.map((row, index) => {
          const start = new Date(row.starts_at);
          const hour = Math.max(7, Math.min(16.5, start.getHours() + start.getMinutes() / 60));
          const done = row.status === "atendida";
          return (
            <div
              key={row.id}
              className="absolute rounded-lg px-2 py-1 text-[11px] leading-tight text-white shadow-sm"
              style={{
                left: `${position(hour)}%`,
                width: `${Math.max((row.duration_minutes / 60) * 10 - 0.5, 6)}%`,
                top: `${(index % 3) * 34}%`,
                background: done ? "#94a3b8" : SINGLE_SERIES_COLOR,
              }}
              data-tip={`${time.format(start)} · ${row.patient_name} con ${row.student_name}${done ? " (atendida)" : ""}`}
            >
              <b className="block truncate">{row.patient_name}</b>
              <span className="block truncate opacity-80">{row.student_name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Dos series por mes en líneas, con cruz y tooltip al pasar el mouse. */
export function LineChart({
  labels,
  series,
}: {
  labels: string[];
  series: Array<{ name: string; color: string; values: number[] }>;
}) {
  const W = 640;
  const H = 200;
  const P = { l: 30, r: 18, t: 10, b: 22 };
  if (labels.length < 2) {
    return <p className="py-8 text-center text-sm text-slate-400">Sin datos en este período.</p>;
  }
  const max = Math.max(4, Math.ceil(Math.max(...series.flatMap((item) => item.values)) / 4) * 4);
  const step = (W - P.l - P.r) / (labels.length - 1);
  const x = (index: number) => P.l + index * step;
  const y = (value: number) => P.t + (1 - value / max) * (H - P.t - P.b);
  const every = labels.length > 12 ? Math.ceil(labels.length / 12) : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      {[0, 1, 2, 3, 4].map((k) => {
        const value = (max / 4) * k;
        return (
          <g key={k}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(value)}
              y2={y(value)}
              className="stroke-slate-200 dark:stroke-slate-800"
              strokeDasharray="3 4"
            />
            <text x={P.l - 6} y={y(value) + 3} textAnchor="end" className="fill-slate-400" fontSize="10">
              {value}
            </text>
          </g>
        );
      })}
      {labels.map((label, index) =>
        index % every === 0 ? (
          <text key={`${label}-${index}`} x={x(index)} y={H - 6} textAnchor="middle" className="fill-slate-400" fontSize="10">
            {label}
          </text>
        ) : null,
      )}
      {series.map((item, seriesIndex) => {
        const d = item.values.map((value, index) => `${index ? "L" : "M"}${x(index)} ${y(value)}`).join(" ");
        return (
          <g key={item.name}>
            {seriesIndex === 0 ? (
              <path d={`${d} L${x(labels.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={item.color} fillOpacity=".1" />
            ) : null}
            <path d={d} fill="none" stroke={item.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}
      <line data-crossline x1="0" x2="0" y1={P.t} y2={H - P.b} className="stroke-slate-300 dark:stroke-slate-600" style={{ visibility: "hidden" }} />
      {labels.map((label, index) => (
        <rect
          key={`hit-${index}`}
          x={x(index) - step / 2}
          y={P.t}
          width={step}
          height={H - P.t - P.b}
          fill="transparent"
          data-cross={x(index)}
          data-tip={[label, ...series.map((item) => `${item.name}: ${item.values[index]}`)].join("\n")}
        />
      ))}
    </svg>
  );
}

export function QuickActions({
  actions,
}: {
  actions: Array<{ to: string; label: string; icon: ReactNode }>;
}) {
  return (
    <div className="grid h-full grid-cols-2 gap-2">
      {actions.map((action) => (
        <Link
          key={action.to + action.label}
          to={action.to}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-slate-50 text-xs font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-800 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-teal-950/50"
        >
          {action.icon}
          {action.label}
        </Link>
      ))}
    </div>
  );
}
