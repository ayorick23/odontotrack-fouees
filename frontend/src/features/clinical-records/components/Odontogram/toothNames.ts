import {
  FDI_PRIMARY_TOOTH_NUMBERS,
  FDI_TOOTH_NUMBERS,
  isFdiPrimaryTooth,
  type FdiToothNumber,
} from "../../types";

const PERMANENT: Record<number, string> = {
  1: "Incisivo central",
  2: "Incisivo lateral",
  3: "Canino",
  4: "Primer premolar",
  5: "Segundo premolar",
  6: "Primer molar",
  7: "Segundo molar",
  8: "Tercer molar",
};

const PRIMARY: Record<number, string> = {
  1: "Incisivo central temporal",
  2: "Incisivo lateral temporal",
  3: "Canino temporal",
  4: "Primer molar temporal",
  5: "Segundo molar temporal",
};

/** Cuadrante FDI → posición (permanentes 1-4, temporales 5-8). */
const QUADRANT: Record<number, string> = {
  1: "superior derecho",
  2: "superior izquierdo",
  3: "inferior izquierdo",
  4: "inferior derecho",
  5: "superior derecho",
  6: "superior izquierdo",
  7: "inferior izquierdo",
  8: "inferior derecho",
};

/** 27 → "Segundo molar superior izquierdo". */
export function toothName(fdi: number): string {
  const quadrant = Math.floor(fdi / 10);
  const position = fdi % 10;
  const names = isFdiPrimaryTooth(fdi) ? PRIMARY : PERMANENT;
  const name = names[position];
  const side = QUADRANT[quadrant];
  return name && side ? `${name} ${side}` : `Pieza ${fdi}`;
}

/**
 * Pieza vecina en el orden en que se ve la carta (arcada superior de
 * izquierda a derecha y luego la inferior), dando la vuelta en los extremos.
 * Las temporales navegan entre temporales.
 */
export function neighborTooth(fdi: FdiToothNumber, step: 1 | -1): FdiToothNumber {
  const order: readonly FdiToothNumber[] = isFdiPrimaryTooth(fdi)
    ? FDI_PRIMARY_TOOTH_NUMBERS
    : FDI_TOOTH_NUMBERS;
  const index = order.indexOf(fdi);
  return order[(index + step + order.length) % order.length];
}
