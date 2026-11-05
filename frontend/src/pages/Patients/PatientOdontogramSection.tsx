import { ChevronDown, History, Save, Undo2 } from "../../components/icons";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { UnsavedChangesGuard } from "../../components/UnsavedChangesGuard";
import { Odontogram } from "../../features/clinical-records/components/Odontogram";
import { changedTeethCount } from "../../features/clinical-records/components/Odontogram/changes";
import { OdontogramExportButtons } from "../../features/clinical-records/components/Odontogram/OdontogramExportButtons";
import { useOdontogramData } from "../../features/clinical-records/hooks/useOdontogramData";
import {
  ORAL_GENERAL_MARK_LABELS,
  type OdontogramValue,
  type OralGeneralMark,
} from "../../features/clinical-records/types";
import { GLASS_PANEL, SOLID_BLOCK } from "../../components/listing/styles";
import { secondaryActionClass } from "../../lib/actions";
import {
  listOdontogramHistory,
  revisionToDomain,
  type OdontogramRevisionRecord,
} from "../../services/odontogram";

const REVISION_DATE = new Intl.DateTimeFormat("es-SV", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "31 oct 2026, 2:05 p. m. · Lucía Zepeda" */
function revisionLabel(revision: OdontogramRevisionRecord): string {
  const date = REVISION_DATE.format(new Date(revision.created_at));
  return revision.created_by_name ? `${date} · ${revision.created_by_name}` : date;
}

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
    savedValue,
    onChange,
    save,
    undo,
    canUndo,
    discard,
    reload,
    loadStatus,
    isSaving,
    isDirty,
    editorKey,
  } = useOdontogramData(patientId);
  const [revisions, setRevisions] = useState<OdontogramRevisionRecord[]>([]);
  const [viewingRevisionId, setViewingRevisionId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listOdontogramHistory(patientId)
      .then((items) => {
        if (!cancelled) {
          setRevisions(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRevisions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, value.visualSnapshot, loadStatus]);

  const viewingRevision = revisions.find((item) => item.id === viewingRevisionId);
  const displayedValue: OdontogramValue = viewingRevision
    ? revisionToDomain(viewingRevision)
    : value;
  const changedTeeth = isDirty ? changedTeethCount(savedValue, value) : 0;
  const editing = !readOnly && viewingRevisionId == null;
  const activeMarks = (
    Object.entries(displayedValue.oralMarks) as Array<[OralGeneralMark, boolean]>
  )
    .filter(([, active]) => active)
    .map(([mark]) => ORAL_GENERAL_MARK_LABELS[mark]);

  /** Devuelve false si no se pudo guardar (el aviso de salida lo usa). */
  const handleSave = useCallback(async (): Promise<boolean> => {
    try {
      await save();
    } catch {
      toast.error("No se pudo guardar el odontograma.");
      return false;
    }
    toast.success("Odontograma guardado.");
    try {
      setRevisions(await listOdontogramHistory(patientId));
    } catch {
      // El guardado ya se hizo; el historial se refresca al volver.
    }
    setViewingRevisionId(null);
    return true;
  }, [patientId, save]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        if (isDirty && !isSaving && loadStatus === "ready") {
          void handleSave();
        }
        return;
      }
      // En un campo de texto, Ctrl+Z es el deshacer del propio campo.
      const target = event.target as HTMLElement | null;
      const typing =
        target?.closest("input, textarea, select, [contenteditable='true']") != null;
      if (key === "z" && !event.shiftKey && !typing && viewingRevisionId == null) {
        event.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, isDirty, isSaving, loadStatus, readOnly, undo, viewingRevisionId]);

  return (
    <section className={GLASS_PANEL}>
      <UnsavedChangesGuard
        when={isDirty && !readOnly && loadStatus === "ready"}
        subject="el odontograma"
        onSave={handleSave}
      />
      {/* Sobre el vidrio: título y herramientas; la carta va en el bloque sólido. */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-3 pt-2 pb-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink dark:text-white">
            Odontograma
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Numeración FDI · se guarda en el expediente con cada versión
          </p>
          {activeMarks.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {activeMarks.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-lime-soft px-2.5 py-0.5 text-xs font-semibold text-lime-ink"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {revisions.length > 0 ? (
            <label
              className="glass-chip flex h-9 items-center gap-2 rounded-full pr-1 pl-3 text-xs"
              title="Historial: ver cómo estaba la carta en una versión guardada antes"
            >
              <History className="size-3.5 text-slate-400" aria-hidden="true" />
              <span className="text-slate-500 dark:text-slate-400">Versión</span>
              <span className="relative flex items-center">
                <select
                  aria-label="Historial del odontograma"
                  className="max-w-60 appearance-none truncate rounded-full bg-white py-1 pr-7 pl-2.5 font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-focus dark:bg-slate-900 dark:text-slate-100"
                  value={viewingRevisionId ?? ""}
                  onChange={(event) => {
                    const next = event.target.value;
                    setViewingRevisionId(next ? Number(next) : null);
                  }}
                >
                  <option value="">Actual</option>
                  {revisions.map((revision) => (
                    <option key={revision.id} value={revision.id}>
                      {revisionLabel(revision)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 size-3.5 text-slate-400"
                  aria-hidden="true"
                />
              </span>
            </label>
          ) : null}
          {isDirty && editing ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
              {changedTeeth > 0
                ? `Cambios sin guardar en ${changedTeeth} ${changedTeeth === 1 ? "pieza" : "piezas"}`
                : "Cambios sin guardar"}
            </span>
          ) : null}
          {editing ? (
            <button
              type="button"
              aria-label="Deshacer"
              title="Deshacer el último cambio (Ctrl+Z)"
              disabled={!canUndo || isSaving || loadStatus !== "ready"}
              onClick={undo}
              className="flex size-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Undo2 className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          {loadStatus === "ready" ? <OdontogramExportButtons /> : null}
          {editing ? (
            <>
              <button
                type="button"
                title="Volver a lo último guardado"
                disabled={!isDirty || isSaving || loadStatus !== "ready"}
                onClick={() => {
                  discard();
                  toast.message("Cambios descartados.");
                }}
                className="h-9 rounded-full px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                Descartar
              </button>
              <button
                type="button"
                title="Guardar (Ctrl+S)"
                disabled={!isDirty || isSaving || loadStatus !== "ready"}
                onClick={() => {
                  void handleSave();
                }}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-action px-4 text-sm font-semibold text-on-action shadow-sm shadow-ink/20 transition hover:bg-action-hover disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              >
                <Save className="size-4" aria-hidden="true" />
                {isSaving ? "Guardando…" : "Guardar"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className={SOLID_BLOCK}>
      {viewingRevision ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sky-50 px-4 py-2.5 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          <span>Estás viendo la versión del {revisionLabel(viewingRevision)}. Es de solo lectura.</span>
          <button
            type="button"
            onClick={() => setViewingRevisionId(null)}
            className="font-semibold text-sky-800 hover:underline dark:text-sky-200"
          >
            Volver a la actual
          </button>
        </div>
      ) : null}

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
          key={`${patientId}-${editorKey}-${viewingRevisionId ?? "current"}`}
          value={displayedValue}
          onChange={onChange}
          readOnly={readOnly || viewingRevisionId != null}
          darkMode={darkMode}
          patientId={patientId}
          patientName={patientName}
        />
      ) : null}
      </div>
    </section>
  );
}
