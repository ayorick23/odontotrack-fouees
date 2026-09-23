import { useEffect, useRef, useState } from "react";
import {
  OdontogramChartSurface,
  OdontogramProvider,
  PerioChart,
} from "react-advanced-odontogram";
import "react-advanced-odontogram/style.css";

import { listClinicalAreas } from "../../../../services/catalogs";
import {
  FDI_PRIMARY_TOOTH_NUMBERS,
  emptyOdontogram,
  hasPrimaryTeeth,
  isFdiToothNumber,
  withPrimaryTeeth,
  withoutPrimaryTeeth,
  type FdiToothNumber,
  type OdontogramValue,
} from "../../types";
import {
  applyPdfPatientName,
  readActiveToothLayer,
  readEngineChart,
  readSelectedFdi,
  subscribeEngine,
  writeEngineChart,
} from "./engine";
import { chartToDomain, domainKey, domainToChart, teethKey } from "./mapEngineState";
import { OdontogramChartMode } from "./OdontogramChartMode";
import { OdontogramChartViews } from "./OdontogramChartViews";
import { OdontogramClinicalPanel } from "./OdontogramClinicalPanel";
import { OdontogramFindings } from "./OdontogramFindings";
import { OdontogramPlanDiff } from "./OdontogramPlanDiff";
import "./odontogram.css";
import {
  FOUEES_ODONTOGRAM_THEME,
  FOUEES_ODONTOGRAM_THEME_DARK,
} from "./theme";

/**
 * Wrapper FOUEES sobre react-advanced-odontogram.
 *
 * Se eligió esta librería porque trae SVG con sombreado realista, numeración
 * FDI nativa y tipos TypeScript. Documentación:
 * https://github.com/ZoliQua/React-Odontogram-Modul
 *
 * La app no debe importar OdontogramShell: si cambia la librería, solo se
 * reescribe esta carpeta. El gráfico y el panel FOUEES envuelven las cartas
 * clínicas (endo, perio, orto, ICD-10). PNG/PDF se exportan desde la barra
 * del expediente.
 */
export type OdontogramProps = {
  value?: OdontogramValue;
  onChange?: (findings: OdontogramValue) => void;
  readOnly?: boolean;
  darkMode?: boolean;
  patientId?: number;
  patientName?: string;
};

