import { api } from "./api";

export type CaseStatus = "pendiente" | "en_proceso" | "finalizado";

export type DashboardSummary = {
  total_patients: number;
  total_assignments: number;
  total_clinical_records: number;
  patients_by_status: Partial<Record<CaseStatus, number>>;
};

export type SummaryPeriod = "1m" | "6m" | "1a";

export function getDashboardSummary(
  params: { period?: SummaryPeriod } = {},
): Promise<DashboardSummary> {
  const query = params.period ? { period: params.period } : undefined;
  return api
    .get<DashboardSummary>("/dashboard/summary/", { params: query })
    .then((response) => response.data);
}

export function countByStatus(
  summary: DashboardSummary,
  status: CaseStatus,
): number {
  return summary.patients_by_status[status] ?? 0;
}
