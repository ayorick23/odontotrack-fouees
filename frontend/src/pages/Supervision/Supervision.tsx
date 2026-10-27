import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { Table } from "../../components/Table";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import {
  finalizeAssignment,
  getAssignmentError,
  listFinalizableAssignments,
  type FinalizableAssignment,
} from "../../services/assignments";
import {
  getClinicalRecordError,
  listPendingDiagnoses,
  validateDiagnosis,
  type DiagnosisRecord,
} from "../../services/clinicalRecords";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

const cardClass =
  "rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-5";

// Cola del docente: validar diagnósticos y finalizar los casos que ya
// tienen uno validado. Validar desbloquea finalizar, por eso al validar
// se recarga la segunda lista.
export function Supervision() {
  const { user } = useAuth();
  const canValidate = can(user, "diagnoses.validate");
  const canFinalize = can(user, "assignments.change_status");
  const [finalizableToken, setFinalizableToken] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <PendingDiagnoses
        canValidate={canValidate}
        onValidated={() => setFinalizableToken((token) => token + 1)}
      />
      {canFinalize ? <FinalizableCases reloadToken={finalizableToken} /> : null}
    </div>
  );
}

function PendingDiagnoses({
  canValidate,
  onValidated,
}: {
  canValidate: boolean;
  onValidated: () => void;
}) {
  const [state, setState] = useState<LoadState<{ items: DiagnosisRecord[]; count: number }>>({
    status: "loading",
  });
  const [reloadToken, setReloadToken] = useState(0);
  const [validatingId, setValidatingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    listPendingDiagnoses()
      .then((payload) => {
        if (!cancelled) {
          setState({
            status: "ready",
            data: { items: payload.results, count: payload.count },
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudieron cargar los diagnósticos por validar.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  async function handleValidate(diagnosis: DiagnosisRecord) {
    setValidatingId(diagnosis.id);
    try {
      await validateDiagnosis(diagnosis.id);
      toast.success(`Diagnóstico de ${diagnosis.patient_name} validado.`);
      setState((current) =>
        current.status === "ready"
          ? {
              status: "ready",
              data: {
                items: current.data.items.filter((item) => item.id !== diagnosis.id),
                count: current.data.count - 1,
              },
            }
          : current,
      );
      onValidated();
    } catch (error) {
      toast.error(getClinicalRecordError(error, "No se pudo validar el diagnóstico."));
    } finally {
      setValidatingId(null);
    }
  }

  return (
    <section className={cardClass} aria-labelledby="pending-diagnoses-title">
      <SectionHeader
        id="pending-diagnoses-title"
        title="Diagnósticos por validar"
        count={state.status === "ready" ? state.data.count : null}
      />

      {state.status === "loading" ? <LoadingMessage text="Cargando diagnósticos..." /> : null}

      {state.status === "error" ? (
        <ErrorMessage
          message={state.message}
          onRetry={() => setReloadToken((token) => token + 1)}
        />
      ) : null}

      {state.status === "ready" && state.data.items.length === 0 ? (
        <p className="px-2 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          No hay diagnósticos pendientes de validar.
        </p>
      ) : null}

      {state.status === "ready" && state.data.items.length > 0 ? (
        <>
          <ul className="flex flex-col gap-3">
            {state.data.items.map((diagnosis) => (
              <li
                key={diagnosis.id}
                className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      to={`/patients/${diagnosis.patient}`}
                      className="font-semibold text-slate-800 hover:text-brand dark:text-slate-100"
                    >
                      {diagnosis.patient_name}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {diagnosis.student_name ?? "Sin estudiante"} ·{" "}
                      {formatDateTime(diagnosis.updated_at)}
                    </p>
                  </div>
                  {canValidate ? (
                    <button
                      type="button"
                      className={primaryActionClass}
                      disabled={validatingId !== null}
                      onClick={() => handleValidate(diagnosis)}
                    >
                      {validatingId === diagnosis.id ? "Validando..." : "Validar"}
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                  {diagnosis.content}
                </p>
              </li>
            ))}
          </ul>
          {state.data.count > state.data.items.length ? (
            <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
              Mostrando {state.data.items.length} de {state.data.count}. Valida estos
              y recarga para ver el resto.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function FinalizableCases({ reloadToken }: { reloadToken: number }) {
  const [state, setState] = useState<LoadState<FinalizableAssignment[]>>({
    status: "loading",
  });
  const [retryToken, setRetryToken] = useState(0);
  const [pending, setPending] = useState<FinalizableAssignment | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    listFinalizableAssignments()
      .then((data) => {
        if (!cancelled) {
          setState({ status: "ready", data });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudieron cargar los casos listos para finalizar.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, retryToken]);

  const closeDialog = useCallback(() => {
    setPending(null);
    setDialogError(null);
  }, []);

  async function handleFinalize() {
    if (pending === null) {
      return;
    }
    setBusy(true);
    setDialogError(null);
    try {
      await finalizeAssignment(pending.id);
      toast.success(`Caso de ${pending.patient_name} finalizado.`);
      setState((current) =>
        current.status === "ready"
          ? { status: "ready", data: current.data.filter((item) => item.id !== pending.id) }
          : current,
      );
      closeDialog();
    } catch (error) {
      setDialogError(getAssignmentError(error));
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo(
    () => [
      {
        header: "Paciente",
        render: (row: FinalizableAssignment) => (
          <Link
            to={`/patients/${row.patient}`}
            className="font-medium text-slate-800 hover:text-brand dark:text-slate-100"
          >
            {row.patient_name}
          </Link>
        ),
      },
      { header: "Estudiante", render: (row: FinalizableAssignment) => row.student_name },
      { header: "Cita", render: (row: FinalizableAssignment) => `#${row.appointment_number}` },
      {
        header: "Asignado",
        render: (row: FinalizableAssignment) => formatDate(row.assigned_date),
      },
      {
        header: "Acciones",
        align: "right" as const,
        render: (row: FinalizableAssignment) => (
          <button
            type="button"
            className={secondaryActionClass}
            onClick={() => setPending(row)}
          >
            Finalizar caso
          </button>
        ),
      },
    ],
    [],
  );

  return (
    <section className={cardClass} aria-labelledby="finalizable-title">
      <SectionHeader
        id="finalizable-title"
        title="Casos listos para finalizar"
        count={state.status === "ready" ? state.data.length : null}
      />

      {state.status === "loading" ? <LoadingMessage text="Cargando casos..." /> : null}

      {state.status === "error" ? (
        <ErrorMessage
          message={state.message}
          onRetry={() => setRetryToken((token) => token + 1)}
        />
      ) : null}

      {state.status === "ready" ? (
        <Table
          caption="Casos listos para finalizar"
          columns={columns}
          rows={state.data}
          getRowKey={(row) => row.id}
          emptyMessage="No hay casos activos con diagnóstico validado."
        />
      ) : null}

      <ConfirmDeleteDialog
        open={pending !== null}
        title="¿Finalizar este caso?"
        description={
          pending
            ? `El caso de ${pending.patient_name} quedará finalizado y ${pending.student_name} ya no podrá registrar información clínica. No se puede deshacer.`
            : undefined
        }
        error={dialogError}
        busy={busy}
        confirmLabel="Finalizar caso"
        busyLabel="Finalizando..."
        onCancel={closeDialog}
        onConfirm={handleFinalize}
      />
    </section>
  );
}

function SectionHeader({
  id,
  title,
  count,
}: {
  id: string;
  title: string;
  count: number | null;
}) {
  return (
    <div className="mb-4 flex items-center gap-2 px-1">
      <h2 id={id} className="text-base font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h2>
      {count !== null ? (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function LoadingMessage({ text }: { text: string }) {
  return (
    <p className="px-2 py-10 text-center text-sm text-slate-500 dark:text-slate-400">{text}</p>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="px-2 py-8 text-center">
      <p className="text-sm text-red-700 dark:text-red-400" role="alert">
        {message}
      </p>
      <button type="button" onClick={onRetry} className={`${primaryActionClass} mt-4`}>
        Reintentar
      </button>
    </div>
  );
}

function formatDate(value: string): string {
  return format(new Date(`${value}T00:00:00`), "d MMM yyyy", { locale: es });
}

function formatDateTime(value: string): string {
  return format(new Date(value), "d MMM yyyy, HH:mm", { locale: es });
}
