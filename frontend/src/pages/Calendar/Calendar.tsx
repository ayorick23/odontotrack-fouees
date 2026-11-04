import type {
  DateSelectArg,
  DayCellContentArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventInput,
  MoreLinkContentArg,
  SlotLaneContentArg,
} from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { can } from "../../acl/can";
import { useAuth } from "../../hooks/useAuth";
import { listAppointments, type Appointment } from "../../services/appointments";
import { AppointmentDetailModal } from "./AppointmentDetailModal";
import { CalendarFilters, CalendarToolbar } from "./CalendarControls";
import {
  CLOSING_HOUR,
  FULLCALENDAR_VIEW,
  KIND_ORDER,
  KIND_STYLE,
  LUNCH_END_HOUR,
  LUNCH_START_HOUR,
  OPENING_HOUR,
  appointmentKind,
  appointmentsOn,
  rangeTitle,
  shiftAnchor,
  visibleRange,
  type AppointmentKind,
  type CalendarView,
} from "./calendarModel";
import { NewAppointmentModal } from "./NewAppointmentModal";
import { StudentWeekView } from "./StudentWeekView";

// En la vista de mes no hay hora: la cita nueva empieza a esta hora.
const DEFAULT_HOUR = 8;
const HOUR_FORMAT = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
const ALL_VIEWS: CalendarView[] = ["dia", "semana", "mes", "estudiante"];

type LoadState = "loading" | "ready" | "error";

