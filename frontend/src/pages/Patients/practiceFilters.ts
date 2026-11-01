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

/** Tratamientos activos del catálogo como "Área · Tratamiento". */
export function treatmentOptions(areas: ClinicalAreaRecord[]) {
  return [
    { value: PRACTICE_ALL, label: "Todos los tratamientos" },
    ...areas.flatMap((area) =>
      area.treatments
        .filter((treatment) => treatment.is_active)
        .map((treatment) => ({
          value: treatment.slug,
          label: `${area.name} · ${treatment.name}`,
        })),
    ),
  ];
}

export function isToothFilter(value: string | null): value is string {
  return value !== null && TOOTH_OPTIONS.some((option) => option.value === value && value !== PRACTICE_ALL);
}
