import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { ArrowUpRight } from "../../components/icons";
import { smoothPath } from "./smoothPath";

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

/** Tarjeta del dashboard: vidrio sobre el fondo desenfocado. */
export const CARD = "glass rounded-[24px]";

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
          className="pointer-events-none fixed z-50 whitespace-pre-line rounded-xl bg-ink px-2.5 py-1.5 text-xs text-white shadow-xl dark:bg-white dark:text-ink"
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
        <h2 className="text-[14px] font-semibold text-ink dark:text-white">{title}</h2>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="press anim-arrow glass-chip inline-flex items-center gap-1 rounded-full py-1 pr-2 pl-3 text-xs font-semibold text-ink transition hover:bg-white dark:text-white dark:hover:bg-white/10"
    >
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="glass-chip rounded-full px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
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
  const points = values.map((value, index): [number, number] => [
    index * (w / (values.length - 1)),
    h - 4 - ((value - min) / (max - min || 1)) * (h - 8),
  ]);
  const d = smoothPath(points);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-28 shrink-0" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: color, stopOpacity: 0.35 }} />
          <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
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
    ? "text-lime dark:text-ink"
    : good
      ? "text-olive dark:text-lime"
      : "text-rose-600 dark:text-rose-400";
  return (
    <article
      className={`lift relative flex flex-col justify-between overflow-hidden rounded-[22px] p-4 ${
        featured ? "bg-ink text-white dark:bg-lime dark:text-ink" : CARD
      }`}
      aria-label={label}
    >
      {featured ? (
        <span
          className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-lime/25 blur-2xl dark:bg-white/40"
          aria-hidden="true"
        />
      ) : null}
      <div className="relative flex items-center justify-between gap-2">
        <p
          className={`text-[12.5px] font-medium ${
            featured ? "text-white/60 dark:text-ink/60" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {label}
        </p>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full ${
            featured ? "bg-lime text-ink dark:bg-ink dark:text-lime" : "glass-chip text-ink dark:text-white"
          }`}
        >
          {icon}
        </span>
      </div>
      <div className="relative mt-2 flex items-end justify-between gap-2">
        <div>
          <p
            className={`num text-[38px] leading-none font-bold ${
              featured ? "text-lime dark:text-ink" : "text-ink dark:text-white"
            }`}
          >
            {value == null ? "—" : value.toLocaleString("es-SV")}
            {metric?.unit && value != null ? (
              <span className="ml-1 text-sm font-medium opacity-70">{metric.unit}</span>
            ) : null}
          </p>
          {trend == null ? null : (
            <p className={`mt-2 text-[12px] font-semibold ${trendTone}`}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%{" "}
              <span className={`font-normal ${featured ? "text-white/55 dark:text-ink/60" : "text-slate-500 dark:text-slate-400"}`}>
                {metric?.trend_label ?? "vs mes anterior"}
              </span>
            </p>
          )}
        </div>
        <span className={featured ? "text-lime dark:text-ink" : "text-ink dark:text-lime"}>
          <Sparkline values={metric?.spark ?? []} color="currentColor" />
        </span>
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
    <div className="flex h-full items-end justify-between gap-1.5">
      {rows.map((row, index) => (
        <div
          key={row.month}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          data-tip={`${row.label}: ${row.count} ${unit}`}
        >
          {index === current ? (
            <span className="num text-[11px] font-bold text-ink dark:text-white">{row.count}</span>
          ) : null}
          <div
            className={`w-full max-w-[30px] rounded-full transition-colors ${
              index === current
                ? "bg-lime-strong shadow-[0_8px_20px_-8px_rgba(160,190,20,.8)] dark:bg-lime"
                : "bg-ink/80 hover:bg-ink dark:bg-white/15 dark:hover:bg-white/25"
            }`}
            style={{ height: `${Math.max((row.count / max) * 78, row.count ? 4 : 2)}%` }}
          />
          <span
            className={`text-[10px] ${
              index === current ? "font-semibold text-ink dark:text-white" : "text-slate-400"
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
        <span key={label} className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600 dark:text-slate-400">
          <span className="h-[3px] w-3.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function StatusDonut({ counts }: { counts: CaseStatusCounts }) {
  const { status } = useChartTheme();
  const total = CASE_STATUS_ORDER.reduce((sum, key) => sum + counts[key], 0);
  // Extremos redondeados con separación: el hueco se reparte a cada lado.
  const r = 62;
  const c = 2 * Math.PI * r;
  const present = CASE_STATUS_ORDER.filter((key) => counts[key] > 0);
  const gap = present.length > 1 ? 10 : 0;
  // Dónde empieza cada segmento: suma de los anteriores (sin mutar en el render).
  const lengths = present.map((key) => (counts[key] / total) * c);
  const starts = lengths.map((_, index) => lengths.slice(0, index).reduce((sum, value) => sum + value, 0));
  return (
    <div className="flex h-full items-center gap-5">
      <div className="relative aspect-square h-full max-h-40 shrink-0">
        <svg viewBox="0 0 160 160" className="size-full -rotate-90" aria-hidden="true">
          <circle r={r} cx="80" cy="80" fill="none" strokeWidth="14" className="stroke-ink/5 dark:stroke-white/5" />
          {present.map((key, index) => (
              <circle
                key={key}
                r={r}
                cx="80"
                cy="80"
                fill="none"
                style={{ stroke: status[key] }}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${Math.max(lengths[index] - gap, 1)} ${c}`}
                strokeDashoffset={-(starts[index] + gap / 2)}
                className="cursor-pointer transition-[stroke-width] duration-200 hover:[stroke-width:19]"
                data-tip={`${CASE_STATUS_LABELS[key]}: ${counts[key]} (${Math.round((counts[key] / total) * 100)}%)`}
              />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="num text-[30px] leading-none font-bold text-ink dark:text-white">{total}</p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">pacientes</p>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {CASE_STATUS_ORDER.map((key) => (
          <p
            key={key}
            className="flex items-center gap-2.5 rounded-full px-2 py-1 text-[12.5px] text-slate-600 transition hover:bg-white/50 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: status[key] }} />
            {CASE_STATUS_LABELS[key]}
            <b className="num ml-auto pl-3 font-semibold text-ink dark:text-white">{counts[key]}</b>
            <span className="num w-9 text-right text-[11px] text-slate-400">
              {total ? Math.round((counts[key] / total) * 100) : 0}%
            </span>
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

const HEAT_LIGHT = ["#f7f7f4", "#f3f8d6", "#ebf5b0", "#dcf26a", "#c8e43c", "#a3bf1c", "#6f8a00"];
const HEAT_DARK = ["#1d2026", "#262d0c", "#364112", "#4f6500", "#7f9a00", "#a9c41f", "#dcf26a"];

/** Citas por día y franja: una sola gama de lima (claro = pocas). */
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
            className="absolute bottom-0 top-0 border-l border-dashed border-ink/10 dark:border-white/10"
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
              className={`absolute rounded-xl px-2 py-1 text-[11px] leading-tight shadow-sm ${done ? "bg-lavender/25 text-ink dark:text-white" : "bg-action text-on-action"}`}
              style={{
                left: `${position(hour)}%`,
                width: `${Math.max((row.duration_minutes / 60) * 10 - 0.5, 6)}%`,
                top: `${(index % 3) * 34}%`,
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
              className="stroke-ink/10 dark:stroke-white/10"
              strokeDasharray="2 5"
              vectorEffect="non-scaling-stroke"
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
        const d = smoothPath(item.values.map((value, index): [number, number] => [x(index), y(value)]));
        return (
          <g key={item.name}>
            {seriesIndex === 0 ? (
              <path
                d={`${d} L${x(labels.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`}
                style={{ fill: item.color, fillOpacity: 0.08 }}
              />
            ) : null}
            <path
              d={d}
              fill="none"
              style={{ stroke: item.color }}
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="anim-draw"
            />
          </g>
        );
      })}
      <line data-crossline x1="0" x2="0" y1={P.t} y2={H - P.b} className="stroke-ink/20 dark:stroke-white/20" vectorEffect="non-scaling-stroke" style={{ visibility: "hidden" }} />
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
          className="press anim-nudge glass-chip flex flex-col items-center justify-center gap-1.5 rounded-2xl text-xs font-medium text-slate-700 transition hover:bg-lime hover:text-ink dark:text-slate-200 dark:hover:bg-lime dark:hover:text-ink"
        >
          {action.icon}
          {action.label}
        </Link>
      ))}
    </div>
  );
}
