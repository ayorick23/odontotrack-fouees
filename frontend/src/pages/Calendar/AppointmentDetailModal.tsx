import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Modal } from "../../components/Modal";
import {
  dangerActionClass,
  primaryActionClass,
  secondaryActionClass,
} from "../../lib/actions";
import {
  APPOINTMENT_STATUS_LABELS,
  DURATION_LABELS,
  getAppointmentError,
  setAppointmentStatus,
  updateAppointment,
  type Appointment,
} from "../../services/appointments";
import {
  AppointmentFields,
  STATUS_COLORS,
  draftFrom,
  draftStartIso,
  type AppointmentDraft,
} from "./AppointmentFields";

type Mode = "view" | "reschedule" | "confirm-cancel";

export function AppointmentDetailModal({
  appointment,
  canEdit,
  onClose,
  onChanged,
}: {
  appointment: Appointment;
  /** Permiso calendar.edit: reprogramar, marcar atendida o cancelar. */
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const start = new Date(appointment.starts_at);
  const end = new Date(appointment.ends_at);
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState<AppointmentDraft>(() =>
    draftFrom(start, appointment.duration_minutes, appointment.notes),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Solo las citas programadas se pueden cambiar.
  const editable = canEdit && appointment.status === "programada";
  const colors = STATUS_COLORS[appointment.status];

  function close() {
    if (!busy) {
      onClose();
    }
  }

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.success(message);
      onChanged();
    } catch (caught) {
      setError(getAppointmentError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen onClose={close} title={`Cita de ${appointment.patient.name}`}>
      {mode === "reschedule" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                updateAppointment(appointment.id, {
                  starts_at: draftStartIso(draft),
                  duration_minutes: draft.duration,
                  notes: draft.notes,
                }),
              "Cita reprogramada.",
            );
          }}
        >
          <AppointmentFields draft={draft} onChange={setDraft} />
          <ErrorMessage error={error} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={secondaryActionClass}
              onClick={() => setMode("view")}
              disabled={busy}
            >
              Volver
            </button>
            <button type="submit" className={primaryActionClass} disabled={busy}>
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Estudiante">{appointment.student.name}</Detail>
            <Detail label="Estado">
              <span
                className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: colors.background, color: colors.text }}
              >
                {APPOINTMENT_STATUS_LABELS[appointment.status]}
              </span>
            </Detail>
            <Detail label="Fecha">{capitalize(format(start, "EEEE d 'de' MMMM", { locale: es }))}</Detail>
            <Detail label="Horario">
              {format(start, "HH:mm")} – {format(end, "HH:mm")} ·{" "}
              {DURATION_LABELS[appointment.duration_minutes]}
            </Detail>
            {appointment.notes ? (
              <Detail label="Nota" wide>
                {appointment.notes}
              </Detail>
            ) : null}
          </dl>
          <ErrorMessage error={error} />
          {editable && mode === "view" ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={secondaryActionClass}
                onClick={() => setMode("reschedule")}
              >
                Reprogramar
              </button>
              <button
                type="button"
                className={secondaryActionClass}
                onClick={() => setMode("confirm-cancel")}
              >
                Cancelar cita
              </button>
              <button
                type="button"
                className={primaryActionClass}
                disabled={busy}
                onClick={() =>
                  void run(
                    () => setAppointmentStatus(appointment.id, "atendida"),
                    "Cita marcada como atendida.",
                  )
                }
              >
                Marcar atendida
              </button>
            </div>
          ) : null}
          {editable && mode === "confirm-cancel" ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <p className="mr-auto text-sm text-slate-600 dark:text-slate-300">
                ¿Cancelar esta cita? No se puede deshacer.
              </p>
              <button
                type="button"
                className={secondaryActionClass}
                onClick={() => setMode("view")}
                disabled={busy}
              >
                No
              </button>
              <button
                type="button"
                className={dangerActionClass}
                disabled={busy}
                onClick={() =>
                  void run(
                    () => setAppointmentStatus(appointment.id, "cancelada"),
                    "Cita cancelada.",
                  )
                }
              >
                Sí, cancelar
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function Detail({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}

/** "viernes 25 de septiembre" → "Viernes 25 de septiembre". */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function ErrorMessage({ error }: { error: string | null }) {
  if (error === null) {
    return null;
  }
  return (
    <p className="text-sm text-red-600" role="alert">
      {error}
    </p>
  );
}
