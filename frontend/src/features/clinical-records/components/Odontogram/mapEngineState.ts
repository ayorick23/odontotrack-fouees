import {
  emptyOdontogram,
  emptyOralMarks,
  findingStatuses,
  isFdiToothNumber,
  primaryToothStatus,
  type FdiToothNumber,
  type OdontogramSnapshot,
  type OdontogramValue,
  type ToothFinding,
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

/**
 * Extraído e implante sustituyen al diente. Caries, obturado y corona
 * pueden convivir en el mismo diente (superficies distintas o etapas).
 */
export function engineToothToFinding(
  fdi: FdiToothNumber,
  tooth: EngineTooth,
): ToothFinding {
  const selection = tooth.toothSelection ?? "tooth-base";
  const cariesSurfaces = uniqueSurfaces(tooth.caries ?? []);
  const fillingSurfaces = uniqueSurfaces(tooth.fillingSurfaces ?? []);
  const restoration = tooth.restorationType ?? "";

  if (selection === "none" || selection === "no-tooth-after-extraction") {
    return { fdi, status: "extraido", statuses: ["extraido"], surfaces: [] };
  }
  if (selection === "implant") {
    return { fdi, status: "implante", statuses: ["implante"], surfaces: [] };
  }

  const statuses: ToothStatus[] = [];
  if (
    restoration === "crown" ||
    restoration.startsWith("crown|") ||
    restoration === "bridge"
  ) {
    statuses.push("corona");
  }
  if (cariesSurfaces.length > 0) {
    statuses.push("caries");
  }
  if (fillingSurfaces.length > 0) {
    statuses.push("obturado");
  }

  const surfaces = uniqueSurfaces([
    ...(tooth.caries ?? []),
    ...(tooth.fillingSurfaces ?? []),
  ]);

  if (statuses.length === 0) {
    return { fdi, status: "sano", statuses: [], surfaces: [] };
  }
  return {
    fdi,
    status: primaryToothStatus(statuses),
    statuses,
    surfaces,
  };
}

function findingToEngineTooth(finding: ToothFinding): Record<string, unknown> {
  const statuses = findingStatuses(finding);
  const engineSurfaces = finding.surfaces.map(
    (surface) => DOMAIN_SURFACE_TO_ENGINE[surface],
  );
  const fallback = engineSurfaces.length > 0 ? engineSurfaces : ["occlusal"];

  if (statuses.includes("extraido")) {
    return { toothSelection: "none" };
  }
  if (statuses.includes("implante")) {
    return { toothSelection: "implant" };
  }

  const engineTooth: Record<string, unknown> = {
    toothSelection: "tooth-base",
  };
  if (statuses.includes("corona")) {
    engineTooth.restorationType = "crown";
  }
  if (statuses.includes("obturado")) {
    engineTooth.fillingMaterial = "composite";
    engineTooth.fillingSurfaces = fallback;
  }
  if (statuses.includes("caries")) {
    engineTooth.caries = fallback.map((surface) => `caries-${surface}`);
  }
  return engineTooth;
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

export function chartToDomain(chart: unknown): OdontogramValue {
  const result = emptyOdontogram();
  const snapshot = snapshotFromUnknown(chart);
  result.visualSnapshot = snapshot;

  const rawTeeth = snapshot?.teeth ?? {};
  const findings = new Map<FdiToothNumber, ToothFinding>();
  const oralMarks = emptyOralMarks();

  for (const [key, rawTooth] of Object.entries(rawTeeth)) {
    const number = Number(key);
    if (!isFdiToothNumber(number)) {
      continue;
    }
    const tooth = parseEngineTooth(rawTooth);
    findings.set(number, engineToothToFinding(number, tooth));
    if (tooth.calculus) {
      oralMarks.sarro = true;
    }
    if ((tooth.plaque?.length ?? 0) > 0) {
      oralMarks.placa = true;
    }
    if ((tooth.perio?.bop?.length ?? 0) > 0) {
      oralMarks.sangrado = true;
    }
  }

  result.teeth = result.teeth.map(
    (tooth) => findings.get(tooth.fdi) ?? tooth,
  );
  result.oralMarks = oralMarks;
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

  return { version: 2.2, teeth };
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
