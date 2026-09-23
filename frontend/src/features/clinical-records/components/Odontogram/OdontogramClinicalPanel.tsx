import { useState, type ReactNode } from "react";
import { MousePointerClick } from "lucide-react";

import type { OdontogramValue } from "../../types";
import { OdontogramClinicalFields } from "./OdontogramClinicalFields";
import { OdontogramToolbar } from "./OdontogramToolbar";

type ClinicalTab =
  | "tratamiento"
  | "endodoncia"
  | "periodoncia"
  | "ortodoncia"
  | "diagnosticos";

const TABS: Array<{ id: ClinicalTab; label: string }> = [
  { id: "tratamiento", label: "Tratamiento" },
  { id: "endodoncia", label: "Endodoncia" },
  { id: "periodoncia", label: "Periodoncia" },
  { id: "ortodoncia", label: "Ortodoncia" },
  { id: "diagnosticos", label: "ICD-10" },
];

type OdontogramClinicalPanelProps = {
  value: OdontogramValue;
  onOralMarksChange: (value: OdontogramValue) => void;
  readOnly: boolean;
  onOpenPerio: () => void;
  focusedFdi?: number | null;
  clinicalAreas?: Array<{ slug: string; name: string }>;
  onClearFocus?: () => void;
};

export function OdontogramClinicalPanel({
  value,
  onOralMarksChange,
  readOnly,
  onOpenPerio,
  focusedFdi,
  clinicalAreas = [],
  onClearFocus,
}: OdontogramClinicalPanelProps) {
  const [tab, setTab] = useState<ClinicalTab>("tratamiento");
  const hasTooth = focusedFdi != null;

  return (
    <aside className="flex min-w-0 flex-col gap-4 overflow-visible rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-950/40">
      <div
        className="flex flex-wrap gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
        role="tablist"
        aria-label="Paneles clínicos del odontograma"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              tab === item.id
                ? "bg-teal-600 text-white"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-w-0 overflow-visible">
        {tab === "tratamiento" ? (
          hasTooth ? (
            <OdontogramToolbar
              value={value}
              onOralMarksChange={onOralMarksChange}
              readOnly={readOnly}
              focusedFdi={focusedFdi}
              clinicalAreas={clinicalAreas}
              onClearFocus={onClearFocus}
            />
          ) : (
            <EmptyToothState />
          )
        ) : null}

        {tab === "endodoncia" ? (
          <ClinicalHint
            title="Endodoncia"
            body="Selecciona un diente para registrar pulpa, tratamiento endodóntico y diagnóstico apical."
          >
            <OdontogramClinicalFields kind="endodoncia" readOnly={readOnly} />
          </ClinicalHint>
        ) : null}

        {tab === "periodoncia" ? (
          <ClinicalHint
            title="Periodoncia"
            body="Sondaje de seis sitios, margen gingival, sangrado al sondaje y CAL. Los valores quedan en el expediente al guardar."
          >
            <button
              type="button"
              onClick={onOpenPerio}
              className="inline-flex items-center justify-center rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              Abrir carta periodontal
            </button>
          </ClinicalHint>
        ) : null}

        {tab === "ortodoncia" ? (
          <ClinicalHint
            title="Ortodoncia"
            body="Selecciona un diente presente para marcar brackets, bandas, drift, rotación o movimiento vertical."
          >
            <OdontogramClinicalFields kind="ortodoncia" readOnly={readOnly} />
          </ClinicalHint>
        ) : null}

        {tab === "diagnosticos" ? (
          <ClinicalHint
            title="Códigos ICD-10"
            body="Los hallazgos del diente seleccionado se traducen a ICD-10. Puedes añadir o silenciar un diagnóstico."
          >
            <OdontogramClinicalFields kind="diagnosticos" readOnly={readOnly} />
          </ClinicalHint>
        ) : null}
      </div>
    </aside>
  );
}

function EmptyToothState() {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
      <MousePointerClick
        className="size-8 text-slate-300 dark:text-slate-600"
        aria-hidden="true"
      />
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        Ningún diente seleccionado
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Haz clic en un diente de la carta para registrar estado, superficies y
        marcas.
      </p>
    </div>
  );
}

function ClinicalHint({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
      </div>
      {children}
    </div>
  );
}
