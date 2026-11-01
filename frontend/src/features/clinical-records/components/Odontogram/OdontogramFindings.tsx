import { Check, X } from "lucide-react";

import {
  ORAL_GENERAL_MARK_LABELS,
  TOOTH_LAYER_LABELS,
  formatToothMark,
  markedTeeth,
  type FdiToothNumber,
  type OdontogramValue,
  type ToothLayer,
} from "../../types";
import { markDone, removeMark } from "./edits";
import { NO_SYMBOL_SWATCH, STATUS_SWATCH } from "./statusColors";

const LAYER_CHIP: Record<ToothLayer, string> = {
  hallazgo:
    "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-900",
  plan: "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-100 dark:ring-sky-900",
  hecho: "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
};

const LAYERS: ToothLayer[] = ["hallazgo", "plan", "hecho"];

type FindingChip = {
  key: string;
  fdi: FdiToothNumber;
  swatch: string;
  text: string;
  /** Posición de la marca en la pieza; null en placa/sangrado/sarro. */
  markIndex: number | null;
};

type OdontogramFindingsProps = {
  value: OdontogramValue;
  /** Nombre por slug de tratamiento, para las marcas con tratamiento. */
  treatmentNames?: Record<string, string>;
  focusedFdi?: number | null;
  onFocusTooth?: (fdi: FdiToothNumber) => void;
  /** Sin esto la lista es de solo lectura (sin ×). */
  onChange?: (value: OdontogramValue) => void;
};

export function OdontogramFindings({
  value,
  treatmentNames = {},
  focusedFdi,
  onFocusTooth,
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

  const groups: Record<ToothLayer, FindingChip[]> = {
    hallazgo: [],
    plan: [],
    hecho: [],
  };

  for (const tooth of findings) {
    tooth.marks.forEach((mark, index) => {
      groups[mark.layer].push({
        key: `${tooth.fdi}-${index}-${mark.layer}-${mark.status}-${mark.treatment ?? ""}`,
        fdi: tooth.fdi,
        swatch: mark.status ? STATUS_SWATCH[mark.status] : NO_SYMBOL_SWATCH,
        text: `${tooth.fdi} ${formatToothMark(mark, treatmentNames)}`,
        markIndex: index,
      });
    });

    const oral = Object.entries(tooth.oralMarks)
      .filter(([, active]) => active)
      .map(
        ([mark]) =>
          ORAL_GENERAL_MARK_LABELS[mark as keyof typeof ORAL_GENERAL_MARK_LABELS],
      );
    if (oral.length > 0) {
      groups.hallazgo.push({
        key: `${tooth.fdi}-oral`,
        fdi: tooth.fdi,
        swatch: "bg-teal-500",
        text: `${tooth.fdi} ${oral.join(" · ")}`,
        markIndex: null,
      });
    }
  }

  return (
    <div className="space-y-3" aria-label="Hallazgos del odontograma">
      {LAYERS.map((layer) => {
        const chips = groups[layer];
        if (chips.length === 0) {
          return null;
        }
        return (
          <section key={layer} aria-label={TOOTH_LAYER_LABELS[layer]}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {TOOTH_LAYER_LABELS[layer]}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {chips.map((row) => (
                <li
                  key={row.key}
                  className={`inline-flex items-center rounded-full text-xs font-medium ring-1 transition ${
                    focusedFdi === row.fdi
                      ? "bg-teal-50 text-teal-800 ring-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:ring-teal-800"
                      : LAYER_CHIP[layer]
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onFocusTooth?.(row.fdi)}
                    className="inline-flex items-center gap-1.5 py-1 pl-2.5 pr-2"
                  >
                    <span
                      className={`size-1.5 rounded-full ${row.swatch}`}
                      aria-hidden="true"
                    />
                    {row.text}
                  </button>
                  {onChange && row.markIndex != null && layer === "plan" ? (
                    <button
                      type="button"
                      title="Marcar como hecho"
                      aria-label={`Marcar como hecho: ${row.text}`}
                      onClick={() => onChange(markDone(value, row.fdi, row.markIndex!))}
                      className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <Check className="size-3" aria-hidden="true" />
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
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
