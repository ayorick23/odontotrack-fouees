import {
  ORAL_GENERAL_MARK_LABELS,
  TOOTH_LAYER_LABELS,
  formatToothMark,
  markedTeeth,
  type FdiToothNumber,
  type OdontogramValue,
  type ToothLayer,
  type ToothStatus,
} from "../../types";

const STATUS_SWATCH: Record<ToothStatus, string> = {
  sano: "bg-slate-200 dark:bg-slate-600",
  caries: "bg-amber-400",
  fractura: "bg-red-400",
  obturado: "bg-violet-500",
  sellante: "bg-sky-400",
  restauracion_temporal: "bg-orange-400",
  endodoncia: "bg-rose-500",
  pulpotomia: "bg-rose-300",
  corona: "bg-teal-500",
  puente: "bg-cyan-600",
  implante: "bg-emerald-400",
  extraido: "bg-slate-500",
  raiz_retenida: "bg-stone-500",
  no_erupcionado: "bg-slate-400",
  ausente_congenito: "bg-slate-300",
};

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
};

type OdontogramFindingsProps = {
  value: OdontogramValue;
  focusedFdi?: number | null;
  onFocusTooth?: (fdi: FdiToothNumber) => void;
};

export function OdontogramFindings({
  value,
  focusedFdi,
  onFocusTooth,
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
    const extras = [
      ...Object.entries(tooth.oralMarks)
        .filter(([, active]) => active)
        .map(
          ([mark]) =>
            ORAL_GENERAL_MARK_LABELS[mark as keyof typeof ORAL_GENERAL_MARK_LABELS],
        ),
      tooth.practice.indicated ? "Práctica" : null,
    ].filter((item): item is string => item != null);

    if (tooth.marks.length === 0) {
      groups.hallazgo.push({
        key: `${tooth.fdi}-meta`,
        fdi: tooth.fdi,
        swatch: "bg-teal-500",
        text: extras.length > 0 ? `${tooth.fdi} ${extras.join(" · ")}` : `${tooth.fdi}`,
      });
      continue;
    }

    for (const mark of tooth.marks) {
      groups[mark.layer].push({
        key: `${tooth.fdi}-${mark.layer}-${mark.status}-${mark.surfaces.join("-")}`,
        fdi: tooth.fdi,
        swatch: STATUS_SWATCH[mark.status],
        text: `${tooth.fdi} ${formatToothMark(mark)}`,
      });
    }

    if (extras.length > 0) {
      groups.hallazgo.push({
        key: `${tooth.fdi}-extras`,
        fdi: tooth.fdi,
        swatch: "bg-teal-500",
        text: `${tooth.fdi} ${extras.join(" · ")}`,
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
                <li key={row.key}>
                  <button
                    type="button"
                    onClick={() => onFocusTooth?.(row.fdi)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition ${
                      focusedFdi === row.fdi
                        ? "bg-teal-50 text-teal-800 ring-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:ring-teal-800"
                        : LAYER_CHIP[layer]
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${row.swatch}`}
                      aria-hidden="true"
                    />
                    {row.text}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
