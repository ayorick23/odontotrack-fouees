import { api } from "./api";

export type CaseStatus = "pendiente" | "en_proceso" | "finalizado";

export type DashboardSummary = {
  total_patients: number;
  total_assignments: number;
  total_clinical_records: number;
  patients_by_status: Partial<Record<CaseStatus, number>>;
};

export type SummaryPeriod = "1m" | "6m" | "1a";
/** "todos" = sin filtro de fecha (solo series). */
export type SeriesPeriod = SummaryPeriod | "todos";

export type DashboardMonthPoint = {
  month: string;
  label: string;
  patients: number;
  pendiente: number;
  en_proceso: number;
  finalizado: number;
  assignments: number;
};

export type DashboardStatusSlice = {
  status: CaseStatus;
  label: string;
  count: number;
};

export type DashboardSeries = {
  months: DashboardMonthPoint[];
  by_status: DashboardStatusSlice[];
};

export function getDashboardSummary(
  params: { period?: SummaryPeriod } = {},
): Promise<DashboardSummary> {
  const query = params.period ? { period: params.period } : undefined;
  return api
    .get<DashboardSummary>("/dashboard/summary/", { params: query })
    .then((response) => response.data);
}

export function getDashboardSeries(
  params: { period?: SeriesPeriod } = {},
): Promise<DashboardSeries> {
  const query = params.period ? { period: params.period } : undefined;
  return api
    .get<DashboardSeries>("/dashboard/series/", { params: query })
    .then((response) => response.data);
}

export function countByStatus(
  summary: DashboardSummary,
  status: CaseStatus,
): number {
  return summary.patients_by_status[status] ?? 0;
}

// --- /dashboard/overview/: bloques según permisos (null = no aplica) ---
// Forma documentada en backend/dashboard/overview.py y metrics.py.

/** Número de una tarjeta: valor, % contra el período anterior y mini curva. */
export type DashboardMetric = {
  value: number | null;
  trend: number | null;
  trend_label?: string;
  spark: number[];
  unit?: string;
};

export type MonthCount = { month: string; label: string; count: number };

export type DashboardIndicator = {
  percent: number | null;
  count: number;
  total: number;
};

export type CaseStatusCounts = Record<CaseStatus, number>;

export type DashboardAreaStatus = { area: string } & CaseStatusCounts;

export type DashboardBankDemand = {
  treatment: string;
  name: string;
  area: string;
  count: number;
};

/** label: "Esta semana" o, en fin de semana, "Próxima semana". */
export type Occupancy = { label: string; days: string[]; slots: string[]; cells: number[][] };

export type DashboardOverview = {
  my_cases: {
    kpis: Record<
      "active_cases" | "week_appointments" | "pending_diagnoses" | "done_treatments",
      DashboardMetric
    >;
    cases: Array<{
      patient_id: number;
      patient_name: string;
      next_appointment: string | null;
      plan_done: number;
      plan_total: number;
    }>;
    tasks: Array<{
      kind: "schedule" | "diagnosis" | "appointment";
      title: string;
      detail: string;
      patient_id: number;
      starts_at?: string;
    }>;
    upcoming_appointments: Array<{
      id: number;
      starts_at: string;
      patient_id: number;
      patient_name: string;
    }>;
    done_by_month: MonthCount[];
    bank_available: number;
    bank_top: DashboardBankDemand[];
  } | null;
  supervision: {
    kpis: Record<
      "pending_diagnoses" | "cases_in_progress" | "students_active" | "validated_ratio",
      DashboardMetric
    >;
    queue: Array<{
      id: number;
      content: string;
      patient_id: number;
      patient_name: string;
      student_name: string;
      created_at: string;
    }>;
    diagnoses_to_validate: number;
    indicators: {
      digitalization: DashboardIndicator | null;
      validated_diagnoses: DashboardIndicator | null;
      cases_with_validated_diagnosis: DashboardIndicator | null;
    };
    validated_by_month: MonthCount[];
    top_students: Array<{ name: string; count: number }>;
    status: CaseStatusCounts;
  } | null;
  bank: {
    kpis: Record<
      "unassigned" | "today_appointments" | "registered_month" | "wait_days",
      DashboardMetric
    >;
    today: Array<{
      id: number;
      starts_at: string;
      duration_minutes: number;
      status: "programada" | "atendida" | "cancelada";
      patient_id: number;
      patient_name: string;
      student_name: string;
    }>;
    occupancy: Occupancy;
    registered_by_month: MonthCount[];
  } | null;
  faculty: {
    by_area: DashboardAreaStatus[];
    bank_demand: DashboardBankDemand[];
    status: CaseStatusCounts;
    occupancy: Occupancy;
  } | null;
  accounts: {
    kpis: Record<"active" | "new_month" | "inactive" | "roles", DashboardMetric>;
    active_by_role: Array<{ role: string; label: string; count: number }>;
    inactive: number;
    new_by_month: MonthCount[];
    recent: Array<{ id: number; name: string; role_label: string; date_joined: string }>;
  } | null;
};

export function getDashboardOverview(): Promise<DashboardOverview> {
  return api
    .get<DashboardOverview>("/dashboard/overview/")
    .then((response) => response.data);
}

/** Contadores del menú lateral; null = el usuario no ve ese módulo. */
export type MenuCounters = {
  supervision: number | null;
  assignments: number | null;
};

export function getMenuCounters(): Promise<MenuCounters> {
  return api
    .get<MenuCounters>("/dashboard/counters/")
    .then((response) => response.data);
}