export function Odontogram({
  value,
  onChange,
  readOnly = false,
  darkMode = false,
  patientId,
  patientName,
}: OdontogramProps) {
  const onChangeRef = useRef(onChange);
  const lastKeyRef = useRef("");
  const lastTeethKeyRef = useRef("");
  const lastDomainRef = useRef<OdontogramValue | undefined>(value);
  const initialValueRef = useRef(value);
  const importingRef = useRef(false);
  const [perioOpen, setPerioOpen] = useState(false);
  const [focusedFdi, setFocusedFdi] = useState<FdiToothNumber | null>(null);
  const [clinicalAreas, setClinicalAreas] = useState<
    Array<{ slug: string; name: string }>
  >([]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    listClinicalAreas(true)
      .then((areas) => {
        if (!cancelled) {
          setClinicalAreas(areas.map((area) => ({ slug: area.slug, name: area.name })));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClinicalAreas([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (patientName) {
      applyPdfPatientName(patientName);
    }
  }, [patientName]);

  useEffect(() => {
    const emit = () => {
      if (importingRef.current) {
        return;
      }
      const previous = lastDomainRef.current;
      const next = chartToDomain(readEngineChart(), {
        previous,
        activeLayer: readActiveToothLayer(),
      });
      const key = domainKey(next);
      const selected = readSelectedFdi();
      if (selected != null && isFdiToothNumber(selected)) {
        setFocusedFdi(selected);
      }
      if (key === lastKeyRef.current) {
        return;
      }
      const changed = next.teeth.find((tooth) => {
        const before = previous?.teeth.find((item) => item.fdi === tooth.fdi);
        return JSON.stringify(tooth.marks) !== JSON.stringify(before?.marks);
      });
      if (changed && changed.marks.length > 0) {
        setFocusedFdi(changed.fdi);
      }
      lastKeyRef.current = key;
      lastTeethKeyRef.current = teethKey(next);
      lastDomainRef.current = next;
      onChangeRef.current?.(next);
    };

    const unsubscribe = subscribeEngine(emit);
    const initialValue = initialValueRef.current;
    if (initialValue) {
      lastKeyRef.current = domainKey(initialValue);
      lastTeethKeyRef.current = teethKey(initialValue);
      lastDomainRef.current = initialValue;
      importingRef.current = true;
      writeEngineChart(domainToChart(initialValue));
      importingRef.current = false;
    } else {
      emit();
    }

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!value) {
      return;
    }
    const key = domainKey(value);
    if (key === lastKeyRef.current) {
      return;
    }
    lastKeyRef.current = key;
    lastDomainRef.current = value;
    const nextTeethKey = teethKey(value);
    if (nextTeethKey === lastTeethKeyRef.current) {
      return;
    }
    lastTeethKeyRef.current = nextTeethKey;
    importingRef.current = true;
    writeEngineChart(domainToChart(value));
    importingRef.current = false;
  }, [value]);

  return (
    <div className="odontogram-fouees" aria-label="Odontograma FDI" translate="no">
      <OdontogramProvider
        language="es"
        numberingSystem="FDI"
        darkMode={darkMode}
        readOnly={readOnly}
        themeConfig={
          darkMode ? FOUEES_ODONTOGRAM_THEME_DARK : FOUEES_ODONTOGRAM_THEME
        }
        showStatusCard={false}
        showOrthoCard={false}
        fillingComplexity="simple"
        pulpDetailLevel="aae"
      >
        <div
          className={
            readOnly
              ? undefined
              : "grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start"
          }
        >
          <div className="min-w-0 space-y-3">
            <OdontogramChartMode readOnly={readOnly} />
            {readOnly || !value ? null : (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={hasPrimaryTeeth(value)}
                  onChange={(event) =>
                    onChange?.(
                      event.target.checked
                        ? withPrimaryTeeth(value)
                        : withoutPrimaryTeeth(value),
                    )
                  }
                />
                Dentición temporal / mixta
              </label>
            )}
            <div
              className="odontogram-chart-wrap overflow-x-auto"
              onClick={(event) => {
                const tile = (event.target as Element).closest(".tooth-tile");
                if (!(tile instanceof HTMLElement)) {
                  return;
                }
                const fdi = Number(tile.getAttribute("data-tooth"));
                if (isFdiToothNumber(fdi)) {
                  setFocusedFdi(fdi);
                }
              }}
            >
              <OdontogramChartViews />
              <OdontogramChartSurface />
            </div>
            {value && hasPrimaryTeeth(value) ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Temporales
                </p>
                <div className="flex flex-wrap gap-1">
                  {FDI_PRIMARY_TOOTH_NUMBERS.map((fdi) => (
                    <button
                      key={fdi}
                      type="button"
                      onClick={() => setFocusedFdi(fdi)}
                      className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${
                        focusedFdi === fdi
                          ? "bg-teal-600 text-white ring-teal-600"
                          : "bg-white text-slate-600 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                      }`}
                    >
                      {fdi}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <OdontogramPlanDiff />
            <OdontogramFindings
              value={value ?? emptyOdontogram()}
              focusedFdi={focusedFdi}
              onFocusTooth={setFocusedFdi}
            />
          </div>
          {readOnly ? null : (
            <OdontogramClinicalPanel
              value={value ?? emptyOdontogram()}
              onOralMarksChange={(next) => onChange?.(next)}
              readOnly={readOnly}
              onOpenPerio={() => setPerioOpen(true)}
              focusedFdi={focusedFdi}
              clinicalAreas={clinicalAreas}
              onClearFocus={() => setFocusedFdi(null)}
            />
          )}
        </div>
        <PerioChart open={perioOpen} onClose={() => setPerioOpen(false)} />
      </OdontogramProvider>
    </div>
  );
}
