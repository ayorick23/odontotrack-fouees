import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventInput,
  EventSourceFuncArg,
} from "@fullcalendar/core";
import esLocale from "@fullcalendar/core/locales/es";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { can } from "../../acl/can";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass } from "../../lib/actions";
import {
  APPOINTMENT_STATUS_LABELS,
  listAppointments,
  type Appointment,
  type AppointmentStatus,
} from "../../services/appointments";
import { AppointmentDetailModal } from "./AppointmentDetailModal";
import { STATUS_COLORS } from "./AppointmentFields";
import { NewAppointmentModal } from "./NewAppointmentModal";

// Horario de la clínica que se muestra en las vistas por hora.
const OPENING_HOUR = 7;
const CLOSING_HOUR = 19;
// En la vista de mes no hay hora: la cita nueva empieza a esta hora.
const DEFAULT_HOUR = 8;
const HOUR_FORMAT = { hour: "2-digit", minute: "2-digit", hour12: false } as const;

export function Calendar() {
  const { user } = useAuth();
  // Todo lo decide el permiso: ver (la ruta), agendar y editar.
  const canCreate = can(user, "calendar.create");
  const canEdit = can(user, "calendar.edit");
  const calendarRef = useRef<FullCalendar>(null);
  const [newStart, setNewStart] = useState<Date | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [loadError, setLoadError] = useState(false);

  const fetchEvents = useCallback(
    (
      info: EventSourceFuncArg,
      success: (events: EventInput[]) => void,
      failure: (error: Error) => void,
    ) => {
      listAppointments({ start: info.startStr, end: info.endStr })
        .then((appointments) => {
          setLoadError(false);
          success(appointments.map(toEvent));
        })
        .catch((error: Error) => {
          setLoadError(true);
          failure(error);
        });
    },
    [],
  );

  function refresh() {
    calendarRef.current?.getApi().refetchEvents();
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusLegend />
        {canCreate ? (
          <button
            type="button"
            className={primaryActionClass}
            onClick={() => setNewStart(suggestedStart())}
          >
            <Plus className="size-4" />
            Nueva cita
          </button>
        ) : null}
      </div>

      {loadError ? (
        <p className="text-sm text-red-600" role="alert">
          No se pudieron cargar las citas. Revisa tu conexión e intenta de nuevo.
        </p>
      ) : null}

      <section className="fouees-calendar rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/15 sm:p-5">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
          locale={esLocale}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,dayGridMonth",
          }}
          firstDay={1}
          allDaySlot={false}
          slotMinTime={`${String(OPENING_HOUR).padStart(2, "0")}:00:00`}
          slotMaxTime={`${CLOSING_HOUR}:00:00`}
          slotDuration="00:30:00"
          slotLabelFormat={HOUR_FORMAT}
          eventTimeFormat={HOUR_FORMAT}
          nowIndicator
          height="auto"
          dayMaxEvents={3}
          events={fetchEvents}
          selectable={canCreate}
          selectMirror
          select={onSelect}
          eventClick={onEventClick}
          eventContent={renderEvent}
        />
      </section>

      {newStart ? (
        <NewAppointmentModal
          start={newStart}
          onClose={() => setNewStart(null)}
          onCreated={() => {
            setNewStart(null);
            refresh();
          }}
        />
      ) : null}
      {selected ? (
        <AppointmentDetailModal
          appointment={selected}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function toEvent(appointment: Appointment): EventInput {
  const colors = STATUS_COLORS[appointment.status];
  return {
    id: String(appointment.id),
    title: appointment.patient.name,
    start: appointment.starts_at,
    end: appointment.ends_at,
    backgroundColor: colors.background,
    borderColor: colors.background,
    textColor: colors.text,
    classNames: appointment.status === "cancelada" ? ["line-through", "opacity-70"] : [],
    extendedProps: { appointment },
  };
}

function renderEvent(info: EventContentArg) {
  const appointment = info.event.extendedProps.appointment as Appointment;
  return (
    <div className="overflow-hidden px-1 py-0.5 text-[11px] leading-tight">
      <p className="truncate font-semibold">
        {info.timeText} · {appointment.patient.name}
      </p>
      <p className="truncate opacity-80">{appointment.student.name}</p>
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

function StatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Estados de cita">
      {(Object.keys(STATUS_COLORS) as AppointmentStatus[]).map((status) => (
        <li
          key={status}
          className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[status].background }}
          />
          {APPOINTMENT_STATUS_LABELS[status]}
        </li>
      ))}
    </ul>
  );
}
