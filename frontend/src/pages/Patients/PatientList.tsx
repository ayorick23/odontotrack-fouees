import {
  CircleCheckBig,
  Clock3,
  Search,
  UserCheck,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { Table } from "../../components/Table";
import { TableRowActions } from "../../components/TableRowActions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass } from "../../lib/actions";
import {
  countByStatus,
  getDashboardSummary,
  type DashboardSummary,
} from "../../services/dashboard";
import {
  CASE_STATUS_LABELS,
  deletePatient,
  listAssignees,
  listPatients,
  patientFullName,
  patientInitials,
  type CaseStatus,
  type DirectoryPeriod,
  type PatientAssignee,
  type PatientListItem,
} from "../../services/patients";
import {
  areaLabel,
  listClinicalAreas,
  treatmentLabel,
  type ClinicalAreaRecord,
} from "../../services/catalogs";

const PAGE_SIZE = 20;
const PERIOD_FILTERS: Array<{ value: DirectoryPeriod | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "1a", label: "1A" },
];
const STATUS_OPTIONS: Array<{ value: CaseStatus | "todos"; label: string }> = [
  { value: "todos", label: "Todos los estados" },
  { value: "pendiente", label: CASE_STATUS_LABELS.pendiente },
  { value: "en_proceso", label: CASE_STATUS_LABELS.en_proceso },
  { value: "finalizado", label: CASE_STATUS_LABELS.finalizado },
];
const AREA_ALL = "todos";
const SELECT_PARAM_KEYS = [
  "case_status",
  "clinical_area",
  "assigned_to",
] as const;
const STATUS_ICONS: Record<CaseStatus, LucideIcon> = {
  pendiente: Clock3,
  en_proceso: UserCheck,
  finalizado: CircleCheckBig,
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      patients: PatientListItem[];
      count: number;
    };

type KpiState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; summary: DashboardSummary };

function isDirectoryPeriod(value: string | null): value is DirectoryPeriod {
  return value === "1m" || value === "6m" || value === "1a";
}

function isCaseStatus(value: string | null): value is CaseStatus {
  return value === "pendiente" || value === "en_proceso" || value === "finalizado";
}

function isAssigneeFilter(value: string | null): value is string {
  return value === "unassigned" || (value !== null && /^\d+$/.test(value));
}

