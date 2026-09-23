import {
  clearSelection,
  exportImage,
  exportPdf,
  addDiagnosisToSelection,
  getActiveDiagnoses,
  getActiveOrtho,
  getActiveRootPerio,
  getChartMode,
  getPlanChanges,
  getPlanChart,
  getStatusChart,
  importStatus,
  onStateChange,
  removeDiagnosisFromSelection,
  resetTooth,
  setApicalDxForSelection,
  setCalculusForSelection,
  setCariesSurfaceForSelection,
  setChartMode,
  setFillingMaterialForSelection,
  setFillingSurfaceForSelection,
  setHealthyPulpVisible,
  setModForSelection,
  setOrthoApplianceForSelection,
  setOrthoDriftForSelection,
  setOrthoRotationForSelection,
  setOrthoVerticalForSelection,
  setOcclusalVisible,
  setPdfSettings,
  setPlanChart,
  setPulpEndoForSelection,
  setRestorationForSelection,
  setShowBase,
  setToothSelectionForSelection,
  setWisdomVisible,
} from "react-advanced-odontogram";
import { toast } from "sonner";

import type { ToothLayer, ToothStatus, ToothSurface } from "../../types";

let activeToothLayer: ToothLayer = "hallazgo";

export function readActiveToothLayer(): ToothLayer {
  return activeToothLayer;
}

export function applyToothLayer(layer: ToothLayer): void {
  activeToothLayer = layer;
  setChartMode(layer === "plan" ? "plan" : "status");
}

export type EngineChartMode = "status" | "plan";

export type EnginePlanChange = {
  toothNo: number;
  axis: string;
  from: string;
  to: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const SURFACE_TO_ENGINE: Record<ToothSurface, string> = {
  mesial: "mesial",
  distal: "distal",
  vestibular: "buccal",
  lingual: "lingual",
  oclusal: "occlusal",
};

export function subscribeEngine(onChange: () => void): () => void {
  return onStateChange(onChange);
}

export function readEngineChart(): unknown {
  const status = getStatusChart();
  const chart = isRecord(status) ? status : { version: 2.2, teeth: {} };
  if (readPlanChanges().length === 0) {
    return chart;
  }
  return { ...chart, plan: getPlanChart() };
}

export function writeEngineChart(payload: unknown): void {
  importStatus(payload);
  if (isRecord(payload) && payload.plan != null) {
    setPlanChart(payload.plan);
  } else {
    setPlanChart(getStatusChart());
  }
  activeToothLayer = "hallazgo";
  setChartMode("status");
  setWisdomVisible(true);
  setShowBase(true);
  setOcclusalVisible(true);
  setHealthyPulpVisible(true);
}

export function applyOcclusalVisible(on: boolean): void {
  setOcclusalVisible(on);
}

export function applyBoneVisible(on: boolean): void {
  setShowBase(on);
}

export function applyPulpVisible(on: boolean): void {
  setHealthyPulpVisible(on);
}

export function readChartMode(): EngineChartMode {
  return getChartMode();
}

export function applyChartMode(mode: EngineChartMode): void {
  setChartMode(mode);
}

export function readPlanChanges(): EnginePlanChange[] {
  const changes = getPlanChanges();
  if (!Array.isArray(changes)) {
    return [];
  }
  return changes.filter(
    (change): change is EnginePlanChange =>
      isRecord(change) &&
      typeof change.toothNo === "number" &&
      typeof change.axis === "string" &&
      typeof change.from === "string" &&
      typeof change.to === "string",
  );
}

export function applyPdfPatientName(name: string): void {
  setPdfSettings({ defaultName: name, colorTheme: "teal" });
}

export async function exportChartPng(): Promise<void> {
  await exportImage("png");
}

export async function exportChartPdf(): Promise<void> {
  await exportPdf({
    patientData: true,
    odontogramChart: true,
    odontogramDescription: true,
    individualNotes: true,
    perioStatus: true,
    perioDescription: true,
  });
}

export function clearChartSelection(): void {
  clearSelection();
}

export function hasChartSelection(): boolean {
  const tiles = document.querySelectorAll(".odontogram-fouees .tooth-tile");
  if (tiles.length === 0) {
    return true;
  }
  return document.querySelectorAll(".odontogram-fouees .tooth-tile.active").length > 0;
}

export function readSelectedFdi(): number | null {
  const tile = document.querySelector(".odontogram-fouees .tooth-tile.active");
  if (!(tile instanceof HTMLElement)) {
    return null;
  }
  const raw = tile.getAttribute("data-tooth");
  if (raw == null) {
    return null;
  }
  const fdi = Number(raw);
  return Number.isInteger(fdi) ? fdi : null;
}

function requireSelection(): boolean {
  if (hasChartSelection()) {
    return true;
  }
  toast.error("Selecciona un diente en la carta primero.");
  return false;
}

export function applyStatusToSelection(status: ToothStatus): void {
  if (!requireSelection()) {
    return;
  }
  if (status === "sano") {
    resetTooth();
    return;
  }
  if (
    status === "extraido" ||
    status === "ausente_congenito" ||
    status === "no_erupcionado" ||
    status === "raiz_retenida"
  ) {
    setToothSelectionForSelection("none");
    return;
  }
  if (status === "implante") {
    setToothSelectionForSelection("implant");
    return;
  }
  if (status === "puente") {
    setRestorationForSelection("bridge");
    return;
  }
  if (status === "corona") {
    setRestorationForSelection("crown|zircon");
    return;
  }
  if (status === "caries" || status === "fractura") {
    setCariesSurfaceForSelection("caries-occlusal", true);
    return;
  }
  if (
    status === "endodoncia" ||
    status === "pulpotomia"
  ) {
    return;
  }
  setFillingMaterialForSelection("composite");
  setFillingSurfaceForSelection("occlusal", true);
}

export type EngineOption = {
  value: string;
  label: string;
};

export type EngineOptGroup = {
  label: string;
  options: EngineOption[];
};

export type EngineRootPerio = {
  ready: boolean;
  pulpValue: string;
  pulpDisabled: boolean;
  pulpNone: EngineOption | null;
  pulpGroups: EngineOptGroup[];
  apicalValue: string;
  apicalDisabled: boolean;
  apicalVisible: boolean;
  apicalOptions: EngineOption[];
  calculusChecked: boolean;
  calculusVisible: boolean;
  mods: Array<{
    value: string;
    label: string;
    checked: boolean;
    hidden: boolean;
  }>;
};

export type EngineOrtho = {
  ready: boolean;
  appliance: string;
  drift: string;
  vertical: string;
  rotation: boolean;
};

export type EngineDiagnosis = {
  ready: boolean;
  rows: Array<{
    key: string;
    icd10: string;
    source: "derived" | "added";
    suppressed: boolean;
  }>;
  addable: Array<{ key: string; icd10: string }>;
};

function asOption(value: unknown): EngineOption | null {
  if (!isRecord(value) || typeof value.value !== "string") {
    return null;
  }
  return {
    value: value.value,
    label: typeof value.label === "string" ? value.label : value.value,
  };
}

function asOptions(value: unknown): EngineOption[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(asOption).filter((item): item is EngineOption => item !== null);
}

function asGroups(value: unknown): EngineOptGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((group) => {
    if (!isRecord(group) || typeof group.label !== "string") {
      return [];
    }
    return [{ label: group.label, options: asOptions(group.options) }];
  });
}

