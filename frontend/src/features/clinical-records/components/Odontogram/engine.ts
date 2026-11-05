import {
  clearSelection,
  exportImage,
  exportPdf,
  addDiagnosisToSelection,
  getActiveDiagnoses,
  getActiveOrtho,
  getActiveRootPerio,
  getPlanChart,
  getStatusChart,
  importStatus,
  onStateChange,
  removeDiagnosisFromSelection,
  setApicalDxForSelection,
  setChartMode,
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
  setShowBase,
  setWisdomVisible,
} from "react-advanced-odontogram";
import { toast } from "sonner";

import type { ToothLayer } from "../../types";

/** Plan se ve en la carta del plan; Hallazgo y Hecho, en la del estado. */
export function applyToothLayer(layer: ToothLayer): void {
  setChartMode(layer === "plan" ? "plan" : "status");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function subscribeEngine(onChange: () => void): () => void {
  return onStateChange(onChange);
}

export function readEngineChart(): unknown {
  const status = getStatusChart();
  const chart = isRecord(status) ? status : { version: 2.2, teeth: {} };
  const plan = getPlanChart();
  if (isRecord(plan)) {
    return { ...chart, plan };
  }
  return chart;
}

/** Redibuja todo desde el payload de domainToChart, sin cambiar de capa. */
export function writeEngineChart(payload: unknown, layer: ToothLayer): void {
  importStatus(payload);
  if (isRecord(payload) && payload.plan != null) {
    setPlanChart(payload.plan);
  } else {
    setPlanChart(getStatusChart());
  }
  applyToothLayer(layer);
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

export function applyPdfPatientName(name: string): void {
  setPdfSettings({ defaultName: name, colorTheme: "slate" });
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
