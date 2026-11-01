import {
  type OdontogramSnapshot,
  type OdontogramValue,
  type ToothFinding,
  type ToothMark,
  type ToothSurface,
} from "../../types";

/**
 * Traducción de las marcas FOUEES al dibujo de react-advanced-odontogram.
 *
 * Solo va en un sentido: marcas → dibujo. Antes también se leía el dibujo
 * para deducir las marcas, y como la librería dibujaba igual estados
 * distintos (raíz retenida y extraído, fractura y caries) o no dibujaba
 * algunos (endodoncia), se guardaba algo distinto de lo marcado.
 *
 * Del `visualSnapshot` guardado se conserva lo que no son marcas (pulpa,
 * diagnóstico apical, ortodoncia, perio, ICD-10). Los campos que dependen
 * de las marcas (OWNED_KEYS) se borran y se recalculan siempre.
 */

type EngineTooth = Record<string, unknown>;

const DOMAIN_SURFACE_TO_ENGINE: Record<ToothSurface, string> = {
  mesial: "mesial",
  distal: "distal",
  vestibular: "buccal",
  lingual: "lingual",
  oclusal: "occlusal",
};

const OWNED_KEYS = [
  "toothSelection",
  "restorationType",
  "caries",
  "fillingSurfaces",
  "fillingMaterial",
  "fissureSealing",
  "brokenMesial",
  "brokenDistal",
  "brokenIncisal",
  "extractionPlan",
  "calculus",
  "plaque",
] as const;

/** Valores de `endo` que pone una marca; otros los elige la tarjeta de
 * Endodoncia (estado pulpar) y se respetan. */
const MARK_ENDO_VALUES = new Set(["endo-filling", "endo-medical-filling"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function engineSurfaces(marks: ToothMark[]): string[] {
  const surfaces = new Set<string>();
  for (const mark of marks) {
    for (const surface of mark.surfaces) {
      surfaces.add(DOMAIN_SURFACE_TO_ENGINE[surface]);
    }
  }
  return [...surfaces];
}

/**
 * Dibujo de un conjunto de marcas. `plan` dibuja la exodoncia como "a
 * extraer" (el diente sigue ahí) en vez de como pieza ausente.
 */
export function marksToEngineTooth(
  marks: ToothMark[],
  { plan = false }: { plan?: boolean } = {},
): EngineTooth {
  const has = (status: ToothMark["status"]) =>
    marks.some((mark) => mark.status === status);
  const tooth: EngineTooth = { toothSelection: "tooth-base" };

  if (has("ausente_congenito")) {
    return { toothSelection: "none" };
  }
  if (has("extraido")) {
    if (!plan) {
      return { toothSelection: "no-tooth-after-extraction" };
    }
    tooth.extractionPlan = true;
  }
  if (has("implante")) {
    return { toothSelection: "implant" };
  }
  if (has("no_erupcionado")) {
    return { toothSelection: "tooth-under-gum" };
  }
  if (has("raiz_retenida")) {
    // Solo queda la raíz: corona destruida.
    return {
      toothSelection: "tooth-base",
      brokenMesial: true,
      brokenDistal: true,
      brokenIncisal: true,
    };
  }

  if (has("puente")) {
    tooth.restorationType = "bridge";
  } else if (has("corona")) {
    tooth.restorationType = "crown";
  }

  const caries = marks.filter((mark) => mark.status === "caries");
  if (caries.length > 0) {
    tooth.caries = engineSurfaces(caries).map((surface) => `caries-${surface}`);
  }

  const fillings = marks.filter(
    (mark) => mark.status === "obturado" || mark.status === "restauracion_temporal",
  );
  if (fillings.length > 0) {
    tooth.fillingSurfaces = engineSurfaces(fillings);
    tooth.fillingMaterial = fillings.every(
      (mark) => mark.status === "restauracion_temporal",
    )
      ? "temporary"
      : "composite";
  }

  if (has("sellante")) {
    tooth.fissureSealing = true;
  }
  if (has("fractura")) {
    tooth.brokenMesial = true;
  }
  if (has("endodoncia")) {
    tooth.endo = "endo-filling";
  } else if (has("pulpotomia")) {
    tooth.endo = "endo-medical-filling";
  }
  return tooth;
}

function withOralMarks(tooth: EngineTooth, finding: ToothFinding): EngineTooth {
  if (finding.oralMarks.sarro) {
    tooth.calculus = true;
  }
  if (finding.oralMarks.placa) {
    tooth.plaque = ["buccal"];
  }
  return tooth;
}

/** El diente guardado sin lo que deciden las marcas. */
function snapshotExtras(raw: unknown): EngineTooth {
  if (!isRecord(raw)) {
    return {};
  }
  const tooth: EngineTooth = { ...raw };
  for (const key of OWNED_KEYS) {
    delete tooth[key];
  }
  if (typeof tooth.endo === "string" && MARK_ENDO_VALUES.has(tooth.endo)) {
    delete tooth.endo;
  }
  return tooth;
}

function snapshotTeeth(source: unknown): Record<string, unknown> {
  return isRecord(source) && isRecord(source.teeth) ? source.teeth : {};
}

export function domainToChart(value: OdontogramValue): OdontogramSnapshot {
  const snapshot = value.visualSnapshot ?? {};
  const savedStatus = snapshotTeeth(snapshot);
  const savedPlan = snapshotTeeth(snapshot.plan);
  const teeth: Record<string, unknown> = {};
  const planTeeth: Record<string, unknown> = {};

  for (const finding of value.teeth) {
    const key = String(finding.fdi);
    const current = finding.marks.filter((mark) => mark.layer !== "plan");
    teeth[key] = withOralMarks(
      { ...snapshotExtras(savedStatus[key]), ...marksToEngineTooth(current) },
      finding,
    );
    // La carta del plan es la boca como quedará: lo actual más lo
    // planificado encima.
    planTeeth[key] = withOralMarks(
      {
        ...snapshotExtras(savedPlan[key] ?? savedStatus[key]),
        ...marksToEngineTooth(finding.marks, { plan: true }),
      },
      finding,
    );
  }

  const version = snapshot.version ?? 2.2;
  return {
    ...snapshot,
    version,
    teeth,
    plan: { ...(isRecord(snapshot.plan) ? snapshot.plan : {}), version, teeth: planTeeth },
  };
}

export function snapshotFromUnknown(value: unknown): OdontogramSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const snapshot: OdontogramSnapshot = {};
  if (typeof value.version === "string" || typeof value.version === "number") {
    snapshot.version = value.version;
  }
  snapshot.teeth = isRecord(value.teeth) ? value.teeth : {};
  if ("globals" in value) {
    snapshot.globals = value.globals;
  }
  if ("plan" in value) {
    snapshot.plan = value.plan;
  }
  return snapshot;
}

/**
 * Guarda en el valor lo que se editó directamente en el motor (tarjetas
 * de Endodoncia, Ortodoncia, ICD-10, perio). Las marcas no se tocan.
 */
export function withEngineSnapshot(
  value: OdontogramValue,
  chart: unknown,
): OdontogramValue {
  return { ...value, visualSnapshot: snapshotFromUnknown(chart) };
}

export function domainKey(value: OdontogramValue): string {
  return JSON.stringify({
    teeth: value.teeth,
    oralMarks: value.oralMarks,
    visualSnapshot: value.visualSnapshot ?? null,
  });
}
