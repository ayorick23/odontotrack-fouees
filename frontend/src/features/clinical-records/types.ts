export const FDI_TOOTH_NUMBERS = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28, 48, 47, 46,
  45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
] as const;

export const FDI_PRIMARY_TOOTH_NUMBERS = [
  55, 54, 53, 52, 51, 61, 62, 63, 64, 65, 85, 84, 83, 82, 81, 71, 72, 73, 74,
  75,
] as const;

export const FDI_ALL_TOOTH_NUMBERS = [
  ...FDI_TOOTH_NUMBERS,
  ...FDI_PRIMARY_TOOTH_NUMBERS,
] as const;

export type FdiToothNumber = (typeof FDI_ALL_TOOTH_NUMBERS)[number];

export type ToothLayer = "hallazgo" | "plan" | "hecho";

export const TOOTH_LAYER_LABELS: Record<ToothLayer, string> = {
  hallazgo: "Hallazgo",
  plan: "Plan",
  hecho: "Hecho",
};

export type ToothStatus =
  | "sano"
  | "caries"
  | "fractura"
  | "obturado"
  | "sellante"
  | "restauracion_temporal"
  | "endodoncia"
  | "pulpotomia"
  | "corona"
  | "puente"
  | "implante"
  | "extraido"
  | "raiz_retenida"
  | "no_erupcionado"
  | "ausente_congenito";

