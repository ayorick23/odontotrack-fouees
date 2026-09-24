import {
  defaultLayerForStatus,
  deriveOralMarks,
  emptyOdontogram,
  emptyOralMarks,
  emptyPractice,
  isFdiToothNumber,
  WHOLE_TOOTH_STATUSES,
  type FdiToothNumber,
  type OdontogramSnapshot,
  type OdontogramValue,
  type ToothFinding,
  type ToothLayer,
  type ToothMark,
  type ToothStatus,
  type ToothSurface,
} from "../../types";

type EngineTooth = {
  toothSelection?: string;
  restorationType?: string;
  caries?: string[];
  fillingSurfaces?: string[];
  calculus?: boolean;
  plaque?: string[];
  perio?: {
    bop?: string[];
  };
};

const ENGINE_SURFACE_TO_DOMAIN: Record<string, ToothSurface> = {
  mesial: "mesial",
  distal: "distal",
  buccal: "vestibular",
  lingual: "lingual",
  occlusal: "oclusal",
};

const DOMAIN_SURFACE_TO_ENGINE: Record<ToothSurface, string> = {
  mesial: "mesial",
  distal: "distal",
  vestibular: "buccal",
  lingual: "lingual",
  oclusal: "occlusal",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function parseEngineTooth(value: unknown): EngineTooth {
  if (!isRecord(value)) {
    return {};
  }
  const perio = isRecord(value.perio) ? value.perio : undefined;
  return {
    toothSelection:
      typeof value.toothSelection === "string"
        ? value.toothSelection
        : undefined,
    restorationType:
      typeof value.restorationType === "string"
        ? value.restorationType
        : undefined,
    caries: asStringArray(value.caries),
    fillingSurfaces: asStringArray(value.fillingSurfaces),
    calculus: value.calculus === true,
    plaque: asStringArray(value.plaque),
    perio: perio ? { bop: asStringArray(perio.bop) } : undefined,
  };
}

function surfaceFromEngineToken(token: string): ToothSurface | null {
  const name = token.startsWith("caries-") ? token.slice("caries-".length) : token;
  return ENGINE_SURFACE_TO_DOMAIN[name] ?? null;
}

function uniqueSurfaces(tokens: string[]): ToothSurface[] {
  const seen = new Set<ToothSurface>();
  for (const token of tokens) {
    const surface = surfaceFromEngineToken(token);
    if (surface) {
      seen.add(surface);
    }
  }
  return [...seen];
}

function markKey(mark: ToothMark): string {
  return `${mark.status}:${mark.surfaces.join(",")}`;
}

function withLayer(status: ToothStatus, surfaces: ToothSurface[], layer: ToothLayer): ToothMark {
  return {
    layer,
    status,
    surfaces: WHOLE_TOOTH_STATUSES.includes(status) ? [] : surfaces,
  };
}

/**
 * Extraído e implante sustituyen al diente. Caries y obturado
 * conviven: cada uno guarda sus propias superficies.
 */
export function engineToothToFinding(
  fdi: FdiToothNumber,
  tooth: EngineTooth,
  layer?: ToothLayer,
): ToothFinding {
  return {
    fdi,
    marks: engineToothToMarks(tooth, layer),
    oralMarks: emptyOralMarks(),
    practice: emptyPractice(),
  };
}

export function engineToothToMarks(
  tooth: EngineTooth,
  layer?: ToothLayer,
): ToothMark[] {
  const selection = tooth.toothSelection ?? "tooth-base";
  const cariesSurfaces = uniqueSurfaces(tooth.caries ?? []);
  const fillingSurfaces = uniqueSurfaces(tooth.fillingSurfaces ?? []);
  const restoration = tooth.restorationType ?? "";

  if (selection === "none" || selection === "no-tooth-after-extraction") {
    return [withLayer("extraido", [], layer ?? defaultLayerForStatus("extraido"))];
  }
  if (selection === "implant") {
    return [withLayer("implante", [], layer ?? defaultLayerForStatus("implante"))];
  }

  const marks: ToothMark[] = [];
  if (restoration === "bridge") {
    marks.push(withLayer("puente", [], layer ?? defaultLayerForStatus("puente")));
  } else if (restoration === "crown" || restoration.startsWith("crown|")) {
    marks.push(withLayer("corona", [], layer ?? defaultLayerForStatus("corona")));
  }
  if (cariesSurfaces.length > 0) {
    marks.push(
      withLayer("caries", cariesSurfaces, layer ?? defaultLayerForStatus("caries")),
    );
  }
  if (fillingSurfaces.length > 0) {
    marks.push(
      withLayer(
        "obturado",
        fillingSurfaces,
        layer ?? defaultLayerForStatus("obturado"),
      ),
    );
  }
  return marks;
}

function findingToEngineTooth(finding: ToothFinding): Record<string, unknown> {
  const marks = finding.marks.filter((mark) => mark.layer !== "plan");
  const statuses = marks.map((mark) => mark.status);

  if (statuses.includes("extraido") || statuses.includes("ausente_congenito") || statuses.includes("no_erupcionado") || statuses.includes("raiz_retenida")) {
    return { toothSelection: "none" };
  }
  if (statuses.includes("implante")) {
    return { toothSelection: "implant" };
  }

  const engineTooth: Record<string, unknown> = {
    toothSelection: "tooth-base",
  };
  if (statuses.includes("puente")) {
    engineTooth.restorationType = "bridge";
  } else if (statuses.includes("corona")) {
    engineTooth.restorationType = "crown";
  }

  const filling = marks.find(
    (mark) =>
      mark.status === "obturado" ||
      mark.status === "sellante" ||
      mark.status === "restauracion_temporal",
  );
  if (filling) {
    const surfaces = filling.surfaces.map(
      (surface) => DOMAIN_SURFACE_TO_ENGINE[surface],
    );
    engineTooth.fillingMaterial = "composite";
    engineTooth.fillingSurfaces =
      surfaces.length > 0 ? surfaces : ["occlusal"];
  }

  const caries = marks.find((mark) => mark.status === "caries" || mark.status === "fractura");
  if (caries) {
    const surfaces = caries.surfaces.map(
      (surface) => DOMAIN_SURFACE_TO_ENGINE[surface],
    );
    const fallback = surfaces.length > 0 ? surfaces : ["occlusal"];
    engineTooth.caries = fallback.map((surface) => `caries-${surface}`);
  }
  return engineTooth;
}

function planMarksToChart(teeth: ToothFinding[]): Record<string, unknown> {
  const planTeeth: Record<string, unknown> = {};
  for (const finding of teeth) {
    const planOnly: ToothFinding = {
      fdi: finding.fdi,
      marks: finding.marks.filter((mark) => mark.layer === "plan"),
      oralMarks: finding.oralMarks,
      practice: finding.practice,
    };
    if (planOnly.marks.length === 0) {
      continue;
    }
    planTeeth[String(finding.fdi)] = findingToEngineTooth(planOnly);
  }
  return planTeeth;
}

export function snapshotFromUnknown(value: unknown): OdontogramSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const snapshot: OdontogramSnapshot = {};
  if (typeof value.version === "string" || typeof value.version === "number") {
    snapshot.version = value.version;
  }
  if (isRecord(value.teeth)) {
    snapshot.teeth = value.teeth;
  }
  if ("globals" in value) {
    snapshot.globals = value.globals;
  }
  if ("plan" in value) {
    snapshot.plan = value.plan;
  }
  return snapshot.teeth ? snapshot : { ...snapshot, teeth: {} };
}

