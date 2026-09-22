import { useState, type ReactNode } from "react";
import { FileDown, FileJson, Image } from "lucide-react";
import { toast } from "sonner";

import type { OdontogramValue } from "../../types";
import { OdontogramClinicalFields } from "./OdontogramClinicalFields";
import { exportChartFhir, exportChartPdf, exportChartPng } from "./engine";
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
  patientId?: number;
  onOpenPerio: () => void;
};

export function OdontogramClinicalPanel({
  value,
  onOralMarksChange,
  readOnly,
  patientId,
  onOpenPerio,
}: OdontogramClinicalPanelProps) {
  const [tab, setTab] = useState<ClinicalTab>("tratamiento");

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
          <OdontogramToolbar
            value={value}
            onOralMarksChange={onOralMarksChange}
            readOnly={readOnly}
          />
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

      <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Exportar
        </p>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            label="PNG"
            icon={<Image className="size-4" />}
            onClick={async () => {
              try {
                await exportChartPng();
              } catch {
                toast.error("No se pudo exportar el PNG.");
              }
            }}
          />
          <ExportButton
            label="PDF"
            icon={<FileDown className="size-4" />}
            onClick={async () => {
              try {
                await exportChartPdf();
              } catch {
                toast.error("No se pudo exportar el PDF.");
              }
            }}
          />
          <ExportButton
            label="FHIR"
            icon={<FileJson className="size-4" />}
            onClick={() => {
              try {
                exportChartFhir(patientId);
                toast.success("Bundle FHIR descargado.");
              } catch {
                toast.error("No se pudo exportar FHIR.");
              }
            }}
          />
        </div>
      </div>
    </aside>
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

function ExportButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
    >
      {icon}
      {label}
    </button>
  );
}
