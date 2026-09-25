import { api } from "./api";

export type CaseStatus = "pendiente" | "en_proceso" | "finalizado";

export type DashboardSummary = {
  total_patients: number;
  total_assignments: number;
  total_clinical_records: number;
  patients_by_status: Partial<Record<CaseStatus, number>>;
  /** Diagnósticos sin validar hoy; no depende del período. */
  pending_validations: number;
  /** Días promedio del registro a la primera asignación; null si no hay. */
  average_wait_days: number | null;
};

export type SummaryPeriod = "1m" | "6m" | "1a";

export type DashboardMonthPoint = {
  month: string;
  label: string;
  patients: number;
  assignments: number;
};

export type DashboardAreaStatus = {
  area: string;
} & Record<CaseStatus, number>;

export type DashboardSeries = {
  months: DashboardMonthPoint[];
  /** Todas las áreas activas del catálogo, de mayor a menor total. */
  by_area: DashboardAreaStatus[];
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
