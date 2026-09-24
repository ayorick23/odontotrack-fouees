import axios from "axios";

import { api, type PaginatedResponse } from "./api";

export type DiagnosisRecord = {
  id: number;
  patient: number;
  student: number;
  student_name: string | null;
  content: string;
  validated_by: number | null;
  validated_by_name: string | null;
  is_validated: boolean;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TreatmentRecord = {
  id: number;
  patient: number;
  clinical_area: number;
  clinical_area_name: string;
  clinical_treatment: number;
  clinical_treatment_name: string;
  created_at: string;
  updated_at: string;
};

export type EvolutionRecord = {
  id: number;
  patient: number;
  student: number;
  student_name: string | null;
  date: string;
  note: string;
  created_at: string;
  updated_at: string;
};

export function listDiagnoses(patientId: number): Promise<DiagnosisRecord[]> {
  return api
    .get<PaginatedResponse<DiagnosisRecord>>("/clinical-records/diagnoses/", {
      params: { patient: patientId },
    })
    .then((response) => response.data.results);
}

export function createDiagnosis(payload: {
  patient: number;
  content: string;
}): Promise<DiagnosisRecord> {
  return api
    .post<DiagnosisRecord>("/clinical-records/diagnoses/", payload)
    .then((response) => response.data);
}

export function listTreatments(patientId: number): Promise<TreatmentRecord[]> {
  return api
    .get<PaginatedResponse<TreatmentRecord>>("/clinical-records/treatments/", {
      params: { patient: patientId },
    })
    .then((response) => response.data.results);
}

export function createTreatment(payload: {
  patient: number;
  clinical_area: number;
  clinical_treatment: number;
}): Promise<TreatmentRecord> {
  return api
    .post<TreatmentRecord>("/clinical-records/treatments/", payload)
    .then((response) => response.data);
}

export function listEvolutions(patientId: number): Promise<EvolutionRecord[]> {
  return api
    .get<PaginatedResponse<EvolutionRecord>>("/clinical-records/evolution/", {
      params: { patient: patientId },
    })
    .then((response) => response.data.results);
}

export function createEvolution(payload: {
  patient: number;
  date: string;
  note: string;
}): Promise<EvolutionRecord> {
  return api
    .post<EvolutionRecord>("/clinical-records/evolution/", payload)
    .then((response) => response.data);
}

export function getClinicalRecordError(
  error: unknown,
  fallback: string,
): string {
  if (!axios.isAxiosError(error) || error.response === undefined) {
    return fallback;
  }
  const data = error.response.data;
  if (typeof data === "string" && data.trim()) {
    return data;
  }
  if (typeof data !== "object" || data === null) {
    return fallback;
  }
  if (typeof data.detail === "string" && data.detail.trim()) {
    return data.detail;
  }
  for (const value of Object.values(data)) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
      return value[0];
    }
  }
  return fallback;
}
