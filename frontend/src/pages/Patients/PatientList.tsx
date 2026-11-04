import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  FileText,
  FilterX,
  Pencil,
  PencilOff,
  Search,
  SearchX,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useAuth } from "../../hooks/useAuth";
import {
  areaLabel,
  listClinicalAreas,
  treatmentLabel,
  type ClinicalAreaRecord,
} from "../../services/catalogs";
import {
  CASE_STATUS_LABELS,
  deletePatient,
  exportPatients,
  listAssignees,
  listPatients,
  patientDocumentLabel,
  patientFullName,
  patientInitials,
  type CaseStatus,
  type DirectoryOrderField,
  type DirectoryOrdering,
  type DirectoryPeriod,
  type PatientAssignee,
  type PatientListItem,
} from "../../services/patients";
import { CASE_STATUS_ORDER, useChartTheme } from "../Dashboard/chartColors";
import { IndicatedPractices } from "./IndicatedPractices";
import {
  PRACTICE_ALL,
  TOOTH_OPTIONS,
  isToothFilter,
  treatmentInArea,
  treatmentOptions,
} from "./practiceFilters";

const PAGE_SIZE = 20;
const ALL = "todos";
const PERIOD_FILTERS: Array<{ value: DirectoryPeriod | typeof ALL; label: string; hint: string }> = [
  { value: ALL, label: "Todos", hint: "Todos los registrados" },
  { value: "1m", label: "1M", hint: "Registrados en el último mes" },
  { value: "6m", label: "6M", hint: "Registrados en los últimos 6 meses" },
  { value: "1a", label: "1A", hint: "Registrados en el último año" },
];
const FILTER_PARAM_KEYS = ["clinical_area", "assigned_to", "tooth", "treatment"] as const;
/** Sin orden elegido: los más recientes primero. */
const DEFAULT_ORDERING: DirectoryOrdering = "-created_at";
const TAB_LABELS: Record<CaseStatus, string> = {
  pendiente: "Pendientes",
  en_proceso: "Asignados",
  finalizado: "Finalizados",
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      patients: PatientListItem[];
      count: number;
      statusCounts: Record<CaseStatus, number>;
    };

function isDirectoryPeriod(value: string | null): value is DirectoryPeriod {
  return value === "1m" || value === "6m" || value === "1a";
}

function isCaseStatus(value: string | null): value is CaseStatus {
  return value === "pendiente" || value === "en_proceso" || value === "finalizado";
}

function isAssigneeFilter(value: string | null): value is string {
  return value === "unassigned" || (value !== null && /^\d+$/.test(value));
}

function isOrdering(value: string | null): value is DirectoryOrdering {
  return value !== null && ["name", "created_at"].includes(value.replace(/^-/, ""));
}

