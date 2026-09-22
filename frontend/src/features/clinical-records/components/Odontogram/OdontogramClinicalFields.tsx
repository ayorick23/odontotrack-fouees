import { useEffect, useState } from "react";

import {
  applyApicalDxToSelection,
  applyCalculusToSelection,
  applyDiagnosisToSelection,
  applyModToSelection,
  applyOrthoApplianceToSelection,
  applyOrthoDriftToSelection,
  applyOrthoRotationToSelection,
  applyOrthoVerticalToSelection,
  applyPulpEndoToSelection,
  clearDiagnosisFromSelection,
  readDiagnoses,
  readOrtho,
  readRootPerio,
  subscribeEngine,
  type EngineDiagnosis,
  type EngineOrtho,
  type EngineRootPerio,
} from "./engine";
import { OdontogramFieldSelect } from "./OdontogramFieldSelect";

const DX_LABELS: Record<string, string> = {
  caries: "Caries",
  periodontitis: "Periodontitis",
  gingivitis: "Gingivitis",
  cariesCementum: "Caries radicular",
  cariesArrested: "Caries detenida",
  pulpitis: "Pulpitis",
  pulpNecrosis: "Necrosis pulpar",
  apicalPeriodontitisAcute: "Periodontitis apical aguda",
  apicalPeriodontitisChronic: "Periodontitis apical crónica",
  radicularCyst: "Quiste radicular",
  periapicalAbscess: "Absceso periapical",
  periapicalAbscessSinus: "Periodontitis apical con fístula",
  condensingOsteitis: "Osteítis condensante",
  resorption: "Reabsorción dental",
  attrition: "Atrición",
  abrasion: "Abrasión",
  erosion: "Erosión",
  abfraction: "Abfracción",
  calculus: "Cálculo dental",
  fluorosis: "Fluorosis",
  tetracyclineStain: "Tinción por tetraciclina",
  postEruptiveColour: "Decoloración posteruptiva",
  toothLoss: "Pérdida dental",
  retainedRoot: "Raíz retenida",
  toothFracture: "Fractura dental",
  periImplantMucositis: "Mucositis periimplantaria",
  periImplantitis: "Periimplantitis",
};

function diagnosisLabel(key: string, icd10: string): string {
  const name = DX_LABELS[key] ?? key;
  return icd10 ? `${icd10} ${name}` : name;
}

const ORTHO_APPLIANCE = [
  { value: "none", label: "Ninguno" },
  { value: "bracket", label: "Bracket" },
  { value: "band", label: "Banda" },
];

const ORTHO_DRIFT = [
  { value: "none", label: "Ninguno" },
  { value: "mesial", label: "Mesial" },
  { value: "distal", label: "Distal" },
];

const ORTHO_VERTICAL = [
  { value: "none", label: "Ninguno" },
  { value: "extrusion", label: "Extrusión" },
  { value: "intrusion", label: "Intrusión" },
];

type OdontogramClinicalFieldsProps = {
  kind: "endodoncia" | "ortodoncia" | "diagnosticos";
  readOnly: boolean;
};

export function OdontogramClinicalFields({
  kind,
  readOnly,
}: OdontogramClinicalFieldsProps) {
  if (kind === "endodoncia") {
    return <EndoFields readOnly={readOnly} />;
  }
  if (kind === "ortodoncia") {
    return <OrthoFields readOnly={readOnly} />;
  }
  return <DiagnosisFields readOnly={readOnly} />;
}