export function Calendar() {
  const { user } = useAuth();
  // Todo lo decide el permiso: ver (la ruta), agendar y editar.
  const canCreate = can(user, "calendar.create");
  const canEdit = can(user, "calendar.edit");
  // El estudiante solo recibe sus citas: no necesita ver por estudiante.
  const seesOthers = user?.role !== "estudiante";
  const views = seesOthers ? ALL_VIEWS : ALL_VIEWS.filter((item) => item !== "estudiante");

  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState<CalendarView>("semana");
  const [anchor, setAnchor] = useState(() => new Date());
  const [showSunday, setShowSunday] = useState(false);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<AppointmentKind>>(new Set());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [newStart, setNewStart] = useState<Date | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  // "Sin registrar" depende de la hora: se recalcula cada minuto.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const range = useMemo(() => visibleRange(view, anchor, showSunday), [view, anchor, showSunday]);
  // Milisegundos y no Date: las fechas cambian de identidad en cada render.
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    listAppointments({
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    })
      .then((items) => {
        if (!cancelled) {
          setAppointments(items);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [startMs, endMs, reloadToken]);

  // FullCalendar solo dibuja: la vista y la fecha las manda este estado.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api || view === "estudiante") {
      return;
    }
    const target = FULLCALENDAR_VIEW[view];
    if (api.view.type !== target) {
      api.changeView(target, anchor);
    } else {
      api.gotoDate(anchor);
    }
  }, [view, anchor]);

  const students = useMemo(() => {
    const byId = new Map(appointments.map((item) => [item.student.id, item.student]));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [appointments]);

  // Conteos con el filtro de estudiante (no con el de estado: las pastillas
  // dicen cuántas habría al mostrarlas).
  const forStudent = useMemo(
    () => (studentId == null ? appointments : appointments.filter((item) => item.student.id === studentId)),
    [appointments, studentId],
  );
  const inView = useMemo(() => {
    if (view === "mes") {
      return forStudent;
    }
    return forStudent.filter((item) =>
      range.days.some((day) => isSameDay(new Date(item.starts_at), day)),
    );
  }, [forStudent, range, view]);
  const counts = useMemo(() => {
    const result = Object.fromEntries(KIND_ORDER.map((kind) => [kind, 0])) as Record<AppointmentKind, number>;
    for (const item of inView) {
      result[appointmentKind(item, now)] += 1;
    }
    return result;
  }, [inView, now]);
  const visible = useMemo(
    () => forStudent.filter((item) => !hidden.has(appointmentKind(item, now))),
    [forStudent, hidden, now],
  );
  const events = useMemo(() => visible.map((item) => toEvent(item, now)), [visible, now]);

  function changeView(next: CalendarView) {
    setView(next);
  }

  function openDay(day: Date) {
    setAnchor(day);
    setView("dia");
  }

  function toggleKind(kind: AppointmentKind) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }

  function onSelect(info: DateSelectArg) {
    const start = new Date(info.start);
    if (info.allDay) {
      start.setHours(DEFAULT_HOUR, 0, 0, 0);
    }
    calendarRef.current?.getApi().unselect();
    setNewStart(start);
  }

  function onEventClick(info: EventClickArg) {
    setSelected(info.event.extendedProps.appointment as Appointment);
  }

  function renderDayHeader(arg: DayHeaderContentArg) {
    if (arg.view.type === FULLCALENDAR_VIEW.mes) {
      // En el mes, arg.date es una fecha interna en UTC (lunes 00:00 UTC es
      // domingo en El Salvador): el día de la semana sale de arg.text.
      return <span className="text-[11px] font-semibold uppercase">{arg.text.replace(".", "")}</span>;
    }
    const count = appointmentsOn(visible, arg.date).length;
    return (
      <span className={`flex items-end gap-2 px-1 py-1 ${arg.isToday ? "text-teal-700 dark:text-teal-300" : "text-slate-500 dark:text-slate-400"}`}>
        <span className={`text-2xl leading-none font-semibold tracking-tight ${arg.isToday ? "" : "text-slate-800 dark:text-slate-100"}`}>
          {format(arg.date, "d")}
        </span>
        <span className="pb-0.5 text-left text-[11px] leading-tight font-semibold uppercase">
          {format(arg.date, "EEE", { locale: es }).replace(".", "")}
          <span className="block font-normal normal-case text-slate-400">
            {count === 0 ? "libre" : `${count} ${count === 1 ? "cita" : "citas"}`}
          </span>
        </span>
        {arg.isToday ? (
          <span className="mb-1 ml-auto rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-semibold text-white">Hoy</span>
        ) : null}
      </span>
    );
  }

  function renderDayCell(arg: DayCellContentArg) {
    // FullCalendar también pide este contenido en las columnas de la
    // semana; el número y el aviso son solo de la vista Mes.
    if (arg.view.type !== FULLCALENDAR_VIEW.mes) {
      return null;
    }
    const pending = appointmentsOn(visible, arg.date).filter(
      (item) => appointmentKind(item, now) === "pendiente",
    ).length;
    return (
      <span className="flex w-full items-center justify-between gap-1">
        {pending > 0 ? (
          <span
            className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            title={`${pending} sin registrar`}
          >
            {pending} ⚠
          </span>
        ) : (
          <span />
        )}
        <span
          className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
            arg.isToday ? "bg-teal-700 text-white" : ""
          }`}
        >
          {arg.dayNumberText}
        </span>
      </span>
    );
  }

  return (
    <section className="flex h-full min-h-[36rem] flex-col rounded-2xl bg-white dark:bg-slate-900">
      <CalendarToolbar
        title={rangeTitle(view, anchor, range)}
        view={view}
        views={views}
        canCreate={canCreate}
        onPrevious={() => setAnchor((current) => shiftAnchor(view, current, -1))}
        onNext={() => setAnchor((current) => shiftAnchor(view, current, 1))}
        onToday={() => setAnchor(new Date())}
        onViewChange={changeView}
        onNew={() => setNewStart(suggestedStart())}
      />
      <CalendarFilters
        view={view}
        total={inView.length}
        counts={counts}
        hidden={hidden}
        onToggleKind={toggleKind}
        students={students}
        studentId={studentId}
        onStudentChange={setStudentId}
        showStudentFilter={seesOthers}
        showSunday={showSunday}
        onShowSundayChange={setShowSunday}
      />

      {loadState === "error" ? (
        <div className="flex items-center justify-between gap-3 bg-red-50 px-5 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300" role="alert">
          No se pudieron cargar las citas. Revisa tu conexión e intenta de nuevo.
          <button type="button" onClick={() => setReloadToken((token) => token + 1)} className="font-semibold hover:underline">
            Reintentar
          </button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-auto" aria-busy={loadState === "loading"}>
        {view === "estudiante" ? (
          <StudentWeekView
            days={range.days}
            appointments={visible}
            now={now}
            onOpen={setSelected}
            onOpenDay={openDay}
          />
        ) : (
          <div className="fouees-calendar h-full">
            <FullCalendar
              ref={calendarRef}
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
              locale={esLocale}
              initialView={FULLCALENDAR_VIEW[view]}
              initialDate={anchor}
              headerToolbar={false}
              firstDay={1}
              hiddenDays={view === "semana" && !showSunday ? [0] : []}
              allDaySlot={false}
              slotMinTime={`${String(OPENING_HOUR).padStart(2, "0")}:00:00`}
              slotMaxTime={`${CLOSING_HOUR}:00:00`}
              slotDuration="00:30:00"
              slotLabelFormat={HOUR_FORMAT}
              eventTimeFormat={HOUR_FORMAT}
              slotLaneClassNames={lunchClass}
              nowIndicator
              now={now}
              height="100%"
              expandRows
              dayMaxEvents={3}
              moreLinkContent={(arg: MoreLinkContentArg) => `+${arg.num} más`}
              moreLinkClick={(arg) => {
                openDay(arg.date);
                return "timeGridDay";
              }}
              events={events}
              selectable={canCreate}
              selectMirror
              select={onSelect}
              eventClick={onEventClick}
              eventContent={renderEvent}
              dayHeaderContent={renderDayHeader}
              dayCellContent={renderDayCell}
            />
          </div>
        )}
      </div>

      {newStart ? (
        <NewAppointmentModal
          start={newStart}
          onClose={() => setNewStart(null)}
          onCreated={() => {
            setNewStart(null);
            setReloadToken((token) => token + 1);
          }}
        />
      ) : null}
      {selected ? (
        <AppointmentDetailModal
          appointment={selected}
          canEdit={canEdit}
          pending={appointmentKind(selected, now) === "pendiente"}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            setReloadToken((token) => token + 1);
          }}
        />
      ) : null}
    </section>
  );
}

/** Franja de almuerzo rayada en las vistas por hora. */
function lunchClass(arg: SlotLaneContentArg): string[] {
  const hour = arg.time ? arg.time.milliseconds / 3_600_000 : null;
  return hour != null && hour >= LUNCH_START_HOUR && hour < LUNCH_END_HOUR ? ["fouees-lunch"] : [];
}

function toEvent(appointment: Appointment, now: Date): EventInput {
  const kind = appointmentKind(appointment, now);
  return {
    id: String(appointment.id),
    title: appointment.patient.name,
    start: appointment.starts_at,
    end: appointment.ends_at,
    classNames: ["fouees-event"],
    extendedProps: { appointment, kind },
  };
}

function renderEvent(info: EventContentArg) {
  const appointment = info.event.extendedProps.appointment as Appointment;
  const kind = info.event.extendedProps.kind as AppointmentKind;
  const style = KIND_STYLE[kind];
  const icon =
    kind === "pendiente" ? (
      <AlertTriangle className="size-3 shrink-0 text-amber-600" aria-label="Sin registrar" />
    ) : kind === "atendida" ? (
      <Check className="size-3 shrink-0" aria-label="Atendida" />
    ) : null;
  const crossed = kind === "cancelada" ? "line-through" : "";

  if (info.view.type === FULLCALENDAR_VIEW.mes) {
    return (
      <div
        className={`flex w-full items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] ${style.chip}`}
        style={{ boxShadow: `inset 2px 0 0 ${style.bar}` }}
        title={`${info.timeText} · ${appointment.patient.name} · ${style.label}`}
      >
        <span className="tabular-nums opacity-70">{info.timeText}</span>
        <span className={`truncate font-medium ${crossed}`}>{appointment.patient.name}</span>
        {icon}
      </div>
    );
  }
  const start = new Date(appointment.starts_at);
  const end = new Date(appointment.ends_at);
  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-lg px-2 py-1 ${style.chip}`}
      style={{ boxShadow: `inset 3px 0 0 ${style.bar}` }}
      title={`${format(start, "HH:mm")}–${format(end, "HH:mm")} · ${appointment.patient.name}\n${appointment.student.name}\n${style.label}`}
    >
      <p className={`flex items-center gap-1 truncate text-[11px] font-semibold ${crossed}`}>
        <span className="truncate">{appointment.patient.name}</span>
        {icon}
      </p>
      <p className="truncate text-[11px] opacity-75">{appointment.student.name}</p>
      {appointment.duration_minutes >= 60 ? (
        <p className="mt-auto truncate text-[10px] tabular-nums opacity-60">
          {format(start, "HH:mm")} – {format(end, "HH:mm")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Hora que propone "Nueva cita": la próxima media hora si cae dentro del
 * horario de la clínica; si no, a las 8:00 (hoy o mañana).
 */
function suggestedStart(): Date {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() < 30 ? 30 : 60);
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour < OPENING_HOUR) {
    date.setHours(DEFAULT_HOUR, 0);
  } else if (hour >= CLOSING_HOUR - 0.5) {
    date.setDate(date.getDate() + 1);
    date.setHours(DEFAULT_HOUR, 0);
  }
  return date;
}
