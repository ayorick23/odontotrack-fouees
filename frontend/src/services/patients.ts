import { api, type PaginatedResponse } from "./api";

export type CaseStatus = "pendiente" | "en_proceso" | "finalizado";
export type ClinicalArea =
  | "operatoria"
  | "endodoncia"
  | "periodoncia"
  | "cirugia"
  | "protesis"
  | "odontopediatria"
  | "ortodoncia";

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  pendiente: "Pendiente",
  en_proceso: "Asignado",
  finalizado: "Finalizado",
};

export const CLINICAL_AREA_LABELS: Record<ClinicalArea, string> = {
  operatoria: "Operatoria",
  endodoncia: "Endodoncia",
  periodoncia: "Periodoncia",
  cirugia: "Cirugía",
  protesis: "Prótesis",
  odontopediatria: "Odontopediatría",
  ortodoncia: "Ortodoncia",
};

export const CLINICAL_AREAS = Object.keys(
  CLINICAL_AREA_LABELS,
) as ClinicalArea[];

export type PatientListItem = {
  id: number;
  first_name: string;
  last_name: string;
  document_id: string;
  phone_number: string;
  clinical_area: ClinicalArea | "";
  case_status: CaseStatus;
  created_at: string;
  assigned_to: string | null;
};

export type PatientAssignee = {
  id: number;
  name: string;
};

export type DirectoryPeriod = "1m" | "6m" | "1a";

export type ListPatientsParams = {
  page?: number;
  search?: string;
  caseStatus?: CaseStatus;
  clinicalArea?: ClinicalArea;
  assignedTo?: "unassigned" | string;
  period?: DirectoryPeriod;
};

export function listPatients(
  params: ListPatientsParams = {},
): Promise<PaginatedResponse<PatientListItem>> {
  const query: Record<string, string | number> = {};
  if (params.page && params.page > 1) {
    query.page = params.page;
  }
  if (params.search) {
    query.search = params.search;
  }
  if (params.caseStatus) {
    query.case_status = params.caseStatus;
  }
  if (params.clinicalArea) {
    query.clinical_area = params.clinicalArea;
  }
  if (params.assignedTo) {
    query.assigned_to = params.assignedTo;
  }
  if (params.period) {
    query.period = params.period;
  }

  return api
    .get<PaginatedResponse<PatientListItem>>("/patients/", { params: query })
    .then((response) => response.data);
}

export function listAssignees(): Promise<PatientAssignee[]> {
  return api
    .get<PatientAssignee[]>("/patients/assignees/")
    .then((response) => response.data);
}

export function patientFullName(patient: PatientListItem): string {
  return `${patient.first_name} ${patient.last_name}`.trim();
}

export function patientInitials(patient: PatientListItem): string {
  const first = patient.first_name.trim().charAt(0);
  const last = patient.last_name.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

export async function deletePatient(id: number): Promise<void> {
  await api.delete(`/patients/${id}/`);
}
