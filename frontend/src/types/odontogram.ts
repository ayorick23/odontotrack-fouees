export const FDI_TOOTH_NUMBERS = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38,
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

export type OralGeneralMark = "placa" | "sangrado" | "sarro";

export type OralGeneralMarks = Record<OralGeneralMark, boolean>;

export const ORAL_GENERAL_MARK_LABELS: Record<OralGeneralMark, string> = {
  placa: "Placa",
  sangrado: "Sangrado",
  sarro: "Sarro",
};

export function isToothStatus(value: string): value is ToothStatus {
  return value in TOOTH_STATUS_LABELS;
}

export function isFdiToothNumber(value: number): value is FdiToothNumber {
  return (FDI_TOOTH_NUMBERS as readonly number[]).includes(value);
}