function marksFromChartTeeth(
  rawTeeth: Record<string, unknown>,
  layer?: ToothLayer,
): Map<FdiToothNumber, ToothMark[]> {
  const findings = new Map<FdiToothNumber, ToothMark[]>();
  for (const [key, rawTooth] of Object.entries(rawTeeth)) {
    const number = Number(key);
    if (!isFdiToothNumber(number)) {
      continue;
    }
    findings.set(number, engineToothToMarks(parseEngineTooth(rawTooth), layer));
  }
  return findings;
}

function previousMarkLayer(
  previous: ToothFinding | undefined,
  mark: ToothMark,
): ToothLayer | undefined {
  if (!previous) {
    return undefined;
  }
  const key = markKey(mark);
  return previous.marks.find((item) => markKey(item) === key)?.layer;
}

function mergeToothMarks(
  inferred: ToothMark[],
  planMarks: ToothMark[],
  previous: ToothFinding | undefined,
  activeLayer: ToothLayer,
): ToothMark[] {
  const statusMarks = inferred.map((mark) => {
    const kept = previousMarkLayer(previous, mark);
    if (kept && kept !== "plan") {
      return { ...mark, layer: kept };
    }
    if (previous) {
      return { ...mark, layer: activeLayer };
    }
    return mark;
  });
  const inferredKeys = new Set(inferred.map((mark) => markKey(mark)));
  const extraPlan = planMarks.filter((mark) => !inferredKeys.has(markKey(mark)));
  const previousPlan = previous?.marks.filter((mark) => mark.layer === "plan") ?? [];
  const keptPlan = extraPlan.length > 0 ? extraPlan : previousPlan;
  const merged = [...statusMarks, ...keptPlan];
  const seen = new Set<string>();
  return merged.filter((mark) => {
    const key = `${mark.layer}:${markKey(mark)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

type ChartToDomainOptions = {
  previous?: OdontogramValue;
  activeLayer?: ToothLayer;
};

export function chartToDomain(
  chart: unknown,
  options: ChartToDomainOptions = {},
): OdontogramValue {
  const result = emptyOdontogram();
  const snapshot = snapshotFromUnknown(chart);
  result.visualSnapshot = snapshot;

  const rawTeeth = snapshot?.teeth ?? {};
  const statusMarks = marksFromChartTeeth(rawTeeth);
  const planSource = isRecord(snapshot?.plan) && isRecord(snapshot.plan.teeth)
    ? snapshot.plan.teeth
    : {};
  const planMarks = marksFromChartTeeth(planSource, "plan");
  const engineOral = new Map<FdiToothNumber, ReturnType<typeof emptyOralMarks>>();
  const previousByFdi = new Map(
    (options.previous?.teeth ?? []).map((tooth) => [tooth.fdi, tooth]),
  );
  const activeLayer = options.activeLayer ?? "hallazgo";

  for (const [key, rawTooth] of Object.entries(rawTeeth)) {
    const number = Number(key);
    if (!isFdiToothNumber(number)) {
      continue;
    }
    const tooth = parseEngineTooth(rawTooth);
    engineOral.set(number, {
      placa: (tooth.plaque?.length ?? 0) > 0,
      sangrado: (tooth.perio?.bop?.length ?? 0) > 0,
      sarro: tooth.calculus === true,
    });
  }

  const baseTeeth =
    options.previous && options.previous.teeth.length > result.teeth.length
      ? options.previous.teeth
      : result.teeth;

  result.teeth = baseTeeth.map((tooth) => {
    const previous = previousByFdi.get(tooth.fdi);
    const fromEngine = engineOral.get(tooth.fdi);
    const baseMarks = previous?.oralMarks ?? tooth.oralMarks ?? emptyOralMarks();
    return {
      fdi: tooth.fdi,
      marks: mergeToothMarks(
        statusMarks.get(tooth.fdi) ?? [],
        planMarks.get(tooth.fdi) ?? [],
        previous,
        activeLayer,
      ),
      oralMarks: {
        placa: baseMarks.placa || Boolean(fromEngine?.placa),
        sangrado: baseMarks.sangrado || Boolean(fromEngine?.sangrado),
        sarro: baseMarks.sarro || Boolean(fromEngine?.sarro),
      },
      practice: previous?.practice ?? tooth.practice ?? emptyPractice(),
    };
  });
  result.oralMarks = deriveOralMarks(result.teeth);
  return result;
}

export function domainToChart(value: OdontogramValue): OdontogramSnapshot {
  if (value.visualSnapshot?.teeth) {
    return value.visualSnapshot;
  }

  const teeth: Record<string, unknown> = {};
  for (const finding of value.teeth) {
    const engineTooth = findingToEngineTooth(finding);
    if (value.oralMarks.sarro && engineTooth.toothSelection !== "none") {
      engineTooth.calculus = true;
    }
    if (value.oralMarks.placa && engineTooth.toothSelection !== "none") {
      engineTooth.plaque = ["buccal"];
    }
    teeth[String(finding.fdi)] = engineTooth;
  }

  const planTeeth = planMarksToChart(value.teeth);
  const snapshot: OdontogramSnapshot = { version: 2.2, teeth };
  if (Object.keys(planTeeth).length > 0) {
    snapshot.plan = { version: 2.2, teeth: planTeeth };
  }
  return snapshot;
}

export function domainKey(value: OdontogramValue): string {
  return JSON.stringify({
    teeth: value.teeth,
    oralMarks: value.oralMarks,
    visualSnapshot: value.visualSnapshot ?? null,
  });
}

export function teethKey(value: OdontogramValue): string {
  return JSON.stringify(value.teeth);
}
