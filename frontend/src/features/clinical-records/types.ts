export const FDI_TOOTH_NUMBERS = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46,
  45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
] as const;

export type FdiToothNumber = (typeof FDI_TOOTH_NUMBERS)[number];

export type ToothStatus =
  | "sano"
  | "caries"
  | "obturado"
  | "extraido"
  | "corona"
  | "implante";

export const TOOTH_STATUS_LABELS: Record<ToothStatus, string> = {
  sano: "Sano",
  caries: "Caries",
  obturado: "Obturado",
  extraido: "Extraído",
  corona: "Corona",
  implante: "Implante",
};

export type ToothSurface =
  | "mesial"
  | "distal"
  | "vestibular"
  | "lingual"
  | "oclusal";

export const TOOTH_SURFACE_LABELS: Record<ToothSurface, string> = {
  mesial: "Mesial",
  distal: "Distal",
  vestibular: "Vestibular",
  lingual: "Lingual",
  oclusal: "Oclusal",
};

export type OralGeneralMark = "placa" | "sangrado" | "sarro";

export type OralGeneralMarks = Record<OralGeneralMark, boolean>;

export const ORAL_GENERAL_MARK_LABELS: Record<OralGeneralMark, string> = {
  placa: "Placa",
  sangrado: "Sangrado",
  sarro: "Sarro",
};

export const TOOTH_STATUS_PRIORITY: ToothStatus[] = [
  "extraido",
  "implante",
  "corona",
  "caries",
  "obturado",
  "sano",
];

export type ToothFinding = {
  fdi: FdiToothNumber;
  status: ToothStatus;
  statuses: ToothStatus[];
  surfaces: ToothSurface[];
};

/**
 * Contrato de dominio para persistir en clinical_records.
 * `visualSnapshot` es JSON opaco del motor SVG para no perder detalle
 * visual (superficies, materiales) al recargar. No es FHIR.
 */
export type OdontogramSnapshot = {
  version?: number | string;
  teeth?: Record<string, unknown>;
  globals?: unknown;
  plan?: unknown;
};

export type OdontogramValue = {
  teeth: ToothFinding[];
  oralMarks: OralGeneralMarks;
  visualSnapshot?: OdontogramSnapshot;
};

export function isToothStatus(value: string): value is ToothStatus {
  return value in TOOTH_STATUS_LABELS;
}

export function isFdiToothNumber(value: number): value is FdiToothNumber {
  return (FDI_TOOTH_NUMBERS as readonly number[]).includes(value);
}

export function isToothSurface(value: string): value is ToothSurface {
  return value in TOOTH_SURFACE_LABELS;
}

export function emptyOralMarks(): OralGeneralMarks {
  return { placa: false, sangrado: false, sarro: false };
}

export function emptyOdontogram(): OdontogramValue {
  return {
    teeth: FDI_TOOTH_NUMBERS.map((fdi) => ({
      fdi,
      status: "sano",
      statuses: [],
      surfaces: [],
    })),
    oralMarks: emptyOralMarks(),
  };
}

export function findingStatuses(finding: ToothFinding): ToothStatus[] {
  const listed = finding.statuses ?? [];
  if (listed.length > 0) {
    return listed.filter((status) => status !== "sano");
  }
  return finding.status === "sano" ? [] : [finding.status];
}

export function primaryToothStatus(statuses: ToothStatus[]): ToothStatus {
  for (const status of TOOTH_STATUS_PRIORITY) {
    if (statuses.includes(status)) {
      return status;
    }
  }
  return "sano";
}

export function markedTeeth(value: OdontogramValue): ToothFinding[] {
  return value.teeth.filter((tooth) => findingStatuses(tooth).length > 0);
}
