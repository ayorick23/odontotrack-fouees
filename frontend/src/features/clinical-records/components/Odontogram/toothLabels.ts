import type { OdontogramValue, OdontogramView } from "../../types";

/**
 * Color del número de cada pieza en la carta (como los números rojos y
 * verdes de la referencia aprobada):
 * - finding: tiene algo en el diagnóstico (vista Diagnóstico).
 * - plan: tiene tratamientos pendientes (vista Plan).
 * - done: todo lo planificado ya se realizó (vista Plan).
 */
export type ToothLabelState = "finding" | "plan" | "done";

export function toothLabelStates(
  value: OdontogramValue,
  view: OdontogramView,
): Map<number, ToothLabelState> {
  const states = new Map<number, ToothLabelState>();
  for (const tooth of value.teeth) {
    if (view === "diagnostico") {
      const oral = tooth.oralMarks.placa || tooth.oralMarks.sangrado || tooth.oralMarks.sarro;
      if (oral || tooth.marks.some((mark) => mark.layer === "hallazgo")) {
        states.set(tooth.fdi, "finding");
      }
    } else if (tooth.marks.some((mark) => mark.layer === "plan")) {
      states.set(tooth.fdi, "plan");
    } else if (tooth.marks.some((mark) => mark.layer === "hecho")) {
      states.set(tooth.fdi, "done");
    }
  }
  return states;
}

/**
 * La librería dibuja los números como `.tooth-label-cell` sin atributo de
 * pieza: el texto es el número FDI. Se marca cada celda con `data-state`
 * y el color lo pone odontogram.css.
 */
export function applyToothLabelStates(
  root: ParentNode,
  states: Map<number, ToothLabelState>,
): void {
  root.querySelectorAll<HTMLElement>(".tooth-label-cell").forEach((cell) => {
    const state = states.get(Number(cell.textContent?.trim()));
    if (state) {
      cell.dataset.state = state;
    } else {
      delete cell.dataset.state;
    }
  });
}
