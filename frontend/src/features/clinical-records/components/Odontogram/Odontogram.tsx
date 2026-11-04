import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  isToothStatus,
  withPrimaryTeeth,
  withoutPrimaryTeeth,
  type FdiToothNumber,
  type OdontogramValue,
  type OdontogramView,
  type PracticeArea,
  type ToothLayer,
} from "../../types";
import {
  applyPdfPatientName,
  applyToothLayer,
  readEngineChart,
  readSelectedFdi,
  subscribeEngine,
  writeEngineChart,
} from "./engine";
import { domainKey, domainToChart, withEngineSnapshot } from "./mapEngineState";
import { OdontogramChartMode } from "./OdontogramChartMode";
import { OdontogramChartViews } from "./OdontogramChartViews";
import { OdontogramClinicalPanel } from "./OdontogramClinicalPanel";
import { OdontogramChartRecord } from "./OdontogramChartRecord";
import "./odontogram.css";
import { applyToothLabelStates, toothLabelStates } from "./toothLabels";
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
 * Las marcas (`value.teeth[].marks`) son la única fuente de verdad: el
 * panel FOUEES las edita con funciones puras (edits.ts) y el dibujo se
 * regenera desde ellas (domainToChart). Del motor solo se escucha lo que
 * se edita en sus propias tarjetas (endo, orto, ICD-10, perio), que viaja
 * en `visualSnapshot` sin tocar las marcas.
 *
 * La app no debe importar OdontogramShell: si cambia la librería, solo se
 * reescribe esta carpeta. PNG/PDF se exportan desde la barra del expediente.
 */
export type OdontogramProps = {
  value?: OdontogramValue;
  onChange?: (findings: OdontogramValue) => void;
  readOnly?: boolean;
  darkMode?: boolean;
  patientId?: number;
  patientName?: string;
};

/** El motor solo distingue carta de estado y carta del plan. */
function engineLayer(view: OdontogramView): ToothLayer {
  return view === "plan" ? "plan" : "hallazgo";
}

function selectTile(fdi: number): void {
  const tile = document.querySelector(
    `.odontogram-fouees .tooth-tile[data-tooth="${fdi}"]`,
  );
  if (tile instanceof HTMLElement && !tile.classList.contains("active")) {
    tile.click();
  }
}