export function PatientList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(Number(searchParams.get("page") || "1"), 1);
  const searchFromUrl = searchParams.get("search")?.trim() ?? "";
  const periodFromUrl = searchParams.get("period");
  const period = isDirectoryPeriod(periodFromUrl) ? periodFromUrl : undefined;
  const statusFromUrl = searchParams.get("case_status");
  const caseStatus = isCaseStatus(statusFromUrl) ? statusFromUrl : undefined;
  const clinicalArea = searchParams.get("clinical_area") || undefined;
  const assignedFromUrl = searchParams.get("assigned_to");
  const assignedTo = isAssigneeFilter(assignedFromUrl) ? assignedFromUrl : undefined;
  const toothFromUrl = searchParams.get("tooth");
  const tooth = isToothFilter(toothFromUrl) ? toothFromUrl : undefined;
  const treatment = searchParams.get("treatment") || undefined;
  const orderingFromUrl = searchParams.get("ordering");
  const ordering = isOrdering(orderingFromUrl) ? orderingFromUrl : DEFAULT_ORDERING;

  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const [reloadToken, setReloadToken] = useState(0);
  const [assignees, setAssignees] = useState<PatientAssignee[]>([]);
  const [areas, setAreas] = useState<ClinicalAreaRecord[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pendingDelete, setPendingDelete] = useState<PatientListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const canRegister = can(user, "patients.create");
  const canView = can(user, "patients.view");
  const canEdit = can(user, "patients.edit");
  const canRemove = can(user, "patients.delete");
  const canExport = can(user, "patients.export");
  const isStudent = user?.role === "estudiante";

  const filters = {
    search: searchFromUrl || undefined,
    period,
    caseStatus,
    clinicalArea,
    assignedTo,
    tooth,
    treatment,
    ordering,
  };

  async function handleExport() {
    setExporting(true);
    try {
      await exportPatients(filters);
    } catch {
      toast.error("No se pudo exportar el directorio.");
    } finally {
      setExporting(false);
    }
  }

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
    listAssignees()
      .then((rows) => !cancelled && setAssignees(rows))
      .catch(() => !cancelled && setAssignees([]));
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    listPatients({
      page,
      search: searchFromUrl || undefined,
      period,
      caseStatus,
      clinicalArea,
      assignedTo,
      tooth,
      treatment,
      ordering,
    })
      .then((payload) => {
        if (!cancelled) {
          setState({
            status: "ready",
            patients: payload.results,
            count: payload.count,
            statusCounts: payload.status_counts,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudo cargar el directorio. Intenta de nuevo.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    page,
    searchFromUrl,
    period,
    caseStatus,
    clinicalArea,
    assignedTo,
    tooth,
    treatment,
    ordering,
    reloadToken,
  ]);

  /** Cambia un parámetro de la URL y vuelve a la página 1. */
  function updateParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (value === undefined || value === ALL) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.delete("page");
    setSearchParams(next);
  }

  function setAreaFilter(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === ALL) {
      next.delete("clinical_area");
    } else {
      next.set("clinical_area", value);
    }
    // Un tratamiento de otra área dejaría el filtro sin resultados.
    if (treatment && !treatmentInArea(areas, treatment, value === ALL ? undefined : value)) {
      next.delete("treatment");
    }
    next.delete("page");
    setSearchParams(next);
  }

  function toggleOrdering(field: DirectoryOrderField) {
    const current = ordering.replace(/^-/, "");
    const descending = ordering.startsWith("-");
    // Primer clic: nombre A→Z, fecha más reciente primero.
    const nextOrdering: DirectoryOrdering =
      current === field
        ? ((descending ? field : `-${field}`) as DirectoryOrdering)
        : field === "name"
          ? "name"
          : "-created_at";
    updateParam("ordering", nextOrdering === DEFAULT_ORDERING ? undefined : nextOrdering);
  }

  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    for (const key of [...FILTER_PARAM_KEYS, "search", "period"]) {
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

  const hasFilters = Boolean(
    searchFromUrl || period || clinicalArea || assignedTo || tooth || treatment,
  );
  const pageCount =
    state.status === "ready" ? Math.max(Math.ceil(state.count / PAGE_SIZE), 1) : 1;

  const assigneeOptions = useMemo(
    () => [
      { value: ALL, label: "Cualquiera" },
      { value: "unassigned", label: "Sin asignar" },
      ...assignees.map((student) => ({ value: String(student.id), label: student.name })),
    ],
    [assignees],
  );
  const areaOptions = useMemo(
    () => [
      { value: ALL, label: "Todas las áreas" },
      ...areas.map((area) => ({ value: area.slug, label: area.name })),
    ],
    [areas],
  );
  const practiceTreatmentOptions = useMemo(
    () => treatmentOptions(areas, clinicalArea),
    [areas, clinicalArea],
  );

  async function confirmDelete() {
    if (pendingDelete === null) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePatient(pendingDelete.id);
      toast.warning(`Se eliminó a ${patientFullName(pendingDelete)}.`);
      setPendingDelete(null);
      setReloadToken((token) => token + 1);
    } catch {
      const message =
        "No se pudo borrar el paciente. Puede estar asignado o no tienes permiso.";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="flex h-full min-h-[36rem] flex-col rounded-2xl bg-white dark:bg-slate-900">
      {/* Pestañas de estado + periodo + acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 pt-3 dark:border-slate-800">
        <StatusTabs
          selected={caseStatus}
          counts={state.status === "ready" ? state.statusCounts : null}
          onSelect={(value) => updateParam("case_status", value)}
        />
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <div
            className="flex gap-0.5 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
            role="group"
            aria-label="Filtrar por fecha de registro"
          >
            {PERIOD_FILTERS.map((filter) => {
              const selected = filter.value === ALL ? period === undefined : period === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  title={filter.hint}
                  aria-pressed={selected}
                  onClick={() => updateParam("period", filter.value)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    selected
                      ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          {canExport ? (
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="size-4" aria-hidden="true" />
              {exporting ? "Exportando…" : "Exportar CSV"}
            </button>
          ) : null}
          {canRegister ? (
            <Link
              to="/patients/new"
              className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-900/20 transition hover:bg-teal-800 active:scale-[.98]"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              Registrar paciente
            </Link>
          ) : null}
        </div>
      </div>

      {/* Filtros con la etiqueta encima */}
      <div className="grid grid-cols-1 gap-3 px-5 pt-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
        <label className="block sm:col-span-2 xl:col-span-1">
          <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Buscar
          </span>
          <span className="flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm ring-teal-600/40 transition focus-within:bg-white focus-within:ring-2 dark:bg-slate-800 dark:focus-within:bg-slate-900">
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nombre, DUI, teléfono o pieza…"
              aria-label="Buscar paciente"
              className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </span>
        </label>
        <DirectoryFilter
          id="directory-area"
          label="Área clínica"
          value={clinicalArea ?? ALL}
          options={areaOptions}
          onChange={setAreaFilter}
        />
        <DirectoryFilter
          id="directory-tooth"
          label="Pieza"
          value={tooth ?? PRACTICE_ALL}
          options={TOOTH_OPTIONS}
          onChange={(value) => updateParam("tooth", value)}
        />
        <DirectoryFilter
          id="directory-treatment"
          label="Tratamiento"
          value={treatment ?? PRACTICE_ALL}
          options={practiceTreatmentOptions}
          onChange={(value) => updateParam("treatment", value)}
        />
        <DirectoryFilter
          id="directory-assignee"
          label="Asignado a"
          value={assignedTo ?? ALL}
          options={assigneeOptions}
          onChange={(value) =>
            updateParam("assigned_to", isAssigneeFilter(value) ? value : ALL)
          }
        />
      </div>

      <div className="flex h-11 shrink-0 items-center justify-between px-5">
        <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {state.status === "ready"
            ? hasFilters
              ? `${state.count} ${state.count === 1 ? "paciente coincide" : "pacientes coinciden"} con la búsqueda y los filtros`
              : canView
                ? "Haz clic en una fila para abrir la ficha"
                : ""
            : ""}
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-teal-700 transition hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/50"
          >
            <FilterX className="size-3.5" aria-hidden="true" />
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {/* Solo la tabla se desplaza; el encabezado queda fijo */}
      <div className="relative min-h-0 flex-1 overflow-auto px-2">
        {state.status === "loading" ? <DirectorySkeleton /> : null}

        {state.status === "error" ? (
          <div className="px-2 py-12 text-center">
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {state.message}
            </p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="mt-4 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {state.status === "ready" && state.patients.length === 0 ? (
          <EmptyDirectory
            filtered={hasFilters}
            status={caseStatus}
            onClear={clearFilters}
          />
        ) : null}

        {state.status === "ready" && state.patients.length > 0 ? (
          <table className="w-full min-w-[960px] border-separate border-spacing-0 text-left text-sm">
            <caption className="sr-only">Directorio de pacientes</caption>
            <thead className="sticky top-0 z-10">
              <tr>
                <SortableHeader
                  label="Paciente"
                  field="name"
                  ordering={ordering}
                  onSort={toggleOrdering}
                  className="pl-4"
                />
                <HeaderCell>Área</HeaderCell>
                <HeaderCell>Pieza · tratamiento</HeaderCell>
                <HeaderCell>Asignado a</HeaderCell>
                <HeaderCell>Estado</HeaderCell>
                <SortableHeader
                  label="Registrado"
                  field="created_at"
                  ordering={ordering}
                  onSort={toggleOrdering}
                />
                <HeaderCell className="pr-4 text-right">
                  <span className="sr-only">Acciones</span>
                </HeaderCell>
              </tr>
            </thead>
            <tbody>
              {state.patients.map((patient) => (
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  areas={areas}
                  canView={canView}
                  canEdit={canEdit}
                  // Lo que el estudiante ve y no puede editar son sus
                  // casos finalizados (EstudianteEditsOwnOrAvailablePatient).
                  editBlocked={isStudent && patient.case_status === "finalizado"}
                  onOpen={() => navigate(`/patients/${patient.id}`)}
                  onDelete={
                    canRemove
                      ? () => {
                          setDeleteError(null);
                          setPendingDelete(patient);
                        }
                      : undefined
                  }
                />
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {state.status === "ready" && state.count > 0 ? (
        <Pagination
          page={page}
          pageCount={pageCount}
          count={state.count}
          onPageChange={goToPage}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title={
          pendingDelete
            ? `¿Eliminar el paciente “${patientFullName(pendingDelete)}”?`
            : "¿Eliminar paciente?"
        }
        error={deleteError}
        busy={deleting}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}

function StatusTabs({
  selected,
  counts,
  onSelect,
}: {
  selected: CaseStatus | undefined;
  counts: Record<CaseStatus, number> | null;
  onSelect: (value: CaseStatus | typeof ALL) => void;
}) {
  const { status: colors } = useChartTheme();
  const total = counts ? CASE_STATUS_ORDER.reduce((sum, key) => sum + counts[key], 0) : null;
  const tabs: Array<{ value: CaseStatus | typeof ALL; label: string; count: number | null }> = [
    { value: ALL, label: "Todos", count: total },
    ...CASE_STATUS_ORDER.map((key) => ({
      value: key,
      label: TAB_LABELS[key],
      count: counts ? counts[key] : null,
    })),
  ];

  return (
    <div className="-mb-px flex flex-wrap items-center gap-1" role="group" aria-label="Estado del caso">
      {tabs.map((tab) => {
        const active = tab.value === ALL ? selected === undefined : selected === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(tab.value)}
            className={`group relative flex items-center gap-2 px-3 pt-1.5 pb-3 text-sm font-medium transition ${
              active
                ? "text-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {tab.value !== ALL ? (
              <span
                className="size-2 rounded-full"
                style={{ background: colors[tab.value] }}
                aria-hidden="true"
              />
            ) : null}
            {tab.label}
            <span
              className={`min-w-6 rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums ${
                active
                  ? "bg-teal-700 text-white"
                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {tab.count === null ? "·" : tab.count.toLocaleString("es-SV")}
            </span>
            <span
              className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition ${
                active ? "bg-teal-700 dark:bg-teal-400" : "bg-transparent"
              }`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

const HEADER_CLASS =
  "whitespace-nowrap border-b border-slate-100 bg-white px-3 py-2.5 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400";

function HeaderCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th scope="col" className={`${HEADER_CLASS} ${className}`}>
      {children}
    </th>
  );
}

function SortableHeader({
  label,
  field,
  ordering,
  onSort,
  className = "",
}: {
  label: string;
  field: DirectoryOrderField;
  ordering: DirectoryOrdering;
  onSort: (field: DirectoryOrderField) => void;
  className?: string;
}) {
  const active = ordering.replace(/^-/, "") === field;
  const descending = ordering.startsWith("-");
  const Icon = !active ? ChevronsUpDown : descending ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
      className={`${HEADER_CLASS} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 rounded-md transition hover:text-slate-800 dark:hover:text-slate-200 ${
          active ? "text-slate-800 dark:text-slate-100" : ""
        }`}
      >
        {label}
        <Icon
          className={`size-3.5 ${active ? "text-teal-700 dark:text-teal-300" : "opacity-50"}`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

const CELL =
  "border-b border-slate-100 px-3 py-2.5 align-middle transition-colors group-hover:bg-slate-50 dark:border-slate-800/70 dark:group-hover:bg-slate-800/40";

function PatientRow({
  patient,
  areas,
  canView,
  canEdit,
  editBlocked,
  onOpen,
  onDelete,
}: {
  patient: PatientListItem;
  areas: ClinicalAreaRecord[];
  canView: boolean;
  canEdit: boolean;
  editBlocked: boolean;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const created = new Date(patient.created_at);
  const stop = (event: MouseEvent) => event.stopPropagation();
  const document =
    patient.document_type === "dui" && patient.dui
      ? `DUI ${patient.dui}`
      : patientDocumentLabel(patient);
  const secondary = [`#${patient.id}`, document, patient.phone_number]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr
      onClick={canView ? onOpen : undefined}
      className={`group ${canView ? "cursor-pointer" : ""}`}
    >
      {/* Barra teal a la izquierda al pasar el mouse */}
      <td className={`${CELL} pl-4 shadow-[inset_3px_0_0_transparent] group-hover:shadow-[inset_3px_0_0_#0d9488]`}>
        <div className="flex items-center gap-3">
          {patient.photo ? (
            <img src={patient.photo} alt="" className="size-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              {patientInitials(patient)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800 group-hover:text-teal-800 dark:text-slate-100 dark:group-hover:text-teal-200">
              {patientFullName(patient)}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{secondary}</p>
          </div>
        </div>
      </td>
      <td className={CELL}>
        {patient.clinical_area ? (
          <>
            <p className="text-slate-700 dark:text-slate-200">
              {areaLabel(areas, patient.clinical_area)}
            </p>
            {patient.clinical_subcategory ? (
              <p className="max-w-[11rem] truncate text-xs text-slate-500 dark:text-slate-400">
                {treatmentLabel(areas, patient.clinical_subcategory)}
              </p>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-slate-400">Sin área</span>
        )}
      </td>
      <td className={CELL}>
        <IndicatedPractices practices={patient.indicated_practices} />
      </td>
      <td className={`${CELL} max-w-[12rem]`}>
        {patient.assigned_to ? (
          <span className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
              {initialsOf(patient.assigned_to)}
            </span>
            <span className="truncate text-slate-700 dark:text-slate-200">{patient.assigned_to}</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-slate-400">
            <span className="size-6 shrink-0 rounded-full border border-dashed border-slate-300 dark:border-slate-600" />
            Sin asignar
          </span>
        )}
      </td>
      <td className={CELL}>
        <StatusBadge status={patient.case_status} />
      </td>
      <td className={`${CELL} whitespace-nowrap`}>
        <p className="text-slate-700 dark:text-slate-200">
          {format(created, "d MMM yyyy", { locale: es })}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {formatDistanceStrict(created, new Date(), { locale: es, addSuffix: true })}
        </p>
      </td>
      <td className={`${CELL} pr-4 text-right`} onClick={stop}>
        <div className="inline-flex items-center gap-1">
          {canView ? (
            <Link
              to={`/patients/${patient.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-700 hover:text-white dark:bg-teal-950/60 dark:text-teal-200 dark:hover:bg-teal-500 dark:hover:text-slate-950"
            >
              <FileText className="size-3.5" aria-hidden="true" />
              Ficha
            </Link>
          ) : null}
          {canEdit && editBlocked ? (
            <span
              className="flex size-8 items-center justify-center text-slate-300 dark:text-slate-600"
              title="Solo puedes editar pacientes disponibles o tus casos activos"
              aria-label="Edición no disponible"
              role="img"
            >
              <PencilOff className="size-4" aria-hidden="true" />
            </span>
          ) : null}
          {canEdit && !editBlocked ? (
            <Link
              to={`/patients/${patient.id}/edit`}
              title="Editar"
              aria-label={`Editar a ${patientFullName(patient)}`}
              className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              title="Borrar"
              aria-label={`Borrar a ${patientFullName(patient)}`}
              className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const { status: colors } = useChartTheme();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-700 dark:border-slate-700 dark:text-slate-200">
      <span className="size-1.5 rounded-full" style={{ background: colors[status] }} aria-hidden="true" />
      {CASE_STATUS_LABELS[status]}
    </span>
  );
}

function DirectoryFilter({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const labelId = `${id}-label`;
  const active = value !== ALL;

  return (
    <div className="min-w-0">
      <span id={labelId} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div
        className={`relative flex h-10 items-center rounded-xl text-sm transition ${
          active
            ? "bg-teal-50 ring-1 ring-teal-600/30 dark:bg-teal-950/40 dark:ring-teal-400/30"
            : "bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700/70"
        }`}
      >
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            id={id}
            aria-labelledby={labelId}
            className={`h-full w-full min-w-0 border-0 bg-transparent pl-3 font-medium shadow-none dark:bg-transparent dark:hover:bg-transparent ${
              active ? "pr-9 text-teal-800 dark:text-teal-200" : "text-slate-700 dark:text-slate-200"
            }`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="start"
            className="max-h-72 rounded-xl border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="rounded-lg focus:bg-slate-100 focus:text-slate-800 dark:focus:bg-slate-700 dark:focus:text-white"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {active ? (
          <button
            type="button"
            onClick={() => onChange(ALL)}
            aria-label={`Quitar filtro de ${label.toLowerCase()}`}
            className="absolute right-8 flex size-5 items-center justify-center rounded-full text-teal-700 transition hover:bg-teal-100 dark:text-teal-300 dark:hover:bg-teal-900"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  count,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  count: number;
  onPageChange: (page: number) => void;
}) {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, count);
  const pages: Array<number | "gap"> = [];
  for (let current = 1; current <= pageCount; current += 1) {
    if (current === 1 || current === pageCount || Math.abs(current - page) <= 1) {
      pages.push(current);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }
  const base =
    "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-30";
  const idle = "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <nav
      aria-label="Paginación del directorio"
      className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
    >
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Mostrando{" "}
        <b className="font-semibold text-slate-700 dark:text-slate-200">
          {from}–{to}
        </b>{" "}
        de <b className="font-semibold text-slate-700 dark:text-slate-200">{count}</b> pacientes
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
          className={`${base} ${idle}`}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        {pages.map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              aria-label={`Página ${item}`}
              className={`${base} ${item === page ? "bg-teal-700 text-white" : idle}`}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
          className={`${base} ${idle}`}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

function EmptyDirectory({
  filtered,
  status,
  onClear,
}: {
  filtered: boolean;
  status: CaseStatus | undefined;
  onClear: () => void;
}) {
  const title = filtered
    ? "Ningún paciente coincide"
    : status
      ? `No hay pacientes ${TAB_LABELS[status].toLowerCase()}`
      : "Aún no hay pacientes registrados";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        {filtered ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Prueba con otra pieza o tratamiento, o quita algún filtro.
          </p>
        ) : null}
      </div>
      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}

function DirectorySkeleton() {
  return (
    <div className="space-y-2 px-2 pt-2" aria-hidden="true">
      {["a", "b", "c", "d", "e", "f"].map((row) => (
        <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}
