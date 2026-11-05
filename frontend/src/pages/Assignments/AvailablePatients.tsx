import { differenceInCalendarDays } from "date-fns";
import { Clock, FileText, FilterX, Hourglass, PartyPopper, UserCheck, Users } from "../../components/icons";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { Modal } from "../../components/Modal";
import { ListFilter, ListSearch } from "../../components/listing/ListFilters";
import {
  HeaderCell,
  ListEmpty,
  ListError,
  ListPagination,
  ListSkeleton,
  SortableHeader,
} from "../../components/listing/ListTable";
import {
  FILTER_ALL,
  LIST_CELL,
  PRIMARY_BUTTON,
  ROW_ACTION,
  ROW_ICON_ACTION,
  SECONDARY_BUTTON,
} from "../../components/listing/styles";
import { useAuth } from "../../hooks/useAuth";
import {
  assignPatients,
  claimAvailablePatients,
  getAssignmentError,
  type AssignableStudent,
  type AssignmentRecord,
} from "../../services/assignments";
import { listClinicalAreas, type ClinicalAreaRecord } from "../../services/catalogs";
import {
  listAvailablePatients,
  patientFullName,
  patientInitials,
  type DirectoryOrderField,
  type DirectoryOrdering,
  type PatientListItem,
} from "../../services/patients";
import { IndicatedPractices } from "../Patients/IndicatedPractices";
import { PatientArea, PatientIdentity } from "../Patients/PatientCells";
import {
  TOOTH_OPTIONS,
  isToothFilter,
  treatmentInArea,
  treatmentOptions,
} from "../Patients/practiceFilters";
import { StudentCombobox } from "./StudentCombobox";

const PAGE_SIZE = 20;
const FILTER_PARAM_KEYS = ["search", "clinical_area", "tooth", "treatment"] as const;
/** Sin orden elegido: el que lleva más tiempo esperando va primero. */
const DEFAULT_ORDERING: DirectoryOrdering = "created_at";
/** Días en espera a partir de los cuales el badge avisa (ámbar / rojo). */
const WAIT_WARNING_DAYS = 14;
const WAIT_ALERT_DAYS = 30;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; patients: PatientListItem[]; count: number };

function isOrdering(value: string | null): value is DirectoryOrdering {
  return value !== null && ["name", "created_at"].includes(value.replace(/^-/, ""));
}

