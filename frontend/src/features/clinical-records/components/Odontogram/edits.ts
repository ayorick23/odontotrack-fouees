/**
 * Operaciones sobre las marcas del odontograma.
 *
 * Funciones puras: reciben el valor y devuelven uno nuevo. Las marcas son
 * la única fuente de verdad; el dibujo se genera después a partir de
 * ellas (mapEngineState.domainToChart). Las reglas replican las del
 * backend (clinical_records/catalog.py) para que lo que se ve antes de
 * guardar sea lo mismo que queda guardado.
 */
import {
  SURFACE_STATUSES,
  WHOLE_TOOTH_STATUSES,
  updateTooth,
  type FdiToothNumber,
  type OdontogramValue,
  type PracticeTreatment,
  type ToothLayer,
  type ToothMark,
  type ToothStatus,
  type ToothSurface,
} from "../../types";

function isWhole(mark: ToothMark): boolean {
  return mark.status != null && WHOLE_TOOTH_STATUSES.includes(mark.status);
}

function marksOf(value: OdontogramValue, fdi: FdiToothNumber): ToothMark[] {
  return value.teeth.find((tooth) => tooth.fdi === fdi)?.marks ?? [];
}

function withMarks(
  value: OdontogramValue,
  fdi: FdiToothNumber,
  marks: ToothMark[],
): OdontogramValue {
  return updateTooth(value, fdi, { marks });
}

/** Agrega `mark` a su capa respetando que un estado de pieza completa
 * (extraído, implante...) no convive con otras marcas de la misma capa. */
function addToLayer(marks: ToothMark[], mark: ToothMark): ToothMark[] {
  const kept = marks.filter(
    (item) => item.layer !== mark.layer || (!isWhole(mark) && !isWhole(item)),
  );
  return [...kept, mark];
}

function defaultSurfaces(status: ToothStatus | null): ToothSurface[] {
  return status && SURFACE_STATUSES.includes(status) ? ["oclusal"] : [];
}

/**
 * Botón de estado en Hallazgo o Hecho. "Sano" limpia la capa; un estado
 * ya marcado se quita (el botón funciona como interruptor).
 */
export function toggleStatus(
  value: OdontogramValue,
  fdi: FdiToothNumber,
  layer: ToothLayer,
  status: ToothStatus,
): OdontogramValue {
  const marks = marksOf(value, fdi);
  if (status === "sano") {
    return withMarks(
      value,
      fdi,
      marks.filter((mark) => mark.layer !== layer),
    );
  }
  const existing = marks.findIndex(
    (mark) => mark.layer === layer && mark.status === status && !mark.treatment,
  );
  if (existing >= 0) {
    return removeMark(value, fdi, existing);
  }
  return withMarks(
    value,
    fdi,
    addToLayer(marks, { layer, status, surfaces: defaultSurfaces(status) }),
  );
}

/** Estados presentes en la capa (para pintar los botones activos). */
export function layerStatuses(
  value: OdontogramValue,
  fdi: FdiToothNumber,
  layer: ToothLayer,
): ToothStatus[] {
  return marksOf(value, fdi).flatMap((mark) =>
    mark.layer === layer && mark.status && !mark.treatment ? [mark.status] : [],
  );
}

/**
 * Superficie en Hallazgo o Hecho, sobre la marca de ese estado. Si no
 * existe se crea; si se queda sin superficies se quita.
 */
export function toggleSurface(
  value: OdontogramValue,
  fdi: FdiToothNumber,
  layer: ToothLayer,
  status: ToothStatus,
  surface: ToothSurface,
  on: boolean,
): OdontogramValue {
  const marks = marksOf(value, fdi);
  const index = marks.findIndex(
    (mark) => mark.layer === layer && mark.status === status && !mark.treatment,
  );
  if (index < 0) {
    if (!on) {
      return value;
    }
    return withMarks(
      value,
      fdi,
      addToLayer(marks, { layer, status, surfaces: [surface] }),
    );
  }
  return setMarkSurface(value, fdi, index, surface, on);
}

/** Superficie de una marca concreta (p. ej. la resina planificada). Una
 * marca sin tratamiento que se queda sin superficies se quita. */
export function setMarkSurface(
  value: OdontogramValue,
  fdi: FdiToothNumber,
  index: number,
  surface: ToothSurface,
  on: boolean,
): OdontogramValue {
  const marks = marksOf(value, fdi);
  const mark = marks[index];
  if (!mark) {
    return value;
  }
  const surfaces = on
    ? [...new Set([...mark.surfaces, surface])]
    : mark.surfaces.filter((item) => item !== surface);
  if (surfaces.length === 0 && !mark.treatment) {
    return removeMark(value, fdi, index);
  }
  return withMarks(
    value,
    fdi,
    marks.map((item, position) => (position === index ? { ...item, surfaces } : item)),
  );
}

/** Planifica un tratamiento del tarifario en la pieza. El símbolo sale
 * del tarifario; repetir el mismo tratamiento no lo duplica. */
export function addPlannedTreatment(
  value: OdontogramValue,
  fdi: FdiToothNumber,
  treatment: PracticeTreatment,
): OdontogramValue {
  const marks = marksOf(value, fdi);
  if (marks.some((mark) => mark.layer === "plan" && mark.treatment === treatment.slug)) {
    return value;
  }
  const status = treatment.odontogramStatus;
  return withMarks(
    value,
    fdi,
    addToLayer(marks, {
      layer: "plan",
      status,
      surfaces: defaultSurfaces(status),
      treatment: treatment.slug,
    }),
  );
}

export function removeMark(
  value: OdontogramValue,
  fdi: FdiToothNumber,
  index: number,
): OdontogramValue {
  const marks = marksOf(value, fdi);
  if (!marks[index]) {
    return value;
  }
  return withMarks(
    value,
    fdi,
    marks.filter((_, position) => position !== index),
  );
}

/**
 * Casilla "Realizado" de un tratamiento del plan: plan → hecho (sale del
 * banco) o, al desmarcarla, hecho → plan. Conserva tratamiento y
 * superficies. Solo aplica a marcas con tratamiento: "hecho" sin
 * tratamiento no existe (lo previo del paciente es diagnóstico).
 */
export function setDone(
  value: OdontogramValue,
  fdi: FdiToothNumber,
  index: number,
  done: boolean,
): OdontogramValue {
  const marks = marksOf(value, fdi);
  const mark = marks[index];
  const from = done ? "plan" : "hecho";
  if (!mark || mark.layer !== from || !mark.treatment) {
    return value;
  }
  const rest = marks.filter((_, position) => position !== index);
  return withMarks(
    value,
    fdi,
    addToLayer(rest, { ...mark, layer: done ? "hecho" : "plan" }),
  );
}
