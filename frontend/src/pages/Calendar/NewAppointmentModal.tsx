import { useState } from "react";
import { toast } from "sonner";

import { Modal } from "../../components/Modal";
import { SearchCombobox } from "../../components/SearchCombobox";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import {
  createAppointment,
  getAppointmentError,
  listSchedulableAssignments,
  type SchedulableAssignment,
} from "../../services/appointments";
import {
  AppointmentFields,
  draftFrom,
  draftStartIso,
  type AppointmentDraft,
} from "./AppointmentFields";

export function NewAppointmentModal({
  start,
  onClose,
  onCreated,
}: {
  start: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [assignment, setAssignment] = useState<SchedulableAssignment | null>(null);
  const [draft, setDraft] = useState<AppointmentDraft>(() => draftFrom(start));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (!submitting) {
      onClose();
    }
  }

  async function submit() {
    if (assignment === null) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createAppointment({
        assignment: assignment.id,
        starts_at: draftStartIso(draft),
        duration_minutes: draft.duration,
        notes: draft.notes,
      });
      toast.success(`Cita agendada para ${assignment.patient}.`);
      onCreated();
    } catch (caught) {
      setError(getAppointmentError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen onClose={close} title="Nueva cita">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <SearchCombobox
          label="Paciente"
          placeholder="Buscar paciente o estudiante"
          listLabel="Casos activos"
          value={assignment}
          onChange={setAssignment}
          search={listSchedulableAssignments}
          getLabel={(item) => item.patient}
          getHint={(item) => item.student}
          emptyMessage="Ningún caso activo coincide."
          errorMessage="No se pudieron cargar los casos."
        />
        <AppointmentFields draft={draft} onChange={setDraft} />
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryActionClass} onClick={close}>
            Cancelar
          </button>
          <button
            type="submit"
            className={primaryActionClass}
            disabled={submitting || assignment === null}
          >
            {submitting ? "Guardando…" : "Agendar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
