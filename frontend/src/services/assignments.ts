import axios from "axios";

import { api } from "./api";

export type AssignmentPriority = "alta" | "media" | "baja";

export const PRIORITY_LABELS: Record<AssignmentPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export type AssignmentRecord = {
  id: number;
  patient: number;
  student: number;
  appointment_number: number;
  reason: string;
  priority: AssignmentPriority;
  status: string;
};

export type AssignableStudent = {
  id: number;
  name: string;
  active_cases: number;
};

export function claimAvailablePatient(payload: {
  patient: number;
  reason: string;
  priority: AssignmentPriority;
}): Promise<AssignmentRecord> {
  return api
    .post<AssignmentRecord>("/assignments/claim/", payload)
    .then((response) => response.data);
}

export function assignPatient(payload: {
  patient: number;
  student: number;
  reason: string;
  priority: AssignmentPriority;
}): Promise<AssignmentRecord> {
  return api
    .post<AssignmentRecord>("/assignments/", payload)
    .then((response) => response.data);
}

export function listAssignableStudents(search: string): Promise<AssignableStudent[]> {
  return api
    .get<AssignableStudent[]>("/assignments/students/", {
      params: search ? { search } : {},
    })
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
  for (const key of ["patient", "student", "reason", "priority", "detail"]) {
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
