import {
  FDI_PRIMARY_TOOTH_NUMBERS,
  FDI_TOOTH_NUMBERS,
} from "../../features/clinical-records/types";
import type { ClinicalAreaRecord } from "../../services/catalogs";

export const PRACTICE_ALL = "todos";

/** Piezas FDI en orden numérico: permanentes y luego temporales. */
export const TOOTH_OPTIONS = [
  { value: PRACTICE_ALL, label: "Todas las piezas" },
  ...[...FDI_TOOTH_NUMBERS]
    .sort((a, b) => a - b)
    .map((fdi) => ({ value: String(fdi), label: `Pieza ${fdi}` })),
  ...[...FDI_PRIMARY_TOOTH_NUMBERS]
    .sort((a, b) => a - b)
    .map((fdi) => ({ value: String(fdi), label: `Pieza ${fdi} (temporal)` })),
];

/**
 * Tratamientos activos del catálogo. Con un área elegida, solo los de esa
 * área; sin área, todos como "Área · Tratamiento".
 */
export function treatmentOptions(areas: ClinicalAreaRecord[], areaSlug?: string) {
  const selected = areaSlug ? areas.filter((area) => area.slug === areaSlug) : areas;
  return [
    { value: PRACTICE_ALL, label: "Todos los tratamientos" },
    ...selected.flatMap((area) =>
      area.treatments
        .filter((treatment) => treatment.is_active)
        .map((treatment) => ({
          value: treatment.slug,
          label: areaSlug ? treatment.name : `${area.name} · ${treatment.name}`,
        })),
    ),
  ];
}

/** El tratamiento pertenece al área (o no hay área elegida). */
export function treatmentInArea(
  areas: ClinicalAreaRecord[],
  treatmentSlug: string,
  areaSlug?: string,
): boolean {
  if (!areaSlug) {
    return true;
  }
  const area = areas.find((item) => item.slug === areaSlug);
  return Boolean(area?.treatments.some((treatment) => treatment.slug === treatmentSlug));
}

export function isToothFilter(value: string | null): value is string {
  return value !== null && TOOTH_OPTIONS.some((option) => option.value === value && value !== PRACTICE_ALL);
}
