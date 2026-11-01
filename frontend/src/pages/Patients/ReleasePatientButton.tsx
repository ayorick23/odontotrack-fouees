import { Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { secondaryActionClass } from "../../lib/actions";
import { getAssignmentError, releaseAssignment } from "../../services/assignments";

// Devuelve el paciente al banco: el caso vuelve a pendiente y otro
// estudiante puede tomarlo. El expediente se conserva.
export function ReleasePatientButton({
  assignmentId,
  patientName,
  isOwnCase,
  onReleased,
}: {
  assignmentId: number;
  patientName: string;
  /** El estudiante libera su propio caso (cambia el texto del diálogo). */
  isOwnCase: boolean;
  onReleased: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await releaseAssignment(assignmentId);
      toast.success(`${patientName} volvió al banco de pacientes.`);
      setOpen(false);
      onReleased();
    } catch (requestError) {
      setError(getAssignmentError(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={secondaryActionClass} onClick={() => setOpen(true)}>
        <Undo2 className="size-4" />
        Liberar paciente
      </button>
      <ConfirmDeleteDialog
        open={open}
        title="¿Liberar este paciente?"
        description={
          isOwnCase
            ? `${patientName} volverá al banco y otro estudiante podrá tomarlo. Tus registros clínicos se conservan y se cancelan las citas programadas.`
            : `${patientName} dejará de estar asignado y volverá al banco de pacientes. El expediente se conserva y se cancelan las citas programadas.`
        }
        error={error}
        busy={busy}
        confirmLabel="Liberar paciente"
        busyLabel="Liberando..."
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
}
