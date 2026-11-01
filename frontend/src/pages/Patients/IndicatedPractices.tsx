import type { IndicatedPractice } from "../../services/patients";

const VISIBLE = 3;

/** Columna "pieza + tratamiento": hasta 3 etiquetas y "+N" con el resto. */
export function IndicatedPractices({ practices = [] }: { practices?: IndicatedPractice[] }) {
  if (practices.length === 0) {
    return <span className="text-slate-400">Sin prácticas</span>;
  }
  const hidden = practices.slice(VISIBLE);
  return (
    <ul className="flex max-w-xs flex-wrap gap-1">
      {practices.slice(0, VISIBLE).map((practice) => (
        <li
          key={practice.tooth}
          className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-950/60 dark:text-teal-200"
        >
          {practice.label}
        </li>
      ))}
      {hidden.length > 0 ? (
        <li
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          title={hidden.map((practice) => practice.label).join("\n")}
        >
          +{hidden.length}
        </li>
      ) : null}
    </ul>
  );
}