export function readRootPerio(): EngineRootPerio {
  const raw = getActiveRootPerio();
  return {
    ready: raw.sectionVisible && raw.rootBlockVisible,
    pulpValue: raw.pulpEndoValue ?? "",
    pulpDisabled: raw.pulpEndoDisabled,
    pulpNone: raw.pulpEndoNoneOption
      ? { value: raw.pulpEndoNoneOption.value, label: raw.pulpEndoNoneOption.label }
      : null,
    pulpGroups: asGroups(raw.pulpEndoGroups),
    apicalValue: raw.apicalDxValue ?? "",
    apicalDisabled: raw.apicalDxDisabled,
    apicalVisible: raw.apicalDxRowVisible,
    apicalOptions: asOptions(raw.apicalDxOptions),
    calculusChecked: raw.calculusChecked,
    calculusVisible: raw.calculusRowVisible,
    mods: (raw.mods ?? []).map((mod) => ({
      value: mod.value,
      label: mod.label,
      checked: mod.checked,
      hidden: mod.hiddenClass || mod.styleHidden,
    })),
  };
}

export function readOrtho(): EngineOrtho {
  const raw = getActiveOrtho();
  if (!raw?.visible) {
    return {
      ready: false,
      appliance: "none",
      drift: "none",
      vertical: "none",
      rotation: false,
    };
  }
  return {
    ready: true,
    appliance: raw.appliance || "none",
    drift: raw.drift || "none",
    vertical: raw.vertical || "none",
    rotation: raw.rotation,
  };
}

export function readDiagnoses(): EngineDiagnosis {
  const raw = getActiveDiagnoses();
  return {
    ready: raw.visible,
    rows: raw.rows ?? [],
    addable: raw.addableKeys ?? [],
  };
}

export function applyPulpEndoToSelection(value: string): void {
  if (!requireSelection()) {
    return;
  }
  setPulpEndoForSelection(value);
}

export function applyApicalDxToSelection(value: string): void {
  if (!requireSelection()) {
    return;
  }
  setApicalDxForSelection(value);
}

export function applyCalculusToSelection(on: boolean): void {
  if (!requireSelection()) {
    return;
  }
  setCalculusForSelection(on);
}

export function applyModToSelection(id: string, on: boolean): void {
  if (!requireSelection()) {
    return;
  }
  setModForSelection(id, on);
}

export function applyOrthoApplianceToSelection(value: string): void {
  if (!requireSelection()) {
    return;
  }
  setOrthoApplianceForSelection(value);
}

export function applyOrthoDriftToSelection(value: string): void {
  if (!requireSelection()) {
    return;
  }
  setOrthoDriftForSelection(value);
}

export function applyOrthoVerticalToSelection(value: string): void {
  if (!requireSelection()) {
    return;
  }
  setOrthoVerticalForSelection(value);
}

export function applyOrthoRotationToSelection(on: boolean): void {
  if (!requireSelection()) {
    return;
  }
  setOrthoRotationForSelection(on);
}

export function applyDiagnosisToSelection(key: string): void {
  if (!requireSelection()) {
    return;
  }
  addDiagnosisToSelection(key);
}

export function clearDiagnosisFromSelection(key: string): void {
  if (!requireSelection()) {
    return;
  }
  removeDiagnosisFromSelection(key);
}

export function applySurfaceToSelection(
  surface: ToothSurface,
  active: boolean,
  mode: "caries" | "obturado",
): void {
  if (!requireSelection()) {
    return;
  }
  const engineSurface = SURFACE_TO_ENGINE[surface];
  if (mode === "caries") {
    setCariesSurfaceForSelection(`caries-${engineSurface}`, active);
    return;
  }
  if (active) {
    setFillingMaterialForSelection("composite");
  }
  setFillingSurfaceForSelection(engineSurface, active);
}
