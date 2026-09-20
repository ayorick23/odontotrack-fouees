import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CircleCheckBig,
  Clock3,
  Search,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { Table } from "../../components/Table";
import { TableRowActions } from "../../components/TableRowActions";
import { useAuth } from "../../hooks/useAuth";
import {
  countByStatus,
  getDashboardSummary,
  type DashboardSummary,
} from "../../services/dashboard";
import {
  CASE_STATUS_LABELS,
  deletePatient,
  listPatients,
  patientFullName,
  patientInitials,
  type CaseStatus,
  type DirectoryPeriod,
  type PatientListItem,
} from "../../services/patients";

const PAGE_SIZE = 20;
const PERIOD_FILTERS: Array<{ value: DirectoryPeriod | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "1m", label: "1M" },
  { value: "6m", label: "6M" },
  { value: "1a", label: "1A" },
];
const STATUS_FILTERS: Array<{ value: CaseStatus | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "pendiente", label: CASE_STATUS_LABELS.pendiente },
  { value: "en_proceso", label: CASE_STATUS_LABELS.en_proceso },
  { value: "finalizado", label: CASE_STATUS_LABELS.finalizado },
];
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

export function PatientList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(Number(searchParams.get("page") || "1"), 1);
  const searchFromUrl = searchParams.get("search")?.trim() ?? "";
  const periodFromUrl = searchParams.get("period");
  const period = isDirectoryPeriod(periodFromUrl) ? periodFromUrl : undefined;
  const statusFromUrl = searchParams.get("case_status");
  const caseStatus = isCaseStatus(statusFromUrl) ? statusFromUrl : undefined;

  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [kpiState, setKpiState] = useState<KpiState>({ status: "loading" });
  const [pendingDelete, setPendingDelete] = useState<PatientListItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canRegister = can(user, "patients.create");
  const canView = can(user, "patients.view");
  const canEdit = can(user, "patients.edit");
  const canRemove = can(user, "patients.delete");

  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

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
    setState({ status: "loading" });

    listPatients({
      page,
      search: searchFromUrl || undefined,
      period,
      caseStatus,
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
  }, [page, searchFromUrl, period, caseStatus, reloadToken]);

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
    const next = new URLSearchParams(searchParams);
    if (nextStatus === "todos") {
      next.delete("case_status");
    } else {
      next.set("case_status", nextStatus);
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
            #{patient.id}
          </span>
        ),
      },
      {
        header: "Paciente",
        render: (patient: PatientListItem) => (
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
              {patientInitials(patient)}
            </span>
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {patientFullName(patient)}
              </p>
              {patient.phone_number ? (
                <p className="text-xs text-slate-400">{patient.phone_number}</p>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        header: "Documento",
        render: (patient: PatientListItem) => patient.document_id,
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
        header: "Registrado",
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
    [canEdit, canRemove, canView],
  );

  async function confirmDelete() {
    if (pendingDelete === null) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePatient(pendingDelete.id);
      setPendingDelete(null);
      setReloadToken((token) => token + 1);
    } catch {
      setDeleteError(
        "No se pudo borrar el paciente. Puede estar asignado o no tienes permiso.",
      );
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
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#2ad4c5] px-4 py-2 text-sm font-semibold text-[#2ad4c5] hover:bg-teal-50 dark:hover:bg-teal-950/40"
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
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrar por estado"
          >
            {STATUS_FILTERS.map((filter) => {
              const selected =
                filter.value === "todos"
                  ? caseStatus === undefined
                  : caseStatus === filter.value;
              const Icon =
                filter.value === "todos" ? Users : STATUS_ICONS[filter.value];
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    selected
                      ? "bg-[#2ad4c5] text-white"
                      : "bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  {filter.label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <Search className="size-4 shrink-0" />
            <span className="sr-only">Buscar paciente</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nombre o DUI"
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
              emptyMessage={emptyDirectoryMessage(searchFromUrl, period, caseStatus)}
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

function emptyDirectoryMessage(
  search: string,
  period: DirectoryPeriod | undefined,
  caseStatus: CaseStatus | undefined,
): string {
  if (search || period || caseStatus) {
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
