import { api } from "./api";

export type CaseStatus = "pendiente" | "en_proceso" | "finalizado";

export type DashboardSummary = {
  total_patients: number;
  total_assignments: number;
  total_clinical_records: number;
  patients_by_status: Partial<Record<CaseStatus, number>>;
};

export function getDashboardSummary(): Promise<DashboardSummary> {
  return api
    .get<DashboardSummary>("/dashboard/summary/")
    .then((response) => response.data);
}

export function countByStatus(
  summary: DashboardSummary,
  status: CaseStatus,
): number {
  return summary.patients_by_status[status] ?? 0;
}
