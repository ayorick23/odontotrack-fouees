import { Search, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { Modal } from "../../components/Modal";
import { Table } from "../../components/Table";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import {
  assignPatients,
  claimAvailablePatients,
  getAssignmentError,
  type AssignableStudent,
  type AssignmentRecord,
} from "../../services/assignments";
import {
  areaLabel,
  listClinicalAreas,
  type ClinicalAreaRecord,
} from "../../services/catalogs";
import {
  listAvailablePatients,
  patientFullName,
  patientInitials,
  type PatientListItem,
} from "../../services/patients";
import { StudentCombobox } from "./StudentCombobox";

const PAGE_SIZE = 20;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; patients: PatientListItem[]; count: number };

export function AvailablePatients() {
  const { user } = useAuth();
  // Quien asigna elige al estudiante; si no, el estudiante se elige a sí mismo.
  const assignsOthers = can(user, "assignments.assign_student");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [areas, setAreas] = useState<ClinicalAreaRecord[]>([]);
  // Marcados con la casilla; se mantienen al cambiar de página o buscar.
  const [checked, setChecked] = useState<ReadonlyMap<number, PatientListItem>>(
    new Map(),
  );
  // Pacientes del modal abierto (vacío = cerrado).
  const [targets, setTargets] = useState<PatientListItem[]>([]);
  const [student, setStudent] = useState<AssignableStudent | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listClinicalAreas()
      .then((records) => {
        if (!cancelled) {
          setAreas(records);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAreas([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listAvailablePatients({ page, search })
      .then((response) => {
        if (!cancelled) {
          setState({
            status: "ready",
            patients: response.results,
            count: response.count,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudieron cargar los pacientes disponibles.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, reloadToken]);

  const pageCount =
    state.status === "ready" ? Math.max(Math.ceil(state.count / PAGE_SIZE), 1) : 1;

  const verb = assignsOthers ? "Asignar" : "Elegir";
  const canSubmit = !submitting && (!assignsOthers || student !== null);

  function toggleChecked(patient: PatientListItem) {
    setChecked((current) => {
      const next = new Map(current);
      if (next.has(patient.id)) {
        next.delete(patient.id);
      } else {
        next.set(patient.id, patient);
      }
      return next;
    });
  }

  function openAssignment(patients: PatientListItem[]) {
    setTargets(patients);
    setStudent(null);
    setReason("");
    setFormError(null);
  }

  function closeAssignment() {
    if (submitting) {
      return;
    }
    setTargets([]);
  }

  async function submitAssignment() {
    if (!canSubmit || targets.length === 0) {
      return;
    }
    const patients = targets.map((patient) => patient.id);
    setSubmitting(true);
    setFormError(null);
    try {
      // `student` solo tiene valor cuando quien asigna eligió a alguien.
      const assignments =
        student !== null
          ? await assignPatients({ patients, student: student.id, reason })
          : await claimAvailablePatients({ patients, reason });
      toast.success(successMessage(targets, assignments, student));
      setChecked((current) => {
        const next = new Map(current);
        patients.forEach((id) => next.delete(id));
        return next;
      });
      setTargets([]);
      setReloadToken((token) => token + 1);
    } catch (error) {
      setFormError(getAssignmentError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Pacientes disponibles
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {assignsOthers
            ? "Pendientes de asignación. Al asignar uno a un estudiante se abre la cita y el caso pasa a en proceso."
            : "Pendientes de asignación. Al elegir uno se abre la cita y el caso pasa a en proceso."}
        </p>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <form
            className="flex w-full max-w-md items-center gap-2 rounded-full bg-slate-50 px-3 py-2 dark:bg-slate-800"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <Search className="size-4 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nombre"
              aria-label="Buscar paciente disponible"
              className="w-full bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100"
            />
          </form>
          {checked.size > 0 ? (
            <button
              type="button"
              className={primaryActionClass}
              onClick={() => openAssignment([...checked.values()])}
            >
              <UserCheck className="size-4" />
              {verb} seleccionados ({checked.size})
            </button>
          ) : null}
        </div>

        {state.status === "loading" ? (
          <p className="px-2 py-10 text-center text-sm text-slate-500">Cargando…</p>
        ) : null}
        {state.status === "error" ? (
          <p className="px-2 py-10 text-center text-sm text-red-600">{state.message}</p>
        ) : null}
        {state.status === "ready" ? (
          <Table
            caption="Pacientes disponibles para elegir"
            rows={state.patients}
            emptyMessage="No hay pacientes pendientes de asignación."
            getRowKey={(patient) => patient.id}
            columns={[
              {
                header: "Selección",
                render: (patient) => (
                  <input
                    type="checkbox"
                    checked={checked.has(patient.id)}
                    onChange={() => toggleChecked(patient)}
                    aria-label={`Seleccionar a ${patientFullName(patient)}`}
                    className="size-4 accent-teal-600"
                  />
                ),
              },
              {
                header: "Paciente",
                render: (patient) => (
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                      {patientInitials(patient)}
                    </span>
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {patientFullName(patient)}
                      </p>
                      <p className="text-xs text-slate-500">{patient.dui}</p>
                    </div>
                  </div>
                ),
              },
              {
                header: "Área",
                render: (patient) =>
                  patient.clinical_area ? (
                    areaLabel(areas, patient.clinical_area)
                  ) : (
                    <span className="text-slate-400">Sin área</span>
                  ),
              },
              {
                header: "Teléfono",
                render: (patient) =>
                  patient.phone_number || (
                    <span className="text-slate-400">Sin teléfono</span>
                  ),
              },
              {
                header: "Acciones",
                align: "right",
                render: (patient) => (
                  <button
                    type="button"
                    className={primaryActionClass}
                    onClick={() => openAssignment([patient])}
                  >
                    <UserCheck className="size-4" />
                    {verb}
                  </button>
                ),
              },
            ]}
          />
        ) : null}

        {state.status === "ready" && state.count > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className={secondaryActionClass}
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Anterior
            </button>
            <span className="text-xs text-slate-500">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              className={secondaryActionClass}
              disabled={page >= pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </section>

      <Modal
        isOpen={targets.length > 0}
        onClose={closeAssignment}
        title={
          targets.length === 1
            ? `${verb} a ${patientFullName(targets[0])}`
            : `${verb} ${targets.length} pacientes`
        }
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAssignment();
          }}
        >
          {targets.length > 1 ? (
            <ul
              aria-label="Pacientes seleccionados"
              className="max-h-32 space-y-1 overflow-auto rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {targets.map((patient) => (
                <li key={patient.id}>{patientFullName(patient)}</li>
              ))}
            </ul>
          ) : null}
          {assignsOthers ? (
            <StudentCombobox value={student} onChange={setStudent} />
          ) : null}
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Motivo <span className="text-xs text-slate-400">(opcional)</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder="Ej. viene por dolor en una muela"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          {formError ? (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={secondaryActionClass}
              onClick={closeAssignment}
            >
              Cancelar
            </button>
            <button type="submit" className={primaryActionClass} disabled={!canSubmit}>
              {submitting ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function successMessage(
  patients: PatientListItem[],
  assignments: AssignmentRecord[],
  student: AssignableStudent | null,
): string {
  const owner = student ? `quedó asignado a ${student.name}` : "quedó en tu carga";
  if (patients.length === 1) {
    return `${patientFullName(patients[0])} ${owner}. Cita ${assignments[0].appointment_number}.`;
  }
  const owners = student ? `quedaron asignados a ${student.name}` : "quedaron en tu carga";
  return `${patients.length} pacientes ${owners}.`;
}
