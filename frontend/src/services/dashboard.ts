import { api } from "./api";

export type CaseStatus = "pendiente" | "en_proceso" | "finalizado";

export type DashboardSummary = {
  total_patients: number;
  total_assignments: number;
  total_clinical_records: number;
  patients_by_status: Partial<Record<CaseStatus, number>>;
  /** Diagnósticos sin validar hoy; no depende del período. */
  pending_validations: number;
};

export type SummaryPeriod = "1m" | "6m" | "1a";

export type DashboardMonthPoint = {
  month: string;
  label: string;
  patients: number;
  assignments: number;
};

export type DashboardAreaCount = {
  area: string;
  count: number;
};

export type DashboardStudentLoad = {
  student: string;
  active_cases: number;
};

export type DashboardSeries = {
  months: DashboardMonthPoint[];
  pending_by_area: DashboardAreaCount[];
  /** Casos activos hoy; no depende del período. */
  student_load: DashboardStudentLoad[];
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
  params: { period?: SummaryPeriod } = {},
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
