import type { OdontogramValue, ToothFinding } from "../../types";

function toothKey(tooth: ToothFinding | undefined): string {
  if (!tooth) {
    return "";
  }
  // Quién y cuándo lo realizó lo pone el servidor al guardar: no es un
  // cambio del usuario.
  const marks = tooth.marks.map(({ doneBy: _by, doneByName: _name, doneAt: _at, ...mark }) => mark);
  return JSON.stringify({ marks, oralMarks: tooth.oralMarks });
}

/**
 * Piezas cuyo diagnóstico o plan difiere de lo guardado. Se cuentan piezas
 * y no marcas: marcar algo como realizado mueve la marca de plan a hecho y
 * debe contar como un solo cambio.
 */
export function changedTeethCount(
  saved: OdontogramValue,
  current: OdontogramValue,
): number {
  const before = new Map(saved.teeth.map((tooth) => [tooth.fdi, tooth]));
  const after = new Map(current.teeth.map((tooth) => [tooth.fdi, tooth]));
  let count = 0;
  for (const fdi of new Set([...before.keys(), ...after.keys()])) {
    if (toothKey(before.get(fdi)) !== toothKey(after.get(fdi))) {
      count += 1;
    }
  }
  return count;
}
