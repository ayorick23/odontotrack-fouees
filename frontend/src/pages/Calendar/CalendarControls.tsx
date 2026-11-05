import type { ReactNode } from "react";

import { ChevronDown, ChevronLeft, ChevronRight, GraduationCap, Plus } from "../../components/icons";
import { FolderTabs } from "../../components/Panel";
import { ICON_BUTTON, PRIMARY_BUTTON, PRIMARY_ICON_DOT } from "../../components/listing/styles";
import type { Appointment } from "../../services/appointments";
import {
  KIND_ORDER,
  KIND_STYLE,
  VIEW_LABELS,
  type AppointmentKind,
  type CalendarView,
} from "./calendarModel";

/**
 * Encabezado del panel principal (sobre el vidrio): navegación y título
 * arriba; abajo las vistas como pestañas de carpeta unidas a la grilla.
 */
export function CalendarToolbar({
  title,
  view,
  views,
  summary,
  onPrevious,
  onNext,
  onToday,
  onViewChange,
}: {
  title: string;
  view: CalendarView;
  views: CalendarView[];
  /** Texto a la derecha de las pestañas (p. ej. "7 citas esta semana"). */
  summary?: ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-1.5">
        <h2
          className="text-[22px] leading-tight font-bold tracking-[-0.03em] text-ink first-letter:uppercase dark:text-white"
          aria-live="polite"
        >
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToday}
            className="press glass-chip h-9 rounded-full px-4 text-sm font-semibold text-ink transition hover:bg-white dark:text-white dark:hover:bg-white/10"
          >
            Hoy
          </button>
          <div className="glass-chip flex rounded-full p-0.5">
            <button
              type="button"
              aria-label="Anterior"
              title="Anterior"
              onClick={onPrevious}
              className={`${ICON_BUTTON} size-8`}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Siguiente"
              title="Siguiente"
              onClick={onNext}
              className={`${ICON_BUTTON} size-8`}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 pr-3">
        <FolderTabs
          tabs={views.map((item) => ({ value: item, label: VIEW_LABELS[item] }))}
          value={view}
          onChange={onViewChange}
          ariaLabel="Vista"
        />
        {summary ? <div className="pb-3">{summary}</div> : null}
      </div>
    </div>
  );
}

const RANGE_NOUN: Record<CalendarView, string> = {
  dia: "este día",
  semana: "esta semana",
  mes: "este mes",
  estudiante: "esta semana",
};

/**
 * Columna lateral (vidrio con bloques sólidos): nueva cita, mes pequeño,
 * estados como lista que se activa con clic, estudiante y domingo.
 */
export function CalendarFilters({
  view,
  total,
  counts,
  hidden,
  onToggleKind,
  students,
  studentId,
  onStudentChange,
  showStudentFilter,
  showSunday,
  onShowSundayChange,
  canCreate,
  onNew,
  miniMonth,
}: {
  view: CalendarView;
  total: number;
  counts: Record<AppointmentKind, number>;
  hidden: ReadonlySet<AppointmentKind>;
  onToggleKind: (kind: AppointmentKind) => void;
  students: Appointment["student"][];
  studentId: number | null;
  onStudentChange: (id: number | null) => void;
  showStudentFilter: boolean;
  showSunday: boolean;
  onShowSundayChange: (show: boolean) => void;
  canCreate: boolean;
  onNew: () => void;
  miniMonth: ReactNode;
}) {
  const weekly = view === "semana" || view === "estudiante";
  return (
    <aside
      className="glass flex shrink-0 flex-col gap-2 rounded-[24px] p-2 lg:w-[272px]"
      aria-label="Filtros del calendario"
    >
      {canCreate ? (
        <button
          type="button"
          onClick={onNew}
          className={`${PRIMARY_BUTTON} anim-spin-plus m-1 justify-start py-1.5 pl-1.5`}
        >
          <span className={PRIMARY_ICON_DOT}>
            <Plus className="size-4" weight="bold" aria-hidden="true" />
          </span>
          Nueva cita
        </button>
      ) : null}

      <div className="rounded-[18px] bg-surface p-3">{miniMonth}</div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-[18px] bg-surface p-3">
        <div role="group" aria-label="Mostrar estados">
          <p className="mb-2 px-1 text-xs text-slate-500 dark:text-slate-400">
            {total} {total === 1 ? "cita" : "citas"} {RANGE_NOUN[view]}
          </p>
          <div className="flex flex-col gap-0.5">
            {KIND_ORDER.map((kind) => {
              const style = KIND_STYLE[kind];
              const shown = !hidden.has(kind);
              const alert = kind === "pendiente" && counts.pendiente > 0;
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={shown}
                  onClick={() => onToggleKind(kind)}
                  title={
                    kind === "pendiente"
                      ? "Programadas cuya hora ya pasó: falta marcarlas como atendidas o canceladas"
                      : shown
                        ? `Ocultar ${style.label.toLowerCase()}s`
                        : `Mostrar ${style.label.toLowerCase()}s`
                  }
                  className={`press flex items-center gap-2.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition ${
                    shown
                      ? "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[.06]"
                      : "text-slate-400 line-through opacity-60 hover:opacity-100"
                  } ${alert ? "bg-amber-50 dark:bg-amber-950/40" : ""}`}
                >
                  <span
                    className={`size-2.5 shrink-0 rounded-full transition ${shown ? "" : "scale-75"}`}
                    style={{ background: style.bar }}
                    aria-hidden="true"
                  />
                  {style.label}
                  <span
                    className={`num ml-auto rounded-full px-1.5 text-[11px] font-semibold ${
                      alert ? "bg-amber-400 text-amber-950" : "bg-ink/5 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                    }`}
                    aria-label={`${counts[kind]} citas`}
                  >
                    {counts[kind]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {showStudentFilter ? (
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <GraduationCap className="size-3.5" aria-hidden="true" />
              Estudiante
            </span>
            <span className="relative flex items-center">
              <select
                aria-label="Filtrar por estudiante"
                value={studentId ?? ""}
                onChange={(event) =>
                  onStudentChange(event.target.value ? Number(event.target.value) : null)
                }
                className="h-10 w-full appearance-none truncate rounded-xl bg-slate-100 pr-8 pl-3 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-200/70 focus-visible:ring-2 focus-visible:ring-focus dark:bg-white/[.06] dark:text-slate-100"
              >
                <option value="">Todos</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 size-3.5 text-slate-400"
                aria-hidden="true"
              />
            </span>
          </label>
        ) : null}

        {weekly ? (
          <label className="mt-auto inline-flex cursor-pointer items-center justify-between gap-2 px-1 text-[13px] font-medium text-slate-600 dark:text-slate-300">
            Mostrar domingo
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={showSunday}
              onChange={(event) => onShowSundayChange(event.target.checked)}
            />
            <span
              className="relative h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-action peer-focus-visible:ring-2 peer-focus-visible:ring-focus after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4 dark:bg-slate-700 dark:after:bg-slate-300 dark:peer-checked:after:bg-ink"
              aria-hidden="true"
            />
          </label>
        ) : null}
      </div>
    </aside>
  );
}
