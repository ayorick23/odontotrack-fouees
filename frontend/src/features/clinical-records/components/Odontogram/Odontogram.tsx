import { useEffect, useRef, useState } from "react";
import {
  OdontogramChartSurface,
  OdontogramProvider,
  PerioChart,
} from "react-advanced-odontogram";
import "react-advanced-odontogram/style.css";

import { emptyOdontogram, type OdontogramValue } from "../../types";
import {
  applyPdfPatientName,
  readEngineChart,
  subscribeEngine,
  writeEngineChart,
} from "./engine";
import { chartToDomain, domainKey, domainToChart, teethKey } from "./mapEngineState";
import { OdontogramChartMode } from "./OdontogramChartMode";
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
 * clínicas (endo, perio, orto, ICD-10) y las exportaciones PNG/PDF/FHIR.
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
  const initialValueRef = useRef(value);
  const oralMarksRef = useRef(value?.oralMarks);
  const importingRef = useRef(false);
  const [perioOpen, setPerioOpen] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    oralMarksRef.current = value?.oralMarks;
  }, [value]);

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
      const next = chartToDomain(readEngineChart());
      if (oralMarksRef.current) {
        next.oralMarks = oralMarksRef.current;
      }
      const key = domainKey(next);
      if (key === lastKeyRef.current) {
        return;
      }
      lastKeyRef.current = key;
      lastTeethKeyRef.current = teethKey(next);
      onChangeRef.current?.(next);
    };

    const unsubscribe = subscribeEngine(emit);
    const initialValue = initialValueRef.current;
    if (initialValue) {
      lastKeyRef.current = domainKey(initialValue);
      lastTeethKeyRef.current = teethKey(initialValue);
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
    <div className="odontogram-fouees" aria-label="Odontograma FDI">
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
            <div className="overflow-x-auto">
              <OdontogramChartSurface />
            </div>
            <OdontogramPlanDiff />
            <OdontogramFindings value={value ?? emptyOdontogram()} />
          </div>
          {readOnly ? null : (
            <OdontogramClinicalPanel
              value={value ?? emptyOdontogram()}
              onOralMarksChange={(next) => onChange?.(next)}
              readOnly={readOnly}
              patientId={patientId}
              onOpenPerio={() => setPerioOpen(true)}
            />
          )}
        </div>
        <PerioChart open={perioOpen} onClose={() => setPerioOpen(false)} />
      </OdontogramProvider>
    </div>
  );
}
