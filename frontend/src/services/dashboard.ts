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

export type DashboardCaseRow = {
  patient_id: number;
  patient_name: string;
  next_appointment: string | null;
};

export type DashboardAppointmentRow = {
  id: number;
  starts_at: string;
  patient_id: number;
  patient_name: string;
  student_name?: string;
};

export type DashboardIndicator = {
  percent: number | null;
  count: number;
  total: number;
};

export type DashboardAreaStatus = { area: string } & Record<CaseStatus, number>;

export type DashboardBankDemand = {
  treatment: string;
  name: string;
  area: string;
  count: number;
};

export type DashboardOverview = {
  my_cases: {
    cases: DashboardCaseRow[];
    upcoming_appointments: DashboardAppointmentRow[];
    diagnoses_awaiting_validation: number;
    bank_available: number;
    my_done_treatments: number;
  } | null;
  supervision: {
    diagnoses_to_validate: number;
    cases_in_progress: number;
    students_with_active_cases: number;
    indicators: {
      digitalization: DashboardIndicator | null;
      validated_diagnoses: DashboardIndicator | null;
      cases_with_validated_diagnosis: DashboardIndicator | null;
    };
  } | null;
  bank: {
    unassigned: number;
    registered_this_month: number;
    today_appointments: DashboardAppointmentRow[];
    average_wait_days: number | null;
  } | null;
  faculty: {
    by_area: DashboardAreaStatus[];
    bank_demand: DashboardBankDemand[];
  } | null;
  accounts: {
    active_by_role: Array<{ role: string; label: string; count: number }>;
    inactive: number;
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
