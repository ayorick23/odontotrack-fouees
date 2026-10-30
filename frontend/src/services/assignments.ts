import axios from "axios";

import { api } from "./api";

export type AssignmentRecord = {
  id: number;
  patient: number;
  student: number;
  appointment_number: number;
  reason: string;
  status: string;
};

/** Caso activo con diagnóstico validado: ya se puede finalizar. */
export type FinalizableAssignment = {
  id: number;
  patient: number;
  patient_name: string;
  student_name: string;
  appointment_number: number;
  reason: string;
  assigned_date: string;
};

export type InProgressAssignment = {
  id: number;
  patient: number;
  patient_name: string;
  student_name: string;
  appointment_number: number;
  reason: string;
  assigned_date: string;
  diagnosis_state: "none" | "pending" | "validated";
};

export type AssignableStudent = {
  id: number;
  name: string;
  active_cases: number;
};

// Todo o nada: si un paciente ya no está disponible, no se asigna ninguno.
export function claimAvailablePatients(payload: {
  patients: number[];
  reason: string;
}): Promise<AssignmentRecord[]> {
  return api
    .post<AssignmentRecord[]>("/assignments/claim/", payload)
    .then((response) => response.data);
}

export function assignPatients(payload: {
  patients: number[];
  student: number;
  reason: string;
}): Promise<AssignmentRecord[]> {
  return api
    .post<AssignmentRecord[]>("/assignments/assign/", payload)
    .then((response) => response.data);
}

export function listAssignableStudents(search: string): Promise<AssignableStudent[]> {
  return api
    .get<AssignableStudent[]>("/assignments/students/", {
      params: search ? { search } : {},
    })
    .then((response) => response.data);
}

export function listFinalizableAssignments(): Promise<FinalizableAssignment[]> {
  return api
    .get<FinalizableAssignment[]>("/assignments/finalizable/")
    .then((response) => response.data);
}

export function listInProgressAssignments(): Promise<InProgressAssignment[]> {
  return api
    .get<InProgressAssignment[]>("/assignments/in_progress/")
    .then((response) => response.data);
}

export function finalizeAssignment(id: number): Promise<AssignmentRecord> {
  return api
    .post<AssignmentRecord>(`/assignments/${id}/finalize/`)
    .then((response) => response.data);
}

export function getAssignmentError(error: unknown): string {
  if (!axios.isAxiosError(error) || error.response === undefined) {
    return "No se pudo guardar la asignación. Intenta de nuevo.";
  }
  if (error.response.status === 403) {
    return "No tienes permiso para asignar pacientes.";
  }
  const data = error.response.data;
  if (typeof data !== "object" || data === null) {
    return "No se pudo guardar la asignación. Revisa los datos.";
  }
  const record = data as Record<string, unknown>;
  for (const key of ["patient", "student", "reason", "status", "detail"]) {
    const message = firstMessage(record[key]);
    if (message) {
      return message;
    }
  }
  return "No se pudo guardar la asignación. Revisa los datos.";
}

function firstMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first : null;
  }
  return null;
}