export const TOOTH_STATUS_LABELS: Record<ToothStatus, string> = {
  sano: "Sano",
  caries: "Caries",
  fractura: "Fractura",
  obturado: "Obturado",
  sellante: "Sellante",
  restauracion_temporal: "Restauración temporal",
  endodoncia: "Endodoncia",
  pulpotomia: "Pulpotomía",
  corona: "Corona",
  puente: "Puente",
  implante: "Implante",
  extraido: "Extraído",
  raiz_retenida: "Raíz retenida",
  no_erupcionado: "No erupcionado",
  ausente_congenito: "Ausente congénito",
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

export const TOOTH_SURFACE_CODES: Record<ToothSurface, string> = {
  mesial: "M",
  oclusal: "O",
  distal: "D",
  vestibular: "V",
  lingual: "L",
};

export const TOOTH_SURFACE_ORDER: ToothSurface[] = [
  "mesial",
  "oclusal",
  "distal",
  "vestibular",
  "lingual",
];

export type OralGeneralMark = "placa" | "sangrado" | "sarro";

export type OralGeneralMarks = Record<OralGeneralMark, boolean>;

export const ORAL_GENERAL_MARK_LABELS: Record<OralGeneralMark, string> = {
  placa: "Placa",
  sangrado: "Sangrado",
  sarro: "Sarro",
};

export const TOOTH_STATUS_PRIORITY: ToothStatus[] = [
  "extraido",
  "ausente_congenito",
  "no_erupcionado",
  "raiz_retenida",
  "implante",
  "puente",
  "corona",
  "endodoncia",
  "pulpotomia",
  "fractura",
  "caries",
  "restauracion_temporal",
  "sellante",
  "obturado",
  "sano",
];

export const WHOLE_TOOTH_STATUSES: readonly ToothStatus[] = [
  "extraido",
  "implante",
  "puente",
  "raiz_retenida",
  "no_erupcionado",
  "ausente_congenito",
];

export const HECHO_STATUSES: readonly ToothStatus[] = [
  "obturado",
  "sellante",
  "restauracion_temporal",
  "endodoncia",
  "pulpotomia",
  "corona",
  "puente",
  "implante",
  "extraido",
];

/** Agrupación solo de UI. El dominio sigue siendo ToothStatus plano. */
export const TOOTH_STATUS_GROUPS: ReadonlyArray<{
  id: "patologia" | "tratamiento" | "pieza";
  label: string;
  statuses: readonly ToothStatus[];
}> = [
  { id: "patologia", label: "Patología", statuses: ["caries", "fractura"] },
  {
    id: "tratamiento",
    label: "Tratamiento",
    statuses: [
      "obturado",
      "sellante",
      "restauracion_temporal",
      "corona",
      "puente",
      "endodoncia",
      "pulpotomia",
    ],
  },
  {
    id: "pieza",
    label: "Pieza",
    statuses: [
      "sano",
      "extraido",
      "implante",
      "raiz_retenida",
      "no_erupcionado",
      "ausente_congenito",
    ],
  },
];

export type ToothMark = {
  layer: ToothLayer;
  status: ToothStatus;
  surfaces: ToothSurface[];
};

export type ToothPractice = {
  indicated: boolean;
  clinicalArea: string | null;
};

export type ToothFinding = {
  fdi: FdiToothNumber;
  marks: ToothMark[];
  oralMarks: OralGeneralMarks;
  practice: ToothPractice;
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

export function isToothLayer(value: string): value is ToothLayer {
  return value in TOOTH_LAYER_LABELS;
}

export function isFdiToothNumber(value: number): value is FdiToothNumber {
  return (FDI_ALL_TOOTH_NUMBERS as readonly number[]).includes(value);
}

export function isFdiPrimaryTooth(value: number): boolean {
  return (FDI_PRIMARY_TOOTH_NUMBERS as readonly number[]).includes(value);
}

export function isToothSurface(value: string): value is ToothSurface {
  return value in TOOTH_SURFACE_LABELS;
}

export function emptyOralMarks(): OralGeneralMarks {
  return { placa: false, sangrado: false, sarro: false };
}

export function emptyPractice(): ToothPractice {
  return { indicated: false, clinicalArea: null };
}

export function emptyTooth(fdi: FdiToothNumber): ToothFinding {
  return {
    fdi,
    marks: [],
    oralMarks: emptyOralMarks(),
    practice: emptyPractice(),
  };
}

export function emptyOdontogram(includePrimary = false): OdontogramValue {
  const numbers = includePrimary
    ? FDI_ALL_TOOTH_NUMBERS
    : FDI_TOOTH_NUMBERS;
  return {
    teeth: numbers.map((fdi) => emptyTooth(fdi)),
    oralMarks: emptyOralMarks(),
  };
}

export function hasPrimaryTeeth(value: OdontogramValue): boolean {
  return value.teeth.some((tooth) => isFdiPrimaryTooth(tooth.fdi));
}

export function withPrimaryTeeth(value: OdontogramValue): OdontogramValue {
  if (hasPrimaryTeeth(value)) {
    return value;
  }
  return {
    ...value,
    teeth: [...value.teeth, ...FDI_PRIMARY_TOOTH_NUMBERS.map((fdi) => emptyTooth(fdi))],
  };
}

export function withoutPrimaryTeeth(value: OdontogramValue): OdontogramValue {
  return {
    ...value,
    teeth: value.teeth.filter((tooth) => !isFdiPrimaryTooth(tooth.fdi)),
  };
}

export function deriveOralMarks(teeth: ToothFinding[]): OralGeneralMarks {
  return teeth.reduce(
    (marks, tooth) => ({
      placa: marks.placa || tooth.oralMarks.placa,
      sangrado: marks.sangrado || tooth.oralMarks.sangrado,
      sarro: marks.sarro || tooth.oralMarks.sarro,
    }),
    emptyOralMarks(),
  );
}

export function updateTooth(
  value: OdontogramValue,
  fdi: FdiToothNumber,
  patch: Partial<Pick<ToothFinding, "oralMarks" | "practice" | "marks">>,
): OdontogramValue {
  const teeth = value.teeth.map((tooth) =>
    tooth.fdi === fdi ? { ...tooth, ...patch } : tooth,
  );
  return { ...value, teeth, oralMarks: deriveOralMarks(teeth) };
}

export function defaultLayerForStatus(status: ToothStatus): ToothLayer {
  return HECHO_STATUSES.includes(status) ? "hecho" : "hallazgo";
}

export function findingStatuses(finding: ToothFinding): ToothStatus[] {
  return finding.marks.map((mark) => mark.status);
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
  return value.teeth.filter(
    (tooth) =>
      tooth.marks.length > 0 ||
      tooth.oralMarks.placa ||
      tooth.oralMarks.sangrado ||
      tooth.oralMarks.sarro ||
      tooth.practice.indicated,
  );
}

export function surfaceCode(surfaces: ToothSurface[]): string {
  return TOOTH_SURFACE_ORDER.filter((surface) => surfaces.includes(surface))
    .map((surface) => TOOTH_SURFACE_CODES[surface])
    .join("");
}

export function formatToothMark(mark: ToothMark): string {
  const surfaces = surfaceCode(mark.surfaces);
  const status = TOOTH_STATUS_LABELS[mark.status];
  if (!surfaces) {
    return status;
  }
  return `${status} ${surfaces}`;
}
