import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ORAL_GENERAL_MARK_LABELS,
  TOOTH_STATUS_GROUPS,
  TOOTH_STATUS_LABELS,
  emptyOralMarks,
  emptyPractice,
  isFdiToothNumber,
  updateTooth,
  type FdiToothNumber,
  type OralGeneralMark,
  type OdontogramValue,
  type ToothStatus,
} from "../../types";
import {
  applyStatusToSelection,
  applySurfaceToSelection,
  clearChartSelection,
  readActiveToothLayer,
} from "./engine";
import { OdontogramFieldSelect } from "./OdontogramFieldSelect";
import { OdontogramSurfaceDiagram } from "./OdontogramSurfaceDiagram";

const STATUS_BUTTON: Record<ToothStatus, string> = {
  sano: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  caries:
    "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  fractura:
    "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
  obturado:
    "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  sellante:
    "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  restauracion_temporal:
    "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200",
  endodoncia:
    "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  pulpotomia:
    "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  extraido:
    "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  raiz_retenida:
    "border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200",
  no_erupcionado:
    "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  ausente_congenito:
    "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  corona:
    "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200",
  puente:
    "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200",
  implante:
    "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
};

const STATUS_SWATCH: Record<ToothStatus, string> = {
  sano: "bg-slate-200 dark:bg-slate-600",
  caries: "bg-amber-400",
  fractura: "bg-red-400",
  obturado: "bg-violet-500",
  sellante: "bg-sky-400",
  restauracion_temporal: "bg-orange-400",
  endodoncia: "bg-rose-500",
  pulpotomia: "bg-rose-300",
  extraido: "bg-slate-500",
  raiz_retenida: "bg-stone-500",
  no_erupcionado: "bg-slate-400",
  ausente_congenito: "bg-slate-300",
  corona: "bg-teal-500",
  puente: "bg-cyan-600",
  implante: "bg-emerald-400",
};

const MARKS = Object.keys(ORAL_GENERAL_MARK_LABELS) as OralGeneralMark[];

type OdontogramToolbarProps = {
  value: OdontogramValue;
  onOralMarksChange: (value: OdontogramValue) => void;
  readOnly: boolean;
  focusedFdi?: number | null;
  clinicalAreas?: Array<{ slug: string; name: string }>;
  onClearFocus?: () => void;
};

export function OdontogramToolbar({
  value,
  onOralMarksChange,
  readOnly,
  focusedFdi,
  clinicalAreas = [],
  onClearFocus,
}: OdontogramToolbarProps) {
  const [surfaceMode, setSurfaceMode] = useState<"caries" | "obturado">(
    "caries",
  );
  const focused =
    focusedFdi != null && isFdiToothNumber(focusedFdi)
      ? value.teeth.find((tooth) => tooth.fdi === focusedFdi)
      : undefined;
  const focusedOral = focused?.oralMarks ?? emptyOralMarks();
  const focusedPractice = focused?.practice ?? emptyPractice();
  const extrasOpen =
    focusedOral.placa ||
    focusedOral.sangrado ||
    focusedOral.sarro ||
    focusedPractice.indicated;
  const [moreOpen, setMoreOpen] = useState(extrasOpen);

  useEffect(() => {
    setMoreOpen(extrasOpen);
  }, [focusedFdi, extrasOpen]);

  const layer = readActiveToothLayer();
  const surfaceStatus: ToothStatus =
    surfaceMode === "caries" ? "caries" : "obturado";
  const activeSurfaces =
    focused?.marks.find(
      (mark) => mark.layer === layer && mark.status === surfaceStatus,
    )?.surfaces ?? [];

  function requireFocusedTooth(): FdiToothNumber | null {
    if (focused && isFdiToothNumber(focused.fdi)) {
      return focused.fdi;
    }
    toast.error("Selecciona un diente primero.");
    return null;
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {focused ? `Diente ${focused.fdi}` : "Tratamiento"}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Cada marca guarda diente, superficies y capa (hallazgo, plan o
          hecho). Extraído e implante sustituyen al diente en esa capa.
          Sano la limpia.
        </p>
        {readOnly ? null : (
          <button
            type="button"
            onClick={() => {
              clearChartSelection();
              onClearFocus?.();
            }}
            className="mt-2 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
          >
            Borrar selección
          </button>
        )}
      </div>

      {TOOTH_STATUS_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.statuses.map((status) => (
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
      ))}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Superficies
        </p>
        <div className="mb-3 flex gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <button
            type="button"
            disabled={readOnly}
            aria-pressed={surfaceMode === "caries"}
            aria-label="Modo superficie caries"
            onClick={() => setSurfaceMode("caries")}
            className={`flex-1 rounded-full px-2 py-1 text-xs font-semibold transition ${
              surfaceMode === "caries"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                : "text-slate-500 dark:text-slate-400"
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
                ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Obturado
          </button>
        </div>
        <OdontogramSurfaceDiagram
          activeSurfaces={activeSurfaces}
          disabled={readOnly}
          mode={surfaceMode}
          onToggle={(surface, nextActive) =>
            applySurfaceToSelection(surface, nextActive, surfaceMode)
          }
        />
      </div>

      <div>
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
        >
          {moreOpen ? "Ocultar opciones" : "Más opciones"}
        </button>
        {moreOpen ? (
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Marcas del diente {focused ? focused.fdi : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {MARKS.map((mark) => {
                  const active = focusedOral[mark];
                  return (
                    <button
                      key={mark}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={active}
                      onClick={() => {
                        const fdi = requireFocusedTooth();
                        if (fdi == null) {
                          return;
                        }
                        onOralMarksChange(
                          updateTooth(value, fdi, {
                            oralMarks: {
                              ...focusedOral,
                              [mark]: !active,
                            },
                          }),
                        );
                      }}
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

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Práctica
              </p>
              <button
                type="button"
                disabled={readOnly}
                aria-pressed={focusedPractice.indicated}
                onClick={() => {
                  const fdi = requireFocusedTooth();
                  if (fdi == null) {
                    return;
                  }
                  onOralMarksChange(
                    updateTooth(value, fdi, {
                      practice: {
                        indicated: !focusedPractice.indicated,
                        clinicalArea: focusedPractice.indicated
                          ? null
                          : focusedPractice.clinicalArea,
                      },
                    }),
                  );
                }}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                  focusedPractice.indicated
                    ? "border-teal-500 bg-teal-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                Indicado para práctica
              </button>
              {focusedPractice.indicated ? (
                <div className="mt-2">
                  <OdontogramFieldSelect
                    label="Área clínica"
                    placeholder="Seleccionar área"
                    disabled={readOnly}
                    value={focusedPractice.clinicalArea ?? ""}
                    options={clinicalAreas.map((area) => ({
                      value: area.slug,
                      label: area.name,
                    }))}
                    onChange={(next) => {
                      const fdi = requireFocusedTooth();
                      if (fdi == null) {
                        return;
                      }
                      onOralMarksChange(
                        updateTooth(value, fdi, {
                          practice: {
                            indicated: true,
                            clinicalArea: next || null,
                          },
                        }),
                      );
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
