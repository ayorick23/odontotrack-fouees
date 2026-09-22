import { useState } from "react";

import {
  ORAL_GENERAL_MARK_LABELS,
  TOOTH_STATUS_LABELS,
  TOOTH_SURFACE_LABELS,
  type OralGeneralMark,
  type OdontogramValue,
  type ToothStatus,
  type ToothSurface,
} from "../../types";
import {
  applyStatusToSelection,
  applySurfaceToSelection,
  clearChartSelection,
} from "./engine";

const STATUS_BUTTON: Record<ToothStatus, string> = {
  sano: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  caries:
    "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  obturado:
    "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  extraido:
    "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  corona:
    "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200",
  implante:
    "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
};

const STATUS_SWATCH: Record<ToothStatus, string> = {
  sano: "bg-slate-200 dark:bg-slate-600",
  caries: "bg-amber-400",
  obturado: "bg-violet-500",
  extraido: "bg-slate-500",
  corona: "bg-teal-500",
  implante: "bg-emerald-400",
};

const SURFACE_SHORT: Record<ToothSurface, string> = {
  vestibular: "V",
  mesial: "M",
  oclusal: "O",
  distal: "D",
  lingual: "L",
};

const STATUSES = Object.keys(TOOTH_STATUS_LABELS) as ToothStatus[];
const MARKS = Object.keys(ORAL_GENERAL_MARK_LABELS) as OralGeneralMark[];

type OdontogramToolbarProps = {
  value: OdontogramValue;
  onOralMarksChange: (value: OdontogramValue) => void;
  readOnly: boolean;
};

function SurfaceButton({
  surface,
  disabled,
  onClick,
}: {
  surface: ToothSurface;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={TOOTH_SURFACE_LABELS[surface]}
      aria-label={TOOTH_SURFACE_LABELS[surface]}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
    >
      {SURFACE_SHORT[surface]}
    </button>
  );
}

export function OdontogramToolbar({
  value,
  onOralMarksChange,
  readOnly,
}: OdontogramToolbarProps) {
  const [surfaceMode, setSurfaceMode] = useState<"caries" | "obturado">(
    "caries",
  );

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Tratamiento
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Los estados se suman en el mismo diente. Extraído e implante lo
          sustituyen. Sano lo limpia.
        </p>
        {readOnly ? null : (
          <button
            type="button"
            onClick={clearChartSelection}
            className="mt-2 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
          >
            Borrar selección
          </button>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Estado del diente
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              disabled={readOnly}
              onClick={() => applyStatusToSelection(status)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${STATUS_BUTTON[status]}`}
            >
              <span
                className={`size-2 rounded-full ${STATUS_SWATCH[status]}`}
                aria-hidden="true"
              />
              {TOOTH_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Superficies
        </p>
        <div className="mb-2 flex gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <button
            type="button"
            disabled={readOnly}
            aria-pressed={surfaceMode === "caries"}
            aria-label="Modo superficie caries"
            onClick={() => setSurfaceMode("caries")}
            className={`flex-1 rounded-full px-2 py-1 text-xs font-semibold transition ${
              surfaceMode === "caries"
                ? "bg-amber-100 text-amber-800"
                : "text-slate-500"
            }`}
          >
            Caries
          </button>
          <button
            type="button"
            disabled={readOnly}
            aria-pressed={surfaceMode === "obturado"}
            aria-label="Modo superficie obturado"
            onClick={() => setSurfaceMode("obturado")}
            className={`flex-1 rounded-full px-2 py-1 text-xs font-semibold transition ${
              surfaceMode === "obturado"
                ? "bg-violet-100 text-violet-800"
                : "text-slate-500"
            }`}
          >
            Obturado
          </button>
        </div>
        <div
          className="grid w-36 grid-cols-3 justify-items-center gap-1.5"
          role="group"
          aria-label="Superficies del diente"
        >
          <span />
          <SurfaceButton
            surface="vestibular"
            disabled={readOnly}
            onClick={() =>
              applySurfaceToSelection("vestibular", true, surfaceMode)
            }
          />
          <span />
          <SurfaceButton
            surface="mesial"
            disabled={readOnly}
            onClick={() => applySurfaceToSelection("mesial", true, surfaceMode)}
          />
          <SurfaceButton
            surface="oclusal"
            disabled={readOnly}
            onClick={() => applySurfaceToSelection("oclusal", true, surfaceMode)}
          />
          <SurfaceButton
            surface="distal"
            disabled={readOnly}
            onClick={() => applySurfaceToSelection("distal", true, surfaceMode)}
          />
          <span />
          <SurfaceButton
            surface="lingual"
            disabled={readOnly}
            onClick={() => applySurfaceToSelection("lingual", true, surfaceMode)}
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Marcas generales
        </p>
        <div className="flex flex-wrap gap-2">
          {MARKS.map((mark) => {
            const active = value.oralMarks[mark];
            return (
              <button
                key={mark}
                type="button"
                disabled={readOnly}
                aria-pressed={active}
                onClick={() =>
                  onOralMarksChange({
                    ...value,
                    oralMarks: {
                      ...value.oralMarks,
                      [mark]: !active,
                    },
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                  active
                    ? "border-teal-500 bg-teal-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                {ORAL_GENERAL_MARK_LABELS[mark]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
