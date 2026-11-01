import { Check, Undo2, X } from "lucide-react";

import {
  ODONTOGRAM_VIEW_LABELS,
  ORAL_GENERAL_MARK_LABELS,
  formatToothMark,
  markedTeeth,
  viewOfMark,
  type FdiToothNumber,
  type OdontogramValue,
  type OdontogramView,
} from "../../types";
import { removeMark, setDone } from "./edits";
import { NO_SYMBOL_SWATCH, STATUS_SWATCH } from "./statusColors";

const CHIP: Record<"diagnostico" | "pendiente" | "realizado", string> = {
  diagnostico:
    "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-900",
  pendiente:
    "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-100 dark:ring-sky-900",
  realizado:
    "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900",
};

const VIEWS: OdontogramView[] = ["diagnostico", "plan"];

type FindingChip = {
  key: string;
  fdi: FdiToothNumber;
  swatch: string;
  text: string;
  /** Posición de la marca en la pieza; null en placa/sangrado/sarro. */
  markIndex: number | null;
  /** Solo en el plan: si ya se realizó (capa hecho). */
  done?: boolean;
  /** Solo en el plan: tiene tratamiento, así que admite "Realizado". */
  canBeDone?: boolean;
};

type OdontogramFindingsProps = {
  value: OdontogramValue;
  /** Nombre por slug de tratamiento, para las marcas con tratamiento. */
  treatmentNames?: Record<string, string>;
  focusedFdi?: number | null;
  onFocusTooth?: (fdi: FdiToothNumber) => void;
  /** Al tocar una marca se abre la vista donde se edita. */
  onViewChange?: (view: OdontogramView) => void;
  /** Sin esto la lista es de solo lectura (sin × ni ✓). */
  onChange?: (value: OdontogramValue) => void;
};

export function OdontogramFindings({
  value,
  treatmentNames = {},
  focusedFdi,
  onFocusTooth,
  onViewChange,
  onChange,
}: OdontogramFindingsProps) {
  const findings = markedTeeth(value);

  if (findings.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Sin hallazgos marcados.
      </p>
    );
  }

  const groups: Record<OdontogramView, FindingChip[]> = {
    diagnostico: [],
    plan: [],
  };

  for (const tooth of findings) {
    tooth.marks.forEach((mark, index) => {
      const view = viewOfMark(mark);
      groups[view].push({
        key: `${tooth.fdi}-${index}-${mark.layer}-${mark.status}-${mark.treatment ?? ""}`,
        fdi: tooth.fdi,
        swatch: mark.status ? STATUS_SWATCH[mark.status] : NO_SYMBOL_SWATCH,
        text: `${tooth.fdi} ${formatToothMark(mark, treatmentNames)}`,
        markIndex: index,
        done: view === "plan" ? mark.layer === "hecho" : undefined,
        canBeDone: view === "plan" && Boolean(mark.treatment),
      });
    });

    const oral = Object.entries(tooth.oralMarks)
      .filter(([, active]) => active)
      .map(
        ([mark]) =>
          ORAL_GENERAL_MARK_LABELS[mark as keyof typeof ORAL_GENERAL_MARK_LABELS],
      );
    if (oral.length > 0) {
      groups.diagnostico.push({
        key: `${tooth.fdi}-oral`,
        fdi: tooth.fdi,
        swatch: "bg-teal-500",
        text: `${tooth.fdi} ${oral.join(" · ")}`,
        markIndex: null,
      });
    }
  }
  // Primero lo pendiente: es lo que queda por hacer.
  groups.plan.sort((a, b) => Number(a.done) - Number(b.done));

  return (
    <div className="space-y-3" aria-label="Hallazgos del odontograma">
      {VIEWS.map((view) => {
        const chips = groups[view];
        if (chips.length === 0) {
          return null;
        }
        return (
          <section key={view} aria-label={ODONTOGRAM_VIEW_LABELS[view]}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {ODONTOGRAM_VIEW_LABELS[view]}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {chips.map((row) => {
                const style =
                  view === "diagnostico"
                    ? CHIP.diagnostico
                    : row.done
                      ? CHIP.realizado
                      : CHIP.pendiente;
                return (
                  <li
                    key={row.key}
                    className={`inline-flex items-center rounded-full text-xs font-medium ring-1 transition ${
                      focusedFdi === row.fdi
                        ? "bg-teal-50 text-teal-800 ring-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:ring-teal-800"
                        : style
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onViewChange?.(view);
                        onFocusTooth?.(row.fdi);
                      }}
                      className="inline-flex items-center gap-1.5 py-1 pl-2.5 pr-2"
                    >
                      {row.done ? (
                        <Check className="size-3" aria-label="Realizado" />
                      ) : (
                        <span
                          className={`size-1.5 rounded-full ${row.swatch}`}
                          aria-hidden="true"
                        />
                      )}
                      <span className={row.done ? "line-through decoration-1" : undefined}>
                        {row.text}
                      </span>
                    </button>
                    {onChange && row.markIndex != null && row.canBeDone ? (
                      <button
                        type="button"
                        title={row.done ? "Volver a pendiente" : "Marcar como realizado"}
                        aria-label={`${row.done ? "Volver a pendiente" : "Marcar como realizado"}: ${row.text}`}
                        onClick={() =>
                          onChange(setDone(value, row.fdi, row.markIndex!, !row.done))
                        }
                        className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {row.done ? (
                          <Undo2 className="size-3" aria-hidden="true" />
                        ) : (
                          <Check className="size-3" aria-hidden="true" />
                        )}
                      </button>
                    ) : null}
                    {onChange && row.markIndex != null ? (
                      <button
                        type="button"
                        title="Quitar"
                        aria-label={`Quitar ${row.text}`}
                        onClick={() => onChange(removeMark(value, row.fdi, row.markIndex!))}
                        className="mr-1 rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
