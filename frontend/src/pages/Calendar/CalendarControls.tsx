import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";

import type { Appointment } from "../../services/appointments";
import {
  KIND_ORDER,
  KIND_STYLE,
  VIEW_LABELS,
  type AppointmentKind,
  type CalendarView,
} from "./calendarModel";

const OUTLINE_BUTTON =
  "border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

export function CalendarToolbar({
  title,
  view,
  views,
  canCreate,
  onPrevious,
  onNext,
  onToday,
  onViewChange,
  onNew,
}: {
  title: string;
  view: CalendarView;
  views: CalendarView[];
  canCreate: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
      <div className="flex items-center gap-2">
        <div className="flex">
          <button
            type="button"
            aria-label="Anterior"
            title="Anterior"
            onClick={onPrevious}
            className={`flex size-9 items-center justify-center rounded-l-full ${OUTLINE_BUTTON}`}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            title="Siguiente"
            onClick={onNext}
            className={`-ml-px flex size-9 items-center justify-center rounded-r-full ${OUTLINE_BUTTON}`}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={onToday}
          className={`h-9 rounded-full px-3.5 text-sm font-medium ${OUTLINE_BUTTON}`}
        >
          Hoy
        </button>
        <h2 className="ml-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-white" aria-live="polite">
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5 rounded-full bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Vista">
          {views.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={view === item}
              onClick={() => onViewChange(item)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                view === item
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {VIEW_LABELS[item]}
            </button>
          ))}
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={onNew}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm shadow-teal-900/20 transition hover:bg-teal-800 active:scale-[.98]"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            Nueva cita
          </button>
        ) : null}
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
}) {
  const weekly = view === "semana" || view === "estudiante";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 pt-3 pb-3 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mostrar estados">
        <span className="mr-1 text-xs text-slate-500 dark:text-slate-400">
          {total} {total === 1 ? "cita" : "citas"} {RANGE_NOUN[view]}
        </span>
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
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                shown
                  ? "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  : "border-transparent bg-slate-100 text-slate-400 line-through dark:bg-slate-800"
              } ${alert ? "ring-1 ring-amber-400/60" : ""}`}
            >
              <span className="size-2 rounded-full" style={{ background: style.bar }} aria-hidden="true" />
              {style.label}
              <span className="tabular-nums text-slate-400" aria-label={`${counts[kind]} citas`}>
                {counts[kind]}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        {showStudentFilter ? (
          <label className="flex h-9 items-center gap-2 rounded-full bg-slate-100 pr-1 pl-3 text-xs dark:bg-slate-800">
            <GraduationCap className="size-3.5 text-slate-400" aria-hidden="true" />
            <span className="text-slate-500 dark:text-slate-400">Estudiante</span>
            <span className="relative flex items-center">
              <select
                aria-label="Filtrar por estudiante"
                value={studentId ?? ""}
                onChange={(event) =>
                  onStudentChange(event.target.value ? Number(event.target.value) : null)
                }
                className="max-w-48 appearance-none truncate rounded-full bg-white py-1 pr-7 pl-2.5 font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Todos</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2 size-3.5 text-slate-400"
                aria-hidden="true"
              />
            </span>
          </label>
        ) : null}
        {weekly ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={showSunday}
              onChange={(event) => onShowSundayChange(event.target.checked)}
            />
            <span
              className="relative h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-teal-700 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600/40 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4 dark:bg-slate-700"
              aria-hidden="true"
            />
            Domingo
          </label>
        ) : null}
      </div>
    </div>
  );
}