function EndoFields({ readOnly }: { readOnly: boolean }) {
  const [state, setState] = useState<EngineRootPerio>(() => readRootPerio());

  useEffect(() => subscribeEngine(() => setState(readRootPerio())), []);

  if (!state.ready) {
    return <NeedTooth hint="Selecciona un diente para registrar pulpa y diagnóstico apical." />;
  }

  const pulpOptions = [
    ...(state.pulpNone ? [state.pulpNone] : []),
    ...state.pulpGroups.flatMap((group) => group.options),
  ];

  return (
    <div className="flex flex-col gap-3">
      <OdontogramFieldSelect
        label="Estado pulpar / endodoncia"
        value={state.pulpValue}
        options={state.pulpNone ? [state.pulpNone] : []}
        groups={state.pulpGroups.map((group) => ({
          ...group,
          options: group.options.filter(
            (option) => option.value !== state.pulpNone?.value,
          ),
        }))}
        disabled={readOnly || state.pulpDisabled || pulpOptions.length === 0}
        onChange={applyPulpEndoToSelection}
      />
      {state.apicalVisible ? (
        <OdontogramFieldSelect
          label="Diagnóstico apical"
          value={state.apicalValue}
          options={state.apicalOptions}
          disabled={readOnly || state.apicalDisabled}
          onChange={applyApicalDxToSelection}
        />
      ) : null}
      {state.calculusVisible ? (
        <ToggleChip
          label="Cálculo"
          pressed={state.calculusChecked}
          disabled={readOnly}
          onClick={() => applyCalculusToSelection(!state.calculusChecked)}
        />
      ) : null}
      {state.mods
        .filter((mod) => !mod.hidden)
        .map((mod) => (
          <ToggleChip
            key={mod.value}
            label={mod.label}
            pressed={mod.checked}
            disabled={readOnly}
            onClick={() => applyModToSelection(mod.value, !mod.checked)}
          />
        ))}
    </div>
  );
}

function OrthoFields({ readOnly }: { readOnly: boolean }) {
  const [state, setState] = useState<EngineOrtho>(() => readOrtho());

  useEffect(() => subscribeEngine(() => setState(readOrtho())), []);

  if (!state.ready) {
    return (
      <NeedTooth hint="Selecciona un diente presente para marcar brackets, bandas o movimiento." />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <OdontogramFieldSelect
        label="Aparato de ortodoncia"
        value={state.appliance}
        options={ORTHO_APPLIANCE}
        disabled={readOnly}
        onChange={applyOrthoApplianceToSelection}
      />
      <OdontogramFieldSelect
        label="Drift"
        value={state.drift}
        options={ORTHO_DRIFT}
        disabled={readOnly}
        onChange={applyOrthoDriftToSelection}
      />
      <OdontogramFieldSelect
        label="Vertical"
        value={state.vertical}
        options={ORTHO_VERTICAL}
        disabled={readOnly}
        onChange={applyOrthoVerticalToSelection}
      />
      <ToggleChip
        label="Rotación"
        pressed={state.rotation}
        disabled={readOnly}
        onClick={() => applyOrthoRotationToSelection(!state.rotation)}
      />
    </div>
  );
}

function DiagnosisFields({ readOnly }: { readOnly: boolean }) {
  const [state, setState] = useState<EngineDiagnosis>(() => readDiagnoses());

  useEffect(() => subscribeEngine(() => setState(readDiagnoses())), []);

  if (!state.ready) {
    return (
      <NeedTooth hint="Selecciona un diente para ver o añadir códigos ICD-10." />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {state.rows.length > 0 ? (
        <ul className="flex flex-col gap-1.5" aria-label="Diagnósticos del diente">
          {state.rows.map((row) => (
            <li
              key={row.key}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${
                row.suppressed
                  ? "bg-slate-50 text-slate-400 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
                  : "bg-white text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
              }`}
            >
              <span>{diagnosisLabel(row.key, row.icd10)}</span>
              {readOnly ? null : (
                <button
                  type="button"
                  className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
                  onClick={() => clearDiagnosisFromSelection(row.key)}
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sin diagnósticos ICD-10 en este diente.
        </p>
      )}
      <OdontogramFieldSelect
        label="Añadir diagnóstico"
        value=""
        placeholder="Añadir diagnóstico..."
        disabled={readOnly || state.addable.length === 0}
        options={state.addable.map((item) => ({
          value: item.key,
          label: diagnosisLabel(item.key, item.icd10),
        }))}
        onChange={(key) => {
          if (key) {
            applyDiagnosisToSelection(key);
          }
        }}
      />
    </div>
  );
}

function NeedTooth({ hint }: { hint: string }) {
  return (
    <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700">
      {hint}
    </p>
  );
}

function ToggleChip({
  label,
  pressed,
  disabled,
  onClick,
}: {
  label: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`w-fit rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
        pressed
          ? "border-teal-500 bg-teal-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}