export function AvailablePatients() {
  const { user } = useAuth();
  // Quien asigna elige al estudiante; si no, el estudiante se elige a sí mismo.
  const assignsOthers = can(user, "assignments.assign_student");
  const canViewPatient = can(user, "patients.view");
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(Number(searchParams.get("page") || "1"), 1);
  const searchFromUrl = searchParams.get("search")?.trim() ?? "";
  const clinicalArea = searchParams.get("clinical_area") || undefined;
  const toothFromUrl = searchParams.get("tooth");
  const tooth = isToothFilter(toothFromUrl) ? toothFromUrl : undefined;
  const treatment = searchParams.get("treatment") || undefined;
  const orderingFromUrl = searchParams.get("ordering");
  const ordering = isOrdering(orderingFromUrl) ? orderingFromUrl : DEFAULT_ORDERING;

  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [areas, setAreas] = useState<ClinicalAreaRecord[]>([]);
  // Marcados con la casilla; se mantienen al cambiar de página o filtrar.
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
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    let cancelled = false;
    listClinicalAreas()
      .then((records) => !cancelled && setAreas(records))
      .catch(() => !cancelled && setAreas([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // Busca mientras se escribe, igual que el directorio.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextSearch = searchInput.trim();
      if (nextSearch === searchFromUrl) {
        return;
      }
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (nextSearch) {
          next.set("search", nextSearch);
        } else {
          next.delete("search");
        }
        next.delete("page");
        return next;
      });
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput, searchFromUrl, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    listAvailablePatients({
      page,
      search: searchFromUrl || undefined,
      clinicalArea,
      tooth,
      treatment,
      ordering,
    })
      .then((response) => {
        if (!cancelled) {
          setState({ status: "ready", patients: response.results, count: response.count });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudieron cargar los pacientes disponibles. Intenta de nuevo.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, searchFromUrl, clinicalArea, tooth, treatment, ordering, reloadToken]);

  const areaOptions = useMemo(
    () => [
      { value: FILTER_ALL, label: "Todas las áreas" },
      ...areas.map((area) => ({ value: area.slug, label: area.name })),
    ],
    [areas],
  );
  const practiceTreatmentOptions = useMemo(
    () => treatmentOptions(areas, clinicalArea),
    [areas, clinicalArea],
  );

  /** Cambia un parámetro de la URL y vuelve a la página 1. */
  function updateParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (value === undefined || value === FILTER_ALL) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.delete("page");
    setSearchParams(next);
  }

  function setAreaFilter(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === FILTER_ALL) {
      next.delete("clinical_area");
    } else {
      next.set("clinical_area", value);
    }
    // Un tratamiento de otra área dejaría el filtro sin resultados.
    if (treatment && !treatmentInArea(areas, treatment, value === FILTER_ALL ? undefined : value)) {
      next.delete("treatment");
    }
    next.delete("page");
    setSearchParams(next);
  }

  function toggleOrdering(field: DirectoryOrderField) {
    const current = ordering.replace(/^-/, "");
    const descending = ordering.startsWith("-");
    // Primer clic: nombre A→Z; espera, la más larga primero.
    const nextOrdering: DirectoryOrdering =
      current === field ? ((descending ? field : `-${field}`) as DirectoryOrdering) : field;
    updateParam("ordering", nextOrdering === DEFAULT_ORDERING ? undefined : nextOrdering);
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    for (const key of FILTER_PARAM_KEYS) {
      next.delete(key);
    }
    next.delete("page");
    setSearchInput("");
    setSearchParams(next);
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) {
      next.delete("page");
    } else {
      next.set("page", String(nextPage));
    }
    setSearchParams(next);
  }

  const hasFilters = Boolean(searchFromUrl || clinicalArea || tooth || treatment);
  const pageCount =
    state.status === "ready" ? Math.max(Math.ceil(state.count / PAGE_SIZE), 1) : 1;
  const pagePatients = state.status === "ready" ? state.patients : [];
  const checkedOnPage = pagePatients.filter((patient) => checked.has(patient.id)).length;

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

  /** Marca toda la página; si ya estaba toda marcada, la desmarca. */
  function togglePage() {
    setChecked((current) => {
      const next = new Map(current);
      const allChecked = pagePatients.every((patient) => next.has(patient.id));
      pagePatients.forEach((patient) => {
        if (allChecked) {
          next.delete(patient.id);
        } else {
          next.set(patient.id, patient);
        }
      });
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

  const total = state.status === "ready" ? state.count : null;

  return (
    <section className="glass relative flex h-full min-h-[36rem] flex-col rounded-[24px] p-2">
      {/* Sobre el vidrio: qué es la lista y cuántos esperan */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-1.5 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-lime dark:bg-lime dark:text-ink">
            <Hourglass className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
              Pacientes disponibles
              <span
                className="min-w-6 rounded-full bg-action px-1.5 py-px text-center text-[11px] font-semibold text-on-action tabular-nums"
                aria-label={total === null ? undefined : `${total} en espera`}
              >
                {total === null ? "·" : total.toLocaleString("es-SV")}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pendientes de asignación. Al {assignsOthers ? "asignar" : "elegir"} uno se abre la
              cita y el caso pasa a <b className="font-medium">Asignado</b>.
            </p>
          </div>
        </div>
        {canViewPatient ? (
          <Link
            to="/patients?case_status=pendiente"
            className="press anim-arrow glass-chip inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-white dark:text-slate-200 dark:hover:bg-white/10"
          >
            <Users className="size-4" aria-hidden="true" />
            Ver en el directorio
          </Link>
        ) : null}
      </div>

      {/* Bloque sólido: filtros, tabla y paginación */}
      <div className="relative flex min-h-0 flex-1 flex-col rounded-[18px] bg-surface">
      {/* Filtros: los mismos del directorio */}
      <div className="grid grid-cols-1 gap-3 px-5 pt-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
        <ListSearch
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Nombre, DUI, teléfono o pieza…"
          ariaLabel="Buscar paciente disponible"
          className="sm:col-span-2 xl:col-span-1"
        />
        <ListFilter
          id="available-area"
          label="Área clínica"
          value={clinicalArea ?? FILTER_ALL}
          options={areaOptions}
          onChange={setAreaFilter}
        />
        <ListFilter
          id="available-tooth"
          label="Pieza"
          value={tooth ?? FILTER_ALL}
          options={TOOTH_OPTIONS}
          onChange={(value) => updateParam("tooth", value)}
        />
        <ListFilter
          id="available-treatment"
          label="Tratamiento"
          value={treatment ?? FILTER_ALL}
          options={practiceTreatmentOptions}
          onChange={(value) => updateParam("treatment", value)}
        />
      </div>

      <div className="flex h-11 shrink-0 items-center justify-between px-5">
        <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {state.status === "ready" && state.count > 0
            ? hasFilters
              ? `${state.count} ${state.count === 1 ? "paciente coincide" : "pacientes coinciden"} con la búsqueda y los filtros`
              : ordering === DEFAULT_ORDERING
                ? "Ordenados por tiempo de espera: los que llevan más días van primero"
                : "Marca varios para asignarlos juntos"
            : ""}
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-lime-ink transition hover:bg-lime-soft"
          >
            <FilterX className="size-3.5" aria-hidden="true" />
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {/* Solo la tabla se desplaza; el encabezado queda fijo. Con la barra
          de selección visible se deja espacio para que no tape la última fila. */}
      <div
        className={`relative min-h-0 flex-1 overflow-auto px-2 ${checked.size > 0 ? "pb-16" : ""}`}
      >
        {state.status === "loading" ? <ListSkeleton /> : null}

        {state.status === "error" ? (
          <ListError
            message={state.message}
            onRetry={() => setReloadToken((token) => token + 1)}
          />
        ) : null}

        {state.status === "ready" && state.patients.length === 0 ? (
          hasFilters ? (
            <ListEmpty
              title="Ningún paciente coincide"
              description="Prueba con otra pieza o tratamiento, o quita algún filtro."
              action={
                <button type="button" onClick={clearFilters} className={PRIMARY_BUTTON}>
                  Limpiar filtros
                </button>
              }
            />
          ) : (
            <ListEmpty
              icon={PartyPopper}
              tone="accent"
              title="No hay pacientes esperando asignación"
              description="Cuando recepción registre un paciente nuevo aparecerá aquí."
            />
          )
        ) : null}

        {state.status === "ready" && state.patients.length > 0 ? (
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
            <caption className="sr-only">Pacientes disponibles para {verb.toLowerCase()}</caption>
            <thead className="sticky top-0 z-10">
              <tr>
                <HeaderCell className="w-10 pl-4">
                  <PageCheckbox
                    checked={checkedOnPage}
                    total={pagePatients.length}
                    onChange={togglePage}
                  />
                </HeaderCell>
                <SortableHeader
                  label="Paciente"
                  field="name"
                  ordering={ordering}
                  onSort={toggleOrdering}
                />
                <HeaderCell>Área</HeaderCell>
                <HeaderCell>Pieza · tratamiento</HeaderCell>
                {/* Más espera = registrado antes: "created_at" ascendente. */}
                <SortableHeader
                  label="En espera"
                  field="created_at"
                  ordering={invertOrdering(ordering)}
                  onSort={toggleOrdering}
                />
                <HeaderCell className="pr-4 text-right">
                  <span className="sr-only">Acciones</span>
                </HeaderCell>
              </tr>
            </thead>
            <tbody key={`${page}-${ordering}`} className="anim-fade">
              {state.patients.map((patient) => (
                <AvailableRow
                  key={patient.id}
                  patient={patient}
                  areas={areas}
                  verb={verb}
                  selected={checked.has(patient.id)}
                  canViewPatient={canViewPatient}
                  onToggle={() => toggleChecked(patient)}
                  onAssign={() => openAssignment([patient])}
                />
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {/* Barra de selección: flota sobre la tabla mientras haya marcados */}
      {checked.size > 0 && targets.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center px-4">
          <div
            role="region"
            aria-label="Pacientes seleccionados"
            className="pointer-events-auto flex items-center gap-4 rounded-2xl bg-slate-900 py-2 pr-2 pl-4 text-sm text-white shadow-2xl shadow-slate-900/30 dark:bg-slate-800 dark:ring-1 dark:ring-white/10"
          >
            <span>
              <b className="font-semibold tabular-nums">{checked.size}</b>{" "}
              {checked.size === 1 ? "seleccionado" : "seleccionados"}
            </span>
            <span className="h-4 w-px bg-white/20" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setChecked(new Map())}
              className="text-slate-300 transition hover:text-white"
            >
              Quitar selección
            </button>
            <button
              type="button"
              onClick={() => openAssignment([...checked.values()])}
              className="inline-flex items-center gap-2 rounded-xl bg-lime px-3.5 py-1.5 font-semibold text-slate-950 transition hover:bg-lime"
            >
              <UserCheck className="size-4" aria-hidden="true" />
              {verb} {patientsLabel(checked.size)}
            </button>
          </div>
        </div>
      ) : null}

      {state.status === "ready" && state.count > 0 ? (
        <ListPagination
          page={page}
          pageCount={pageCount}
          count={state.count}
          pageSize={PAGE_SIZE}
          noun="pacientes"
          label="Paginación de pacientes disponibles"
          onPageChange={goToPage}
        />
      ) : null}
      </div>

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
          <p className="-mt-2 text-sm text-slate-500 dark:text-slate-400">
            {targets.length === 1
              ? "Se abre la cita y el caso pasa a Asignado."
              : "Se abre una cita por paciente y cada caso pasa a Asignado."}
          </p>
          {targets.length > 1 ? (
            <ul aria-label="Pacientes a asignar" className="flex max-h-32 flex-wrap gap-2 overflow-auto">
              {targets.map((patient) => (
                <li
                  key={patient.id}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pr-3 pl-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-lime-soft text-[10px] font-semibold text-lime-ink">
                    {patientInitials(patient)}
                  </span>
                  {patientFullName(patient)}
                </li>
              ))}
            </ul>
          ) : null}
          {assignsOthers ? <StudentCombobox value={student} onChange={setStudent} /> : null}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Motivo <span className="text-slate-400">(opcional)</span>
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Ej. viene por dolor en una muela"
              className="w-full rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800 outline-none ring-lime-strong transition placeholder:text-slate-400 focus:bg-white focus:ring-2 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
            />
          </label>
          {formError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={SECONDARY_BUTTON} onClick={closeAssignment}>
              Cancelar
            </button>
            <button type="submit" className={PRIMARY_BUTTON} disabled={!canSubmit}>
              {submitting ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function AvailableRow({
  patient,
  areas,
  verb,
  selected,
  canViewPatient,
  onToggle,
  onAssign,
}: {
  patient: PatientListItem;
  areas: ClinicalAreaRecord[];
  verb: string;
  selected: boolean;
  canViewPatient: boolean;
  onToggle: () => void;
  onAssign: () => void;
}) {
  const stop = (event: MouseEvent) => event.stopPropagation();
  // Fila marcada: teñida y con la barra de acento fija (no solo al pasar el mouse).
  const cell = `${LIST_CELL} ${selected ? "bg-lime-soft group-hover:bg-lime-soft " : ""}`;
  const name = patientFullName(patient);

  return (
    <tr onClick={onToggle} className="group cursor-pointer">
      <td
        className={`${cell} pl-4 ${
          selected
            ? "shadow-[inset_3px_0_0_var(--action)]"
            : "shadow-[inset_3px_0_0_transparent] group-hover:shadow-[inset_3px_0_0_var(--action)]"
        }`}
        onClick={stop}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Seleccionar a ${name}`}
          className="size-4 accent-action"
        />
      </td>
      <td className={cell}>
        <PatientIdentity patient={patient} />
      </td>
      <td className={cell}>
        <PatientArea patient={patient} areas={areas} />
      </td>
      <td className={cell}>
        <IndicatedPractices practices={patient.indicated_practices} />
      </td>
      <td className={`${cell} whitespace-nowrap`}>
        <WaitingBadge since={patient.created_at} />
      </td>
      <td className={`${cell} pr-4 text-right`} onClick={stop}>
        <div className="inline-flex items-center gap-1">
          <button type="button" className={ROW_ACTION} onClick={onAssign}>
            <UserCheck className="size-3.5" aria-hidden="true" />
            {verb}
          </button>
          {canViewPatient ? (
            <Link
              to={`/patients/${patient.id}`}
              title="Ver ficha"
              aria-label={`Ver ficha de ${name}`}
              className={ROW_ICON_ACTION}
            >
              <FileText className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function WaitingBadge({ since }: { since: string }) {
  const days = Math.max(differenceInCalendarDays(new Date(), new Date(since)), 0);
  const tone =
    days >= WAIT_ALERT_DAYS
      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
      : days >= WAIT_WARNING_DAYS
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  const label = days === 0 ? "Hoy" : days === 1 ? "1 día" : `${days} días`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${tone}`}
      title={`Registrado ${new Date(since).toLocaleDateString("es-SV")}`}
    >
      <Clock className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Casilla del encabezado: marca la página; queda a medias si hay algunos. */
function PageCheckbox({
  checked,
  total,
  onChange,
}: {
  checked: number;
  total: number;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const partial = checked > 0 && checked < total;
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = partial;
    }
  }, [partial]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={total > 0 && checked === total}
      onChange={onChange}
      aria-label="Seleccionar todos los de esta página"
      className="size-4 align-middle accent-action"
    />
  );
}

/**
 * La columna "En espera" muestra la espera, no la fecha: más espera es
 * "created_at" ascendente, así que la flecha va al revés que el parámetro.
 */
function invertOrdering(ordering: DirectoryOrdering): string {
  if (!ordering.endsWith("created_at")) {
    return ordering;
  }
  return ordering.startsWith("-") ? "created_at" : "-created_at";
}

function patientsLabel(count: number): string {
  return count === 1 ? "1 paciente" : `${count} pacientes`;
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