export function Odontogram({
  value,
  onChange,
  readOnly = false,
  darkMode = false,
  patientName,
}: OdontogramProps) {
  const onChangeRef = useRef(onChange);
  /** Último valor dibujado, con el snapshot tal como lo dejó el motor. */
  const drawnRef = useRef<OdontogramValue | undefined>(undefined);
  const drawnKeyRef = useRef("");
  const importingRef = useRef(false);
  const [view, setView] = useState<OdontogramView>("diagnostico");
  const viewRef = useRef<OdontogramView>("diagnostico");
  const [perioOpen, setPerioOpen] = useState(false);
  const [focusedFdi, setFocusedFdi] = useState<FdiToothNumber | null>(null);
  const focusedRef = useRef<FdiToothNumber | null>(null);
  const [clinicalAreas, setClinicalAreas] = useState<PracticeArea[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const treatmentNames = useMemo(
    () =>
      Object.fromEntries(
        clinicalAreas.flatMap((area) =>
          area.treatments.map((treatment) => [treatment.slug, treatment.name]),
        ),
      ) as Record<string, string>,
    [clinicalAreas],
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    focusedRef.current = focusedFdi;
  }, [focusedFdi]);

  useEffect(() => {
    let cancelled = false;
    listClinicalAreas(true)
      .then((areas) => {
        if (!cancelled) {
          setClinicalAreas(
            areas.map((area) => ({
              slug: area.slug,
              name: area.name,
              treatments: area.treatments
                .filter((treatment) => treatment.is_active)
                .map((treatment) => ({
                  slug: treatment.slug,
                  name: treatment.name,
                  odontogramStatus:
                    treatment.odontogram_status &&
                    isToothStatus(treatment.odontogram_status)
                      ? treatment.odontogram_status
                      : null,
                })),
            })),
          );
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

  const draw = useCallback((next: OdontogramValue) => {
    importingRef.current = true;
    try {
      writeEngineChart(domainToChart(next), engineLayer(viewRef.current));
    } finally {
      importingRef.current = false;
    }
    // El motor completa el snapshot con sus valores por defecto: esa es la
    // referencia, para que seleccionar un diente no cuente como cambio.
    drawnRef.current = withEngineSnapshot(next, readEngineChart());
    drawnKeyRef.current = domainKey(drawnRef.current);
    // Redibujar borra la selección del motor; las tarjetas la necesitan.
    if (focusedRef.current != null) {
      selectTile(focusedRef.current);
    }
  }, []);

  useEffect(() => {
    const emit = () => {
      if (importingRef.current) {
        return;
      }
      const selected = readSelectedFdi();
      if (selected != null && isFdiToothNumber(selected)) {
        setFocusedFdi(selected);
      }
      const drawn = drawnRef.current;
      if (!drawn) {
        return;
      }
      const next = withEngineSnapshot(drawn, readEngineChart());
      const key = domainKey(next);
      if (key === drawnKeyRef.current) {
        return;
      }
      drawnRef.current = next;
      drawnKeyRef.current = key;
      onChangeRef.current?.(next);
    };
    return subscribeEngine(emit);
  }, []);

  useEffect(() => {
    if (!value) {
      return;
    }
    // Lo que acaba de emitir el motor ya está dibujado.
    if (domainKey(value) === drawnKeyRef.current) {
      return;
    }
    draw(value);
  }, [value, draw]);

  const current = value ?? emptyOdontogram();

  // Números de pieza coloreados según lo que tiene cada una (toothLabels.ts).
  // La librería crea los números de forma asíncrona: se vuelve a aplicar
  // cuando agrega elementos, además de cada vez que cambian los datos.
  const labelStates = useMemo(() => toothLabelStates(current, view), [current, view]);
  const labelStatesRef = useRef(labelStates);
  useEffect(() => {
    labelStatesRef.current = labelStates;
    if (chartRef.current) {
      applyToothLabelStates(chartRef.current, labelStates);
    }
  }, [labelStates]);
  useEffect(() => {
    const root = chartRef.current;
    if (!root) {
      return;
    }
    const observer = new MutationObserver(() =>
      applyToothLabelStates(root, labelStatesRef.current),
    );
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  /** Enfoca la pieza en el panel y la selecciona en la librería (las
   * cartas de endodoncia u ortodoncia trabajan sobre esa selección). */
  const focusTooth = useCallback((fdi: FdiToothNumber) => {
    setFocusedFdi(fdi);
    selectTile(fdi);
  }, []);

  const changeView = (next: OdontogramView) => {
    viewRef.current = next;
    setView(next);
    applyToothLayer(engineLayer(next));
  };

  const planCounts = { pending: 0, done: 0 };
  let findingCount = 0;
  for (const tooth of current.teeth) {
    for (const mark of tooth.marks) {
      if (mark.layer === "hallazgo") {
        findingCount += 1;
      } else if (mark.layer === "plan") {
        planCounts.pending += 1;
      } else if (mark.layer === "hecho") {
        planCounts.done += 1;
      }
    }
    const { placa, sangrado, sarro } = tooth.oralMarks;
    if (placa || sangrado || sarro) {
      findingCount += 1;
    }
  }

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
            <OdontogramChartMode
              view={view}
              onViewChange={changeView}
              findingCount={findingCount}
              planCounts={planCounts}
              readOnly={readOnly}
            >
              {readOnly || !value ? null : (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    role="switch"
                    className="peer sr-only"
                    checked={hasPrimaryTeeth(value)}
                    onChange={(event) =>
                      onChange?.(
                        event.target.checked
                          ? withPrimaryTeeth(value)
                          : withoutPrimaryTeeth(value),
                      )
                    }
                  />
                  <span
                    className="relative h-5 w-9 rounded-full bg-slate-200 transition peer-checked:bg-teal-700 peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600/40 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4 dark:bg-slate-700"
                    aria-hidden="true"
                  />
                  Dentición temporal / mixta
                </label>
              )}
            </OdontogramChartMode>
            <div
              ref={chartRef}
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
                      onClick={() => focusTooth(fdi)}
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
            <OdontogramChartRecord
              value={current}
              treatmentNames={treatmentNames}
              focusedFdi={focusedFdi}
              onFocusTooth={focusTooth}
              onChange={readOnly ? undefined : onChange}
              onViewChange={changeView}
            />
          </div>
          {readOnly ? null : (
            <OdontogramClinicalPanel
              value={current}
              onChange={(next) => onChange?.(next)}
              readOnly={readOnly}
              view={view}
              onOpenPerio={() => setPerioOpen(true)}
              focusedFdi={focusedFdi}
              clinicalAreas={clinicalAreas}
              treatmentNames={treatmentNames}
              onClearFocus={() => setFocusedFdi(null)}
              onFocusTooth={focusTooth}
            />
          )}
        </div>
        <PerioChart open={perioOpen} onClose={() => setPerioOpen(false)} />
      </OdontogramProvider>
    </div>
  );
}
