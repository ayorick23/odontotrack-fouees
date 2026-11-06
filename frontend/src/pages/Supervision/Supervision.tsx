import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { GLASS_PANEL, PANEL_HEADER, PRIMARY_BUTTON, SOLID_BLOCK } from "../../components/listing/styles";
import { Table } from "../../components/Table";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import {
  finalizeAssignment,
  getAssignmentError,
  listFinalizableAssignments,
  type FinalizableAssignment,
  listInProgressAssignments,
  type InProgressAssignment,
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


const diagnosisStateLabel: Record<InProgressAssignment["diagnosis_state"], string>  = {
  none: "Sin diagnóstico",
  pending: "Por validar",
  validated: "Validado",
};

const diagnosisStateStyle: Record<InProgressAssignment["diagnosis_state"], string> = {
  none: "bg-slate-100 text-slate-500 dark:bg-white/[.06] dark:text-slate-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  validated: "bg-lime-soft text-lime-ink",
};


// Cola del docente: validar diagnósticos y finalizar los casos que ya
// tienen uno validado. Validar desbloquea finalizar, por eso al validar
// se recarga la segunda lista.
export function Supervision() {
  const { user } = useAuth();
  const canValidate = can(user, "diagnoses.validate");
  const canFinalize = can(user, "assignments.change_status");
  const [finalizableToken, setFinalizableToken] = useState(0);
  const [inProgressToken, setInProgressToken] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <PendingDiagnoses
        canValidate={canValidate}
        onValidated={() => {
          setFinalizableToken((token) => token + 1);
          setInProgressToken((token) => token + 1);
        }}
      />
      {canFinalize ? (
        <FinalizableCases 
          reloadToken={finalizableToken}
          onFinalized={() => setInProgressToken((token) => token + 1)}
        />
      ) : null}
      {canFinalize ? <InProgressCases reloadToken={inProgressToken} /> : null}
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
    <SupervisionPanel
        id="pending-diagnoses-title"
        title="Diagnósticos por validar"
        count={state.status === "ready" ? state.data.count : null}
    >

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
                className="lift rounded-2xl bg-slate-50 p-4 transition dark:bg-white/[.03]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      to={`/patients/${diagnosis.patient}`}
                      className="font-semibold text-ink hover:text-lime-ink hover:underline dark:text-white"
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
                      className={PRIMARY_BUTTON}
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
    </SupervisionPanel>
  );
}

function FinalizableCases({
  reloadToken, 
  onFinalized}:{
    reloadToken: number; 
    onFinalized: () => void;
  }){
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
      onFinalized();
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
            className="font-medium text-slate-800 hover:text-lime-ink hover:underline dark:text-slate-100"
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
    <SupervisionPanel
        id="finalizable-title"
        title="Casos listos para finalizar"
        count={state.status === "ready" ? state.data.length : null}
    >

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
    </SupervisionPanel>
  );
}

function InProgressCases({ reloadToken }: { reloadToken: number }) {
  const [state, setState] = useState<LoadState<InProgressAssignment[]>>({
    status: "loading",
  });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    listInProgressAssignments()
      .then((data) => {
        if (!cancelled) {
          setState({ status: "ready", data });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudieron cargar los casos asignados.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, retryToken]);

  const columns = useMemo(
    () => [
      {
        header: "Paciente",
        render: (row: InProgressAssignment) => (
          <Link
            to={`/patients/${row.patient}`}
            className="font-medium text-slate-800 hover:text-lime-ink hover:underline dark:text-slate-100"
          >
            {row.patient_name}
          </Link>
        ),
      },
      { header: "Estudiante", render: (row: InProgressAssignment) => row.student_name },
      { header: "Cita", render: (row: InProgressAssignment) => `#${row.appointment_number}` },
      {
        header: "Asignado",
        render: (row: InProgressAssignment) => formatDate(row.assigned_date),
      },
      {
        header: "Diagnóstico",
        // Ámbar = pide acción (como el contador del menú); lima = listo.
        render: (row: InProgressAssignment) => (
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${diagnosisStateStyle[row.diagnosis_state]}`}
          >
            {diagnosisStateLabel[row.diagnosis_state]}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <SupervisionPanel
        id="in-progress-title"
        title="Casos asignados"
        count={state.status === "ready" ? state.data.length : null}
    >

      {state.status === "loading" ? <LoadingMessage text="Cargando casos..." /> : null}

      {state.status === "error" ? (
        <ErrorMessage
          message={state.message}
          onRetry={() => setRetryToken((token) => token + 1)}
        />
      ) : null}

      {state.status === "ready" ? (
        <Table
          caption="Casos asignados"
          columns={columns}
          rows={state.data}
          getRowKey={(row) => row.id}
          emptyMessage="No hay casos asignados."
        />
      ) : null}
    </SupervisionPanel>
  );
}


/**
 * Sección con doble fondo: título y conteo sobre el vidrio, contenido en el
 * bloque sólido (identidad 2026-11).
 */
function SupervisionPanel({
  id,
  title,
  count,
  children,
}: {
  id: string;
  title: string;
  count: number | null;
  children: ReactNode;
}) {
  return (
    <section className={GLASS_PANEL} aria-labelledby={id}>
      <div className={PANEL_HEADER}>
        <div className="flex items-center gap-2">
          <h2 id={id} className="text-[15px] font-semibold tracking-tight text-ink dark:text-white">
            {title}
          </h2>
          {count !== null ? (
            <span className="num rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-lime dark:bg-lime dark:text-ink">
              {count}
            </span>
          ) : null}
        </div>
      </div>
      <div className={SOLID_BLOCK}>{children}</div>
    </section>
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
