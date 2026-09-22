import axios from "axios";

import { api, type PaginatedResponse } from "./api";

export type CaseStatus = "pendiente" | "en_proceso" | "finalizado";

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  pendiente: "Pendiente",
  en_proceso: "Asignado",
  finalizado: "Finalizado",
};

export type PatientListItem = {
  id: number;
  first_name: string;
  last_name: string;
  dui: string;
  phone_number: string;
  photo: string | null;
  clinical_area: string;
  clinical_subcategory: string;
  case_status: CaseStatus;
  created_at: string;
  assigned_to: string | null;
};

export type EmergencyContactRelationship =
  | "madre"
  | "padre"
  | "hermano_a"
  | "conyuge"
  | "hijo_a"
  | "otro";

export const EMERGENCY_RELATIONSHIP_LABELS: Record<
  EmergencyContactRelationship,
  string
> = {
  madre: "Madre",
  padre: "Padre",
  hermano_a: "Hermano/a",
  conyuge: "Cónyuge",
  hijo_a: "Hijo/a",
  otro: "Otro",
};

export const EMERGENCY_RELATIONSHIPS = Object.keys(
  EMERGENCY_RELATIONSHIP_LABELS,
) as EmergencyContactRelationship[];

export type Patient = {
  id: number;
  first_name: string;
  last_name: string;
  dui: string;
  date_of_birth: string | null;
  phone_number: string;
  whatsapp_number: string;
  email: string;
  address: string;
  photo: string | null;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: EmergencyContactRelationship | "";
  clinical_area: string;
  clinical_subcategory: string;
  case_status: CaseStatus;
  has_active_assignment: boolean;
  created_at: string;
  updated_at: string;
};

export type PatientWritePayload = {
  first_name: string;
  last_name: string;
  dui: string;
  date_of_birth: string | null;
  phone_number: string;
  email: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: EmergencyContactRelationship | "";
  clinical_area: string;
  clinical_subcategory: string;
};

export type PatientFieldName = keyof PatientWritePayload | "photo";

export type PatientAssignee = {
  id: number;
  name: string;
};

export type DirectoryPeriod = "1m" | "6m" | "1a";

export type ListPatientsParams = {
  page?: number;
  search?: string;
  caseStatus?: CaseStatus;
  clinicalArea?: string;
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

export function patientFullName(patient: {
  first_name: string;
  last_name: string;
}): string {
  return `${patient.first_name} ${patient.last_name}`.trim();
}

export function patientInitials(patient: {
  first_name: string;
  last_name: string;
}): string {
  const first = patient.first_name.trim().charAt(0);
  const last = patient.last_name.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "?";
}

export function getPatient(id: number): Promise<Patient> {
  return api.get<Patient>(`/patients/${id}/`).then((response) => response.data);
}

export function createPatient(
  payload: PatientWritePayload,
  photo?: File | null,
): Promise<Patient> {
  return api
    .post<Patient>("/patients/", toPatientBody(payload, photo))
    .then((response) => response.data);
}

export function updatePatient(
  id: number,
  payload: PatientWritePayload,
  photo?: File | null,
): Promise<Patient> {
  return api
    .patch<Patient>(`/patients/${id}/`, toPatientBody(payload, photo))
    .then((response) => response.data);
}

function toPatientBody(
  payload: PatientWritePayload,
  photo?: File | null,
): PatientWritePayload | FormData {
  if (!photo) {
    return payload;
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === null) {
      continue;
    }
    form.append(key, value);
  }
  form.append("photo", photo);
  return form;
}

export async function deletePatient(id: number): Promise<void> {
  await api.delete(`/patients/${id}/`);
}

export type PatientMutationError = {
  message: string;
  fields: Partial<Record<PatientFieldName, string>>;
};

const PATIENT_FIELDS = new Set<PatientFieldName>([
  "first_name",
  "last_name",
  "dui",
  "date_of_birth",
  "phone_number",
  "email",
  "address",
  "photo",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relationship",
  "clinical_area",
  "clinical_subcategory",
]);

export function getPatientMutationError(error: unknown): PatientMutationError {
  if (!axios.isAxiosError(error) || error.response === undefined) {
    return {
      message: "No se pudo guardar el paciente. Intenta de nuevo.",
      fields: {},
    };
  }

  if (error.response.status === 403) {
    return {
      message:
        "Recepción no puede editar pacientes ya asignados a un estudiante.",
      fields: {},
    };
  }

  if (error.response.status === 404) {
    return {
      message: "No se encontró el paciente.",
      fields: {},
    };
  }

  const data = error.response.data;
  if (typeof data !== "object" || data === null) {
    return {
      message: "No se pudo guardar el paciente. Revisa los datos.",
      fields: {},
    };
  }

  const fields: Partial<Record<PatientFieldName, string>> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!isPatientFieldName(key)) {
      continue;
    }
    const message = firstErrorMessage(value);
    if (message) {
      fields[key] = message;
    }
  }

  const detail = firstErrorMessage(
    "detail" in data ? data.detail : undefined,
  );
  const firstFieldError = Object.values(fields)[0];

  return {
    message:
      detail ??
      firstFieldError ??
      "No se pudo guardar el paciente. Revisa los datos.",
    fields,
  };
}

function isPatientFieldName(value: string): value is PatientFieldName {
  return PATIENT_FIELDS.has(value as PatientFieldName);
}

function firstErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return firstErrorMessage(value[0]);
  }
  return undefined;
}
