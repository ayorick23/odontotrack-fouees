import {
  TOOTH_STATUS_LABELS,
  findingStatuses,
  markedTeeth,
  type OdontogramValue,
  type ToothStatus,
} from "../../types";

const STATUS_SWATCH: Record<ToothStatus, string> = {
  sano: "bg-slate-200 dark:bg-slate-600",
  caries: "bg-amber-400",
  obturado: "bg-violet-500",
  extraido: "bg-slate-500",
  corona: "bg-teal-500",
  implante: "bg-emerald-400",
};

type OdontogramFindingsProps = {
  value: OdontogramValue;
};

export function OdontogramFindings({ value }: OdontogramFindingsProps) {
  const findings = markedTeeth(value);

  if (findings.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Sin hallazgos marcados.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Hallazgos del odontograma">
      {findings.map((tooth) => {
        const statuses = findingStatuses(tooth);
        return (
          <li
            key={tooth.fdi}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
          >
            <span className="inline-flex items-center gap-0.5" aria-hidden="true">
              {statuses.map((status) => (
                <span
                  key={status}
                  className={`size-1.5 rounded-full ${STATUS_SWATCH[status]}`}
                />
              ))}
            </span>
            {tooth.fdi}{" "}
            {statuses.map((status) => TOOTH_STATUS_LABELS[status]).join(" · ")}
          </li>
        );
      })}
    </ul>
  );
}
