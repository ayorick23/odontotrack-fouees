import { format } from "date-fns";

import {
  APPOINTMENT_DURATIONS,
  DURATION_LABELS,
  type AppointmentDuration,
  type AppointmentStatus,
} from "../../services/appointments";

/** Valores del formulario de cita, en hora local. */
export type AppointmentDraft = {
  date: string;
  time: string;
  duration: AppointmentDuration;
  notes: string;
};

export function draftFrom(
  start: Date,
  duration: AppointmentDuration = 60,
  notes = "",
): AppointmentDraft {
  return { date: format(start, "yyyy-MM-dd"), time: format(start, "HH:mm"), duration, notes };
}

/** Fecha y hora locales del formulario → ISO (UTC) para la API. */
export function draftStartIso(draft: AppointmentDraft): string {
  return new Date(`${draft.date}T${draft.time}`).toISOString();
}

// Colores de la marca por estado: los mismos en el calendario y el detalle.
export const STATUS_COLORS: Record<
  AppointmentStatus,
  { background: string; text: string }
> = {
  programada: { background: "#2ad4c5", text: "#0f172a" },
  atendida: { background: "#8b5cf6", text: "#ffffff" },
  cancelada: { background: "#94a3b8", text: "#0f172a" },
};

const labelClass = "block text-sm text-slate-600 dark:text-slate-300";
const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export function AppointmentFields({
  draft,
  onChange,
}: {
  draft: AppointmentDraft;
  onChange: (draft: AppointmentDraft) => void;
}) {
  function update(changes: Partial<AppointmentDraft>) {
    onChange({ ...draft, ...changes });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Fecha
          <input
            type="date"
            required
            value={draft.date}
            onChange={(event) => update({ date: event.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Hora
          <input
            type="time"
            required
            value={draft.time}
            onChange={(event) => update({ time: event.target.value })}
            className={inputClass}
          />
        </label>
      </div>
      <label className={labelClass}>
        Duración
        <select
          value={draft.duration}
          onChange={(event) =>
            update({ duration: Number(event.target.value) as AppointmentDuration })
          }
          className={inputClass}
        >
          {APPOINTMENT_DURATIONS.map((duration) => (
            <option key={duration} value={duration}>
              {DURATION_LABELS[duration]}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Nota <span className="text-xs text-slate-400">(opcional)</span>
        <textarea
          rows={2}
          value={draft.notes}
          onChange={(event) => update({ notes: event.target.value })}
          className={inputClass}
        />
      </label>
    </>
  );
}
