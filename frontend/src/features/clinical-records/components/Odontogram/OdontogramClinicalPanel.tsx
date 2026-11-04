import { useState, type ReactNode } from "react";
import { ChevronDown, MousePointerClick } from "lucide-react";

import type {
  FdiToothNumber,
  OdontogramValue,
  OdontogramView,
  PracticeArea,
} from "../../types";
import { OdontogramClinicalFields } from "./OdontogramClinicalFields";
import { OdontogramToolbar } from "./OdontogramToolbar";

/** Registros que no se usan en cada consulta: van plegados. */
type SpecialtyTab = "endodoncia" | "periodoncia" | "ortodoncia" | "diagnosticos";

const SPECIALTY_TABS: Array<{ id: SpecialtyTab; label: string }> = [
  { id: "endodoncia", label: "Endodoncia" },
  { id: "periodoncia", label: "Periodoncia" },
  { id: "ortodoncia", label: "Ortodoncia" },
  { id: "diagnosticos", label: "ICD-10" },
];

type OdontogramClinicalPanelProps = {
  value: OdontogramValue;
  onChange: (value: OdontogramValue) => void;
  readOnly: boolean;
  view: OdontogramView;
  onOpenPerio: () => void;
  focusedFdi?: number | null;
  clinicalAreas?: PracticeArea[];
  treatmentNames?: Record<string, string>;
  onClearFocus?: () => void;
  onFocusTooth?: (fdi: FdiToothNumber) => void;
};

/**
 * Panel derecho: arriba lo que se usa siempre (el diente seleccionado en la
 * vista actual); abajo, plegados, los registros especializados.
 */
export function OdontogramClinicalPanel({
  value,
  onChange,
  readOnly,
  view,
  onOpenPerio,
  focusedFdi,
  clinicalAreas = [],
  treatmentNames = {},
  onClearFocus,
  onFocusTooth,
}: OdontogramClinicalPanelProps) {
  const [specialtyOpen, setSpecialtyOpen] = useState(false);
  const [tab, setTab] = useState<SpecialtyTab>("endodoncia");
  const hasTooth = focusedFdi != null;

  return (
    <aside className="flex min-w-0 flex-col gap-4 self-start overflow-visible rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <div className="min-w-0 overflow-visible">
        {hasTooth ? (
          <OdontogramToolbar
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            view={view}
            focusedFdi={focusedFdi}
            clinicalAreas={clinicalAreas}
            treatmentNames={treatmentNames}
            onClearFocus={onClearFocus}
            onFocusTooth={onFocusTooth}
          />
        ) : (
          <EmptyToothState />
        )}
      </div>

      <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          aria-expanded={specialtyOpen}
          onClick={() => setSpecialtyOpen((open) => !open)}
          className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
        >
          Registros especializados
          <ChevronDown
            className={`size-4 transition ${specialtyOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {specialtyOpen ? (
          <div className="mt-3 flex flex-col gap-4">
            <div
              className="flex flex-wrap gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
              role="tablist"
              aria-label="Registros especializados del odontograma"
            >
              {SPECIALTY_TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    tab === item.id
                      ? "bg-teal-700 text-white"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

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
                  className="inline-flex items-center justify-center rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
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
        Haz clic en un diente de la carta para registrar su diagnóstico o
        planificar un tratamiento.
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
