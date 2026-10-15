import axios from "axios";

import { api } from "./api";

export type AppointmentStatus = "programada" | "atendida" | "cancelada";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  programada: "Programada",
  atendida: "Atendida",
  cancelada: "Cancelada",
};

export const APPOINTMENT_DURATIONS = [30, 60, 90, 120] as const;

export type AppointmentDuration = (typeof APPOINTMENT_DURATIONS)[number];

export const DURATION_LABELS: Record<AppointmentDuration, string> = {
  30: "30 minutos",
  60: "1 hora",
  90: "1 hora 30 minutos",
  120: "2 horas",
};

export type Appointment = {
  id: number;
  assignment: number;
  patient: { id: number; name: string };
  student: { id: number; name: string };
  starts_at: string;
  ends_at: string;
  duration_minutes: AppointmentDuration;
  status: AppointmentStatus;
  notes: string;
};

/** Caso activo sobre el que se puede agendar (paciente + estudiante). */
export type SchedulableAssignment = {
  id: number;
  patient: string;
  student: string;
};

export function listAppointments(range: {
  start: string;
  end: string;
}): Promise<Appointment[]> {
  return api
    .get<Appointment[]>("/appointments/", { params: range })
    .then((response) => response.data);
}

export function createAppointment(payload: {
  assignment: number;
  starts_at: string;
  duration_minutes: AppointmentDuration;
  notes: string;
}): Promise<Appointment> {
  return api
    .post<Appointment>("/appointments/", payload)
    .then((response) => response.data);
}

export function updateAppointment(
  id: number,
  payload: { starts_at?: string; duration_minutes?: AppointmentDuration; notes?: string },
): Promise<Appointment> {
  return api
    .patch<Appointment>(`/appointments/${id}/`, payload)
    .then((response) => response.data);
}

export function setAppointmentStatus(
  id: number,
  status: Exclude<AppointmentStatus, "programada">,
): Promise<Appointment> {
  return api
    .post<Appointment>(`/appointments/${id}/status/`, { status })
    .then((response) => response.data);
}

export function listSchedulableAssignments(
  search: string,
): Promise<SchedulableAssignment[]> {
  return api
    .get<SchedulableAssignment[]>("/appointments/schedulable/", {
      params: search ? { search } : {},
    })
    .then((response) => response.data);
}

export function getAppointmentError(error: unknown): string {
  if (!axios.isAxiosError(error) || error.response === undefined) {
    return "No se pudo guardar la cita. Intenta de nuevo.";
  }
  if (error.response.status === 403) {
    return "No tienes permiso para esta acción del calendario.";
  }
  const data = error.response.data;
  if (typeof data !== "object" || data === null) {
    return "No se pudo guardar la cita. Revisa los datos.";
  }
  const record = data as Record<string, unknown>;
  for (const key of ["assignment", "starts_at", "duration_minutes", "status", "notes", "detail"]) {
    const message = firstMessage(record[key]);
    if (message) {
      return message;
    }
  }
  return "No se pudo guardar la cita. Revisa los datos.";
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