export function PatientList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(Number(searchParams.get("page") || "1"), 1);
  const searchFromUrl = searchParams.get("search")?.trim() ?? "";
  const periodFromUrl = searchParams.get("period");
  const period = isDirectoryPeriod(periodFromUrl) ? periodFromUrl : undefined;
  const statusFromUrl = searchParams.get("case_status");
  const caseStatus = isCaseStatus(statusFromUrl) ? statusFromUrl : undefined;
  const areaFromUrl = searchParams.get("clinical_area");
  const clinicalArea = areaFromUrl || undefined;
  const assignedFromUrl = searchParams.get("assigned_to");
  const assignedTo = isAssigneeFilter(assignedFromUrl)
    ? assignedFromUrl
    : undefined;

  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const [reloadToken, setReloadToken] = useState(0);
  const [assignees, setAssignees] = useState<PatientAssignee[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [kpiState, setKpiState] = useState<KpiState>({ status: "loading" });
  const [pendingDelete, setPendingDelete] = useState<PatientListItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [areas, setAreas] = useState<ClinicalAreaRecord[]>([]);

  const canRegister = can(user, "patients.create");
  const canView = can(user, "patients.view");
  const canEdit = can(user, "patients.edit");
  const canRemove = can(user, "patients.delete");

  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

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
    setKpiState({ status: "loading" });

    getDashboardSummary({ period })
      .then((summary) => {
        if (!cancelled) {
          setKpiState({ status: "ready", summary });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setKpiState({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [period, reloadToken]);

  useEffect(() => {
    let cancelled = false;

    listAssignees()
      .then((rows) => {
        if (!cancelled) {
          setAssignees(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssignees([]);
        }
      });

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
    })
      .then((payload) => {
        if (!cancelled) {
          setState({
            status: "ready",
            patients: payload.results,
            count: payload.count,
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
  }, [page, searchFromUrl, period, caseStatus, clinicalArea, assignedTo, reloadToken]);

  function setSelectParam(
    key: (typeof SELECT_PARAM_KEYS)[number],
    value: string,
  ) {
    const next = new URLSearchParams(searchParams);
    if (value === "todos") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.delete("page");
    setSearchParams(next);
  }

  function setPeriodFilter(nextPeriod: DirectoryPeriod | "todos") {
    const next = new URLSearchParams(searchParams);
    if (nextPeriod === "todos") {
      next.delete("period");
    } else {
      next.set("period", nextPeriod);
    }
    next.delete("page");
    setSearchParams(next);
  }

  function setStatusFilter(nextStatus: CaseStatus | "todos") {
    setSelectParam("case_status", nextStatus);
  }

  function clearSelectFilters() {
    const next = new URLSearchParams(searchParams);
    for (const key of SELECT_PARAM_KEYS) {
      next.delete(key);
    }
    next.delete("page");
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

  const pageCount = state.status === "ready" ? Math.max(Math.ceil(state.count / PAGE_SIZE), 1) : 1;
  const hasSelectFilters = Boolean(
    caseStatus || clinicalArea || assignedTo,
  );
  const assigneeOptions = useMemo(
    () => [
      { value: "todos", label: "Todos" },
      { value: "unassigned", label: "Sin asignar" },
      ...assignees.map((student) => ({
        value: String(student.id),
        label: student.name,
      })),
    ],
    [assignees],
  );
  const areaOptions = useMemo(
    () => [
      { value: AREA_ALL, label: "Todas las áreas" },
      ...areas.map((area) => ({
        value: area.slug,
        label: area.name,
      })),
    ],
    [areas],
  );
  const range = useMemo(() => {
    if (state.status !== "ready" || state.count === 0) {
      return { from: 0, to: 0 };
    }
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, state.count);
    return { from, to };
  }, [page, state]);

  const columns = useMemo(
    () => [
      {
        header: "ID",
        render: (patient: PatientListItem) => (
          <span className="font-medium text-slate-500 dark:text-slate-400">
            {patient.id}
          </span>
        ),
      },
      {
        header: "Paciente",
        render: (patient: PatientListItem) => (
          <div className="flex items-center gap-3">
            {patient.photo ? (
              <img
                src={patient.photo}
                alt=""
                className="size-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
                {patientInitials(patient)}
              </span>
            )}
            <p className="font-medium text-slate-800 dark:text-slate-100">
              {patientFullName(patient)}
            </p>
          </div>
        ),
      },
      {
        header: "Área",
        render: (patient: PatientListItem) =>
          patient.clinical_area ? (
            <div>
              <p>{areaLabel(areas, patient.clinical_area)}</p>
              {patient.clinical_subcategory ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {treatmentLabel(areas, patient.clinical_subcategory)}
                </p>
              ) : null}
            </div>
          ) : (
            <span className="text-slate-400">Sin área</span>
          ),
      },
      {
        header: "Asignado a",
        render: (patient: PatientListItem) =>
          patient.assigned_to ?? (
            <span className="text-slate-400">Sin asignar</span>
          ),
      },
      {
        header: "Estado",
        render: (patient: PatientListItem) => (
          <StatusBadge status={patient.case_status} />
        ),
      },
      {
        header: "Creado desde",
        render: (patient: PatientListItem) =>
          format(new Date(patient.created_at), "d MMM yyyy", { locale: es }),
      },
      {
        header: "Acciones",
        align: "right" as const,
        render: (patient: PatientListItem) => (
          <TableRowActions
            viewTo={canView ? `/patients/${patient.id}` : undefined}
            editTo={canEdit ? `/patients/${patient.id}/edit` : undefined}
            onDelete={
              canRemove
                ? () => {
                    setDeleteError(null);
                    setPendingDelete(patient);
                  }
                : undefined
            }
          />
        ),
      },
    ],
    [areas, canEdit, canRemove, canView],
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Directorio de pacientes
        </h2>
        <div
          className="flex flex-wrap justify-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
          role="group"
          aria-label="Filtrar por periodo"
        >
          {PERIOD_FILTERS.map((filter) => {
            const selected =
              filter.value === "todos" ? period === undefined : period === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setPeriodFilter(filter.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selected
                    ? "bg-white text-slate-700 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        {canRegister ? (
          <Link
            to="/patients/new"
            className={primaryActionClass}
          >
            <UserPlus className="size-4" />
            Registrar Nuevo Paciente
          </Link>
        ) : (
          <span className="hidden lg:block lg:w-[220px]" />
        )}
      </div>

      <DirectoryKpis
        state={kpiState}
        selectedStatus={caseStatus}
        onSelectStatus={setStatusFilter}
      />

      <section className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <DirectoryFilter
              id="directory-status"
              label="Estado"
              value={caseStatus ?? "todos"}
              options={STATUS_OPTIONS}
              onChange={(value) =>
                setSelectParam(
                  "case_status",
                  isCaseStatus(value) ? value : "todos",
                )
              }
            />
            <DirectoryFilter
              id="directory-area"
              label="Área"
              value={clinicalArea ?? AREA_ALL}
              options={areaOptions}
              onChange={(value) =>
                setSelectParam(
                  "clinical_area",
                  value === AREA_ALL ? AREA_ALL : value,
                )
              }
            />
            <DirectoryFilter
              id="directory-assignee"
              label="Asignado"
              value={assignedTo ?? "todos"}
              options={assigneeOptions}
              onChange={(value) =>
                setSelectParam(
                  "assigned_to",
                  isAssigneeFilter(value) ? value : "todos",
                )
              }
            />
            {hasSelectFilters ? (
              <button
                type="button"
                onClick={clearSelectFilters}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <X className="size-3.5" aria-hidden="true" />
                Limpiar filtros
              </button>
            ) : null}
          </div>
          <label className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <Search className="size-4 shrink-0" />
            <span className="sr-only">Buscar paciente</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nombre"
              className="w-52 bg-transparent outline-none placeholder:text-slate-400"
            />
          </label>
        </div>

        {state.status === "loading" ? <DirectorySkeleton /> : null}

        {state.status === "error" ? (
          <div className="px-2 py-8 text-center">
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {state.message}
            </p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="mt-4 rounded-full bg-[#2ad4c5] px-4 py-2 text-sm font-semibold text-white"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {state.status === "ready" ? (
          <>
            <Table
              caption="Directorio de pacientes"
              columns={columns}
              rows={state.patients}
              getRowKey={(patient) => patient.id}
              emptyMessage={emptyDirectoryMessage(
                Boolean(
                  searchFromUrl ||
                    period ||
                    caseStatus ||
                    clinicalArea ||
                    assignedTo,
                ),
              )}
            />
            {state.count > 0 ? (
              <Pagination
                page={page}
                pageCount={pageCount}
                from={range.from}
                to={range.to}
                count={state.count}
                onPageChange={goToPage}
              />
            ) : null}
          </>
        ) : null}
      </section>

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
    </div>
  );
}

function DirectoryKpis({
  state,
  selectedStatus,
  onSelectStatus,
}: {
  state: KpiState;
  selectedStatus: CaseStatus | undefined;
  onSelectStatus: (status: CaseStatus | "todos") => void;
}) {
  if (state.status === "loading") {
    return (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["registrados", "pendientes", "asignados", "finalizados"].map((key) => (
          <div key={key} className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <p className="text-sm text-red-700 dark:text-red-400" role="alert">
        No se pudieron cargar los indicadores del directorio.
      </p>
    );
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DirectoryKpi
        label="Pacientes registrados"
        value={state.summary.total_patients}
        tone="violet"
        icon={Users}
        selected={selectedStatus === undefined}
        onClick={() => onSelectStatus("todos")}
      />
      <DirectoryKpi
        label="Pendientes de asignación"
        value={countByStatus(state.summary, "pendiente")}
        tone="emerald"
        icon={Clock3}
        selected={selectedStatus === "pendiente"}
        onClick={() => onSelectStatus("pendiente")}
      />
      <DirectoryKpi
        label="Pacientes asignados"
        value={countByStatus(state.summary, "en_proceso")}
        tone="teal"
        icon={UserCheck}
        selected={selectedStatus === "en_proceso"}
        onClick={() => onSelectStatus("en_proceso")}
      />
      <DirectoryKpi
        label="Pacientes finalizados"
        value={countByStatus(state.summary, "finalizado")}
        tone="rose"
        icon={CircleCheckBig}
        selected={selectedStatus === "finalizado"}
        onClick={() => onSelectStatus("finalizado")}
      />
    </section>
  );
}

function DirectoryKpi({
  label,
  value,
  tone,
  icon: Icon,
  selected,
  onClick,
}: {
  label: string;
  value: number;
  tone: "violet" | "emerald" | "teal" | "rose";
  icon: LucideIcon;
  selected: boolean;
  onClick: () => void;
}) {
  const tones: Record<typeof tone, string> = {
    violet: "bg-[#8b85f8]",
    emerald: "bg-[#3ee0b0]",
    teal: "bg-[#2ad4c5]",
    rose: "bg-[#f07a82]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center gap-4 rounded-2xl px-5 py-4 text-left text-white shadow-sm transition ${tones[tone]} ${
        selected ? "ring-2 ring-slate-800/20 ring-offset-2 dark:ring-white/40" : "opacity-95 hover:opacity-100"
      }`}
    >
      <Icon className="size-8 shrink-0 opacity-90" aria-hidden="true" />
      <div>
        <p className="text-2xl font-semibold tabular-nums leading-none">
          {value.toLocaleString("es-SV")}
        </p>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide opacity-90">
          {label}
        </p>
      </div>
    </button>
  );
}

function emptyDirectoryMessage(hasFilters: boolean): string {
  if (hasFilters) {
    return "No se encontraron pacientes con ese criterio.";
  }
  return "Aún no hay pacientes registrados.";
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const Icon = STATUS_ICONS[status];
  const styles: Record<CaseStatus, string> = {
    pendiente:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    en_proceso: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    finalizado: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
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
  const isFiltered = value !== "todos";

  return (
    <div className="flex items-center gap-1 rounded-full bg-slate-50 py-1.5 pr-1.5 pl-3 text-sm dark:bg-slate-800">
      <span
        id={labelId}
        className="text-xs font-semibold uppercase tracking-wide text-slate-400"
      >
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          size="sm"
          aria-labelledby={labelId}
          className="h-auto max-w-44 border-0 bg-transparent px-1 py-0.5 font-medium text-slate-700 shadow-none dark:bg-transparent dark:hover:bg-transparent dark:text-slate-100"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          position="popper"
          align="start"
          className="rounded-xl border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
      {isFiltered ? (
        <button
          type="button"
          onClick={() => onChange("todos")}
          aria-label={`Quitar filtro de ${label.toLowerCase()}`}
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  from,
  to,
  count,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  count: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 px-1 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
      <p>
        Mostrar {from} a {to} de {count} pacientes
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

function DirectorySkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {["a", "b", "c", "d", "e"].map((row) => (
        <div
          key={row}
          className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
        />
      ))}
    </div>
  );
}
