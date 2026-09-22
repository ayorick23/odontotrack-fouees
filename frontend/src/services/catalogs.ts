import { api } from "./api";

export type ClinicalTreatmentRecord = {
  id: number;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  area?: number;
};

export type ClinicalAreaRecord = {
  id: number;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  treatments: ClinicalTreatmentRecord[];
};

export function listClinicalAreas(
  activeOnly = false,
): Promise<ClinicalAreaRecord[]> {
  return api
    .get<ClinicalAreaRecord[]>("/catalogs/clinical-areas/", {
      params: activeOnly ? { active: 1 } : undefined,
    })
    .then((response) => response.data);
}

export function createClinicalArea(
  payload: { name: string; sort_order?: number },
): Promise<ClinicalAreaRecord> {
  return api
    .post<ClinicalAreaRecord>("/catalogs/clinical-areas/", payload)
    .then((response) => response.data);
}

export function updateClinicalArea(
  id: number,
  payload: Partial<Pick<ClinicalAreaRecord, "name" | "is_active" | "sort_order">>,
): Promise<ClinicalAreaRecord> {
  return api
    .patch<ClinicalAreaRecord>(`/catalogs/clinical-areas/${id}/`, payload)
    .then((response) => response.data);
}

export function deleteClinicalArea(id: number): Promise<void> {
  return api.delete(`/catalogs/clinical-areas/${id}/`).then(() => undefined);
}

export function createClinicalTreatment(payload: {
  name: string;
  area: number;
  sort_order?: number;
}): Promise<ClinicalTreatmentRecord> {
  return api
    .post<ClinicalTreatmentRecord>("/catalogs/clinical-treatments/", payload)
    .then((response) => response.data);
}

export function updateClinicalTreatment(
  id: number,
  payload: Partial<
    Pick<ClinicalTreatmentRecord, "name" | "is_active" | "sort_order">
  >,
): Promise<ClinicalTreatmentRecord> {
  return api
    .patch<ClinicalTreatmentRecord>(
      `/catalogs/clinical-treatments/${id}/`,
      payload,
    )
    .then((response) => response.data);
}

export function deleteClinicalTreatment(id: number): Promise<void> {
  return api.delete(`/catalogs/clinical-treatments/${id}/`).then(() => undefined);
}

export function areaLabel(
  areas: ClinicalAreaRecord[],
  slug: string,
): string {
  return areas.find((area) => area.slug === slug)?.name ?? slug;
}

export function treatmentLabel(
  areas: ClinicalAreaRecord[],
  slug: string,
): string {
  for (const area of areas) {
    const treatment = area.treatments.find((item) => item.slug === slug);
    if (treatment) {
      return treatment.name;
    }
  }
  return slug;
}
