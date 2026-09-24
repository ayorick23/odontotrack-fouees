import { Search, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Modal } from "../../components/Modal";
import { Table } from "../../components/Table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import {
  claimAvailablePatient,
  getClaimError,
  PRIORITY_LABELS,
  type AssignmentPriority,
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

const PAGE_SIZE = 20;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; patients: PatientListItem[]; count: number };

export function AvailablePatients() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [areas, setAreas] = useState<ClinicalAreaRecord[]>([]);
  const [selected, setSelected] = useState<PatientListItem | null>(null);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<AssignmentPriority>("media");
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

  function openClaim(patient: PatientListItem) {
    setSelected(patient);
    setReason("");
    setPriority("media");
    setFormError(null);
  }

  function closeClaim() {
    if (submitting) {
      return;
    }
    setSelected(null);
  }

  async function submitClaim() {
    if (selected === null) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const assignment = await claimAvailablePatient({
        patient: selected.id,
        reason,
        priority,
      });
      toast.success(
        `${patientFullName(selected)} quedó en tu carga. Cita ${assignment.appointment_number}.`,
      );
      setSelected(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      setFormError(getClaimError(error));
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
          Pendientes de asignación. Al elegir uno se abre la cita y el caso pasa a en proceso.
        </p>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-5">
        <form
          className="mb-4 flex max-w-md items-center gap-2 rounded-full bg-slate-50 px-3 py-2 dark:bg-slate-800"
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
                    onClick={() => openClaim(patient)}
                  >
                    <UserCheck className="size-4" />
                    Elegir
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
        isOpen={selected !== null}
        onClose={closeClaim}
        title={selected ? `Elegir a ${patientFullName(selected)}` : "Elegir paciente"}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitClaim();
          }}
        >
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Motivo de ingreso
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              required
              placeholder="Ej. dolor en molar inferior"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Prioridad
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as AssignmentPriority)}
            >
              <SelectTrigger className="mt-1 w-full" aria-label="Prioridad">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as AssignmentPriority[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {formError ? (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryActionClass} onClick={closeClaim}>
              Cancelar
            </button>
            <button
              type="submit"
              className={primaryActionClass}
              disabled={submitting || reason.trim() === ""}
            >
              {submitting ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
