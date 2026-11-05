import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Check } from "../../components/icons";

import type { Appointment } from "../../services/appointments";
import {
  KIND_STYLE,
  appointmentKind,
  appointmentsOn,
  groupByStudent,
} from "./calendarModel";

/** Citas visibles por día antes de "+N más". */
const VISIBLE_PER_DAY = 2;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Vista "Por estudiante" (como la referencia aprobada): una fila por
 * estudiante y una columna por día. FullCalendar la tiene solo en su
 * versión de pago, por eso es propia.
 */
export function StudentWeekView({
  days,
  appointments,
  now,
  onOpen,
  onOpenDay,
}: {
  days: Date[];
  appointments: Appointment[];
  now: Date;
  onOpen: (appointment: Appointment) => void;
  onOpenDay: (day: Date) => void;
}) {
  const rows = groupByStudent(appointments);
  const columns = { gridTemplateColumns: `13rem repeat(${days.length}, minmax(0, 1fr))` };

  if (rows.length === 0) {
    return (
      <p className="px-5 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
        No hay citas en esta semana con los filtros elegidos.
      </p>
    );
  }

  return (
    <div className="min-h-full min-w-[56rem]" role="table" aria-label="Citas por estudiante">
      <div
        role="row"
        className="sticky top-0 z-10 grid border-b border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
        style={columns}
      >
        <span role="columnheader" className="flex items-end px-4 pb-2 text-[11px] font-semibold uppercase text-slate-400">
          Estudiante
        </span>
        {days.map((day) => {
          const today = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              role="columnheader"
              className={`flex items-end gap-2 px-3 py-2.5 ${
                today ? "bg-lime-soft text-lime-ink " : "text-slate-500"
              }`}
            >
              <span
                className={`text-2xl leading-none font-semibold ${
                  today ? "" : "text-slate-800 dark:text-slate-100"
                }`}
              >
                {format(day, "d")}
              </span>
              <span className="pb-0.5 text-[11px] font-semibold uppercase">
                {format(day, "EEE", { locale: es }).replace(".", "")}
              </span>
            </div>
          );
        })}
      </div>

      {rows.map(({ student, appointments: mine }) => {
        const pending = mine.filter((item) => appointmentKind(item, now) === "pendiente").length;
        return (
          <div
            key={student.id}
            role="row"
            className="grid border-b border-slate-100 dark:border-slate-800"
            style={columns}
          >
            <div role="rowheader" className="flex items-start gap-2.5 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {initials(student.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {student.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {mine.length} {mine.length === 1 ? "cita" : "citas"}
                  {pending > 0 ? (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {" "}
                      · {pending} sin registrar
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            {days.map((day) => {
              const items = appointmentsOn(mine, day);
              const hiddenCount = items.length - VISIBLE_PER_DAY;
              return (
                <div
                  key={day.toISOString()}
                  role="cell"
                  className={`flex min-h-[4.5rem] flex-col gap-1 border-l border-slate-100 p-1.5 dark:border-slate-800 ${
                    isSameDay(day, now) ? "bg-lime-soft " : ""
                  }`}
                >
                  {items.slice(0, VISIBLE_PER_DAY).map((item) => (
                    <StudentChip key={item.id} appointment={item} now={now} onOpen={onOpen} />
                  ))}
                  {hiddenCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => onOpenDay(day)}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-left text-[11px] font-semibold text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                    >
                      +{hiddenCount} más
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function StudentChip({
  appointment,
  now,
  onOpen,
}: {
  appointment: Appointment;
  now: Date;
  onOpen: (appointment: Appointment) => void;
}) {
  const kind = appointmentKind(appointment, now);
  const style = KIND_STYLE[kind];
  const start = new Date(appointment.starts_at);
  const end = new Date(appointment.ends_at);
  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      title={`${appointment.patient.name} · ${style.label}`}
      className={`rounded-lg px-2 py-1 text-left transition hover:-translate-y-px hover:shadow-md ${style.chip}`}
      style={{ boxShadow: `inset 3px 0 0 ${style.bar}` }}
    >
      <span className="flex items-center gap-1 text-[11px] font-semibold">
        <span className={`truncate ${kind === "cancelada" ? "line-through" : ""}`}>
          {appointment.patient.name}
        </span>
        {kind === "pendiente" ? (
          <AlertTriangle className="size-3 shrink-0 text-amber-600" aria-label="Sin registrar" />
        ) : kind === "atendida" ? (
          <Check className="size-3 shrink-0" aria-label="Atendida" />
        ) : null}
      </span>
      <span className="block text-[10px] tabular-nums opacity-70">
        {format(start, "HH:mm")} – {format(end, "HH:mm")}
      </span>
    </button>
  );
}
