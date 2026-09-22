import { Save, Undo2 } from "lucide-react";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";

import { Odontogram } from "../../features/clinical-records/components/Odontogram";
import { useOdontogramData } from "../../features/clinical-records/hooks/useOdontogramData";
import {
  ORAL_GENERAL_MARK_LABELS,
  markedTeeth,
  type OralGeneralMark,
} from "../../features/clinical-records/types";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";

const cardClass =
  "rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-6";

type PatientOdontogramSectionProps = {
  patientId: number;
  patientName?: string;
  readOnly: boolean;
  darkMode: boolean;
};

export function PatientOdontogramSection({
  patientId,
  patientName,
  readOnly,
  darkMode,
}: PatientOdontogramSectionProps) {
  const {
    value,
    onChange,
    save,
    discard,
    reload,
    loadStatus,
    isSaving,
    isDirty,
    editorKey,
  } = useOdontogramData(patientId);
  const findingCount = markedTeeth(value).length;
  const activeMarks = (
    Object.entries(value.oralMarks) as Array<[OralGeneralMark, boolean]>
  )
    .filter(([, active]) => active)
    .map(([mark]) => ORAL_GENERAL_MARK_LABELS[mark]);

  const handleSave = useCallback(async () => {
    try {
      await save();
      toast.success("Odontograma guardado.");
    } catch {
      toast.error("No se pudo guardar el odontograma.");
    }
  }, [save]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (isDirty && !isSaving && loadStatus === "ready") {
          void handleSave();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, isDirty, isSaving, loadStatus, readOnly]);

  return (
    <section className={cardClass}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Odontograma
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Numeración FDI. Estado, plan, periodoncia y diagnósticos se
            guardan en el expediente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {findingCount > 0 ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {findingCount}{" "}
              {findingCount === 1 ? "hallazgo" : "hallazgos"}
            </span>
          ) : null}
          {activeMarks.map((label) => (
            <span
              key={label}
              className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300"
            >
              {label}
            </span>
          ))}
          {isDirty && !readOnly ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              Sin guardar
            </span>
          ) : null}
          {readOnly ? null : (
            <>
              <button
                type="button"
                className={secondaryActionClass}
                disabled={!isDirty || isSaving || loadStatus !== "ready"}
                onClick={() => {
                  discard();
                  toast.message("Cambios deshechos.");
                }}
              >
                <Undo2 className="size-4" />
                Deshacer
              </button>
              <button
                type="button"
                className={primaryActionClass}
                disabled={!isDirty || isSaving || loadStatus !== "ready"}
                onClick={() => {
                  void handleSave();
                }}
              >
                <Save className="size-4" />
                {isSaving ? "Guardando..." : "Guardar"}
              </button>
            </>
          )}
        </div>
      </div>

      {loadStatus === "loading" ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Cargando odontograma...
        </p>
      ) : null}

      {loadStatus === "error" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            No se pudo cargar el odontograma de este paciente.
          </p>
          <button
            type="button"
            className={secondaryActionClass}
            onClick={reload}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {loadStatus === "ready" ? (
        <Odontogram
          key={`${patientId}-${editorKey}`}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          darkMode={darkMode}
          patientId={patientId}
          patientName={patientName}
        />
      ) : null}
    </section>
  );
}
