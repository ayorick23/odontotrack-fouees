import { useEffect, useState } from "react";

import { TOOTH_LAYER_LABELS, isFdiToothNumber, type FdiToothNumber } from "../../types";
import { readPlanChanges, subscribeEngine, type EnginePlanChange } from "./engine";

const VALUE_ALIASES: Array<[RegExp, string]> = [
  [/p[oó]ntic|bridge|puente/i, "Puente"],
  [/crown|corona/i, "Corona"],
  [/implant/i, "Implante"],
  [/extract|missing|ausente|absent|extra[ií]do/i, "Extraído"],
  [/caries/i, "Caries"],
  [/filling|obturad/i, "Obturado"],
  [/sealant|sellante/i, "Sellante"],
  [/permanent|tooth-base|sano/i, "Sano"],
];

export function formatPlanValue(value: string): string {
  const cleaned = value
    .replace(/restoration\.material\.\w+/gi, "")
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned === "" || cleaned === "none" || cleaned === "—") {
    return "Sin marca";
  }
  for (const [pattern, label] of VALUE_ALIASES) {
    if (pattern.test(cleaned)) {
      return label;
    }
  }
  return cleaned;
}

export function formatPlanChange(change: EnginePlanChange): string {
  const from = formatPlanValue(change.from);
  const to = formatPlanValue(change.to);
  if (from === "Sin marca") {
    return `${change.toothNo} ${to}`;
  }
  return `${change.toothNo} ${from} → ${to}`;
}

type OdontogramPlanDiffProps = {
  focusedFdi?: number | null;
  onFocusTooth?: (fdi: FdiToothNumber) => void;
};

export function OdontogramPlanDiff({
  focusedFdi,
  onFocusTooth,
}: OdontogramPlanDiffProps) {
  const [changes, setChanges] = useState<EnginePlanChange[]>([]);

  useEffect(() => {
    const sync = () => setChanges(readPlanChanges());
    sync();
    return subscribeEngine(sync);
  }, []);

  if (changes.length === 0) {
    return null;
  }

  return (
    <section aria-label={TOOTH_LAYER_LABELS.plan} translate="no">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {TOOTH_LAYER_LABELS.plan}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {changes.map((change) => {
          const fdi = isFdiToothNumber(change.toothNo) ? change.toothNo : null;
          const selected = focusedFdi === change.toothNo;
          return (
            <li key={`${change.toothNo}-${change.axis}-${change.from}-${change.to}`}>
              <button
                type="button"
                onClick={() => {
                  if (fdi) {
                    onFocusTooth?.(fdi);
                  }
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
                  selected
                    ? "bg-teal-50 text-teal-800 ring-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:ring-teal-800"
                    : "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-100 dark:ring-sky-900"
                }`}
              >
                <span className="size-1.5 rounded-full bg-sky-400" aria-hidden="true" />
                {formatPlanChange(change)}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
