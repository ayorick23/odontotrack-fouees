import type { IndicatedPractice } from "../../services/patients";

/** Etiquetas visibles; el resto queda en "+N". Con más, los nombres largos
 * de tratamiento hacían filas de alturas muy distintas. */
const VISIBLE = 2;

const CHIP =
  "block max-w-[11rem] truncate rounded-full px-2 py-0.5 text-xs font-medium";
const MATCHED =
  "bg-teal-600 text-white dark:bg-teal-500 dark:text-slate-950";
const NORMAL =
  "bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200";

/**
 * Columna "pieza + tratamiento". El backend pone primero (y marca con
 * `matched`) las que coinciden con la búsqueda o los filtros, para que lo
 * buscado no quede escondido en "+N".
 */
export function IndicatedPractices({ practices = [] }: { practices?: IndicatedPractice[] }) {
  if (practices.length === 0) {
    return <span className="text-slate-400">Sin prácticas</span>;
  }
  const hidden = practices.slice(VISIBLE);
  return (
    <ul className="flex max-w-xs flex-wrap gap-1">
      {practices.slice(0, VISIBLE).map((practice) => (
        // Una pieza puede tener varios tratamientos: la clave es el par.
        <li key={`${practice.tooth}-${practice.treatment}`} className="min-w-0">
          <span
            className={`${CHIP} ${practice.matched ? MATCHED : NORMAL}`}
            title={practice.label}
          >
            {practice.label}
          </span>
        </li>
      ))}
      {hidden.length > 0 ? (
        <li
          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          title={hidden.map((practice) => practice.label).join("\n")}
          aria-label={`${hidden.length} más: ${hidden.map((practice) => practice.label).join(", ")}`}
        >
          +{hidden.length}
        </li>
      ) : null}
    </ul>
  );
}
