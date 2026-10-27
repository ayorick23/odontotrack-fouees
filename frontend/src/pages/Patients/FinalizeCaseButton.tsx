import { CircleCheckBig } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { secondaryActionClass } from "../../lib/actions";
import { finalizeAssignment, getAssignmentError } from "../../services/assignments";

// Cierra el caso desde la ficha. Si aún no hay diagnóstico validado, el
// backend lo rechaza y el motivo se muestra en el diálogo.
export function FinalizeCaseButton({
  assignmentId,
  patientName,
  onFinalized,
}: {
  assignmentId: number;
  patientName: string;
  onFinalized: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await finalizeAssignment(assignmentId);
      toast.success(`Caso de ${patientName} finalizado.`);
      setOpen(false);
      onFinalized();
    } catch (requestError) {
      setError(getAssignmentError(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={secondaryActionClass} onClick={() => setOpen(true)}>
        <CircleCheckBig className="size-4" />
        Finalizar caso
      </button>
      <ConfirmDeleteDialog
        open={open}
        title="¿Finalizar este caso?"
        description={`El caso de ${patientName} quedará finalizado y el estudiante ya no podrá registrar información clínica. No se puede deshacer.`}
        error={error}
        busy={busy}
        confirmLabel="Finalizar caso"
        busyLabel="Finalizando..."
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
        onConfirm={handleConfirm}
      />
    </>
  );
}
