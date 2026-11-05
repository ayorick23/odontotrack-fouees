import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

import {
  APPOINTMENT_STATUS_LABELS,
  type Appointment,
  type AppointmentStatus,
} from "../../services/appointments";

export type CalendarView = "dia" | "semana" | "mes" | "estudiante";

/** Vista de FullCalendar para cada vista nuestra ("Por estudiante" es propia). */
export const FULLCALENDAR_VIEW: Record<Exclude<CalendarView, "estudiante">, string> = {
  dia: "timeGridDay",
  semana: "timeGridWeek",
  mes: "dayGridMonth",
};

export const VIEW_LABELS: Record<CalendarView, string> = {
  dia: "Día",
  semana: "Semana",
  mes: "Mes",
  estudiante: "Por estudiante",
};

/** Horario de la clínica en las vistas por hora. */
export const OPENING_HOUR = 7;
export const CLOSING_HOUR = 19;
/** Franja de almuerzo, rayada en la grilla (pendiente de confirmar con el equipo). */
export const LUNCH_START_HOUR = 12;
export const LUNCH_END_HOUR = 13;

/**
 * Estado que se muestra: el de la cita, más "pendiente" (sin registrar)
 * para las programadas cuya hora ya pasó: falta marcarlas como atendidas
 * o canceladas.
 */
export type AppointmentKind = AppointmentStatus | "pendiente";

export const KIND_ORDER: AppointmentKind[] = ["programada", "pendiente", "atendida", "cancelada"];

export const KIND_STYLE: Record<
  AppointmentKind,
  { label: string; bar: string; chip: string }
> = {
  programada: {
    label: APPOINTMENT_STATUS_LABELS.programada,
    // Variable CSS: tinta en claro, lima en oscuro (usar solo en style).
    bar: "var(--action)",
    chip: "bg-slate-100 text-ink dark:bg-white/[.07] dark:text-white",
  },
  pendiente: {
    label: "Sin registrar",
    bar: "#d97706",
    chip: "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100",
  },
  atendida: {
    label: APPOINTMENT_STATUS_LABELS.atendida,
    bar: "#8b7fe8",
    chip: "bg-lavender/15 text-ink dark:bg-lavender/20 dark:text-white",
  },
  cancelada: {
    label: APPOINTMENT_STATUS_LABELS.cancelada,
    bar: "#9c9b95",
    chip: "bg-slate-50 text-slate-400 dark:bg-white/[.03] dark:text-slate-500",
  },
};

export function appointmentKind(appointment: Appointment, now: Date): AppointmentKind {
  if (appointment.status === "programada" && new Date(appointment.ends_at) < now) {
    return "pendiente";
  }
  return appointment.status;
}

export type VisibleRange = {
  /** Desde (incluido) y hasta (excluido): lo que se pide a la API. */
  start: Date;
  end: Date;
  /** Días con columna en Día, Semana y Por estudiante. */
  days: Date[];
};

function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

/** Lo que muestra cada vista alrededor de `anchor`. */
export function visibleRange(
  view: CalendarView,
  anchor: Date,
  showSunday: boolean,
): VisibleRange {
  if (view === "dia") {
    const day = startOfDay(anchor);
    return { start: day, end: addDays(day, 1), days: [day] };
  }
  if (view === "mes") {
    // Como FullCalendar: seis semanas desde el lunes de la semana del día 1.
    const start = weekStart(startOfMonth(anchor));
    const end = addDays(start, 42);
    return { start, end, days: [] };
  }
  const start = weekStart(anchor);
  const days = Array.from({ length: showSunday ? 7 : 6 }, (_, index) => addDays(start, index));
  return { start, end: addDays(start, 7), days };
}

/** Anterior / siguiente según la vista. */
export function shiftAnchor(view: CalendarView, anchor: Date, step: 1 | -1): Date {
  if (view === "mes") {
    return addMonths(startOfMonth(anchor), step);
  }
  return addDays(anchor, step * (view === "dia" ? 1 : 7));
}

/** "2 – 7 nov 2026", "Noviembre 2026" o "Martes 3 de noviembre". */
export function rangeTitle(view: CalendarView, anchor: Date, range: VisibleRange): string {
  if (view === "mes") {
    return capitalize(format(anchor, "MMMM yyyy", { locale: es }));
  }
  if (view === "dia") {
    return capitalize(format(anchor, "EEEE d 'de' MMMM", { locale: es }));
  }
  const first = range.days[0];
  const last = range.days[range.days.length - 1];
  const from = isSameMonth(first, last)
    ? format(first, "d", { locale: es })
    : format(first, "d MMM", { locale: es });
  return `${from} – ${format(last, "d MMM yyyy", { locale: es })}`;
}

export type StudentRow = {
  student: Appointment["student"];
  appointments: Appointment[];
};

/** Una fila por estudiante, por nombre; sus citas en orden de hora. */
export function groupByStudent(appointments: Appointment[]): StudentRow[] {
  const rows = new Map<number, StudentRow>();
  for (const appointment of appointments) {
    const row = rows.get(appointment.student.id) ?? {
      student: appointment.student,
      appointments: [],
    };
    row.appointments.push(appointment);
    rows.set(appointment.student.id, row);
  }
  for (const row of rows.values()) {
    row.appointments.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
  return [...rows.values()].sort((a, b) => a.student.name.localeCompare(b.student.name, "es"));
}

export function appointmentsOn(appointments: Appointment[], day: Date): Appointment[] {
  return appointments.filter((appointment) => isSameDay(new Date(appointment.starts_at), day));
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Clave de día para marcar los que tienen citas ("2026-11-04"). */
export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}
