import type { IndicatedPractice } from "../../services/patients";

/** Etiquetas visibles; el resto queda en "+N". Con más, los nombres largos
 * de tratamiento hacían filas de alturas muy distintas. */
const VISIBLE = 2;

const CHIP =
  "flex max-w-[12rem] items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium";
const MATCHED =
  "bg-action text-on-action dark:text-slate-950";
const NORMAL =
  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

/**
 * Columna "pieza + tratamiento". El backend pone primero (y marca con
 * `matched`) las que coinciden con la búsqueda o los filtros, para que lo
 * buscado no quede escondido en "+N".
 */
export function IndicatedPractices({ practices = [] }: { practices?: IndicatedPractice[] }) {
  if (practices.length === 0) {
    return <span className="text-xs text-slate-400">Sin prácticas indicadas</span>;
  }
  const hidden = practices.slice(VISIBLE);
  return (
    // Una sola línea: con nombres largos las filas tenían alturas distintas.
    <ul className="flex max-w-[26rem] items-center gap-1">
      {practices.slice(0, VISIBLE).map((practice) => (
        // Una pieza puede tener varios tratamientos: la clave es el par.
        <li key={`${practice.tooth}-${practice.treatment}`} className="min-w-0 shrink">
          <span
            className={`${CHIP} ${practice.matched ? MATCHED : NORMAL}`}
            title={practice.label}
          >
            {/* El número de pieza resalta: es lo primero que se busca. */}
            <b
              className={`tabular-nums ${practice.matched ? "" : "text-lime-ink "}`}
            >
              {practice.tooth}
            </b>
            <span className="sr-only"> · </span>
            <span className="truncate">{treatmentName(practice)}</span>
          </span>
        </li>
      ))}
      {hidden.length > 0 ? (
        <li
          className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          title={hidden.map((practice) => practice.label).join("\n")}
          aria-label={`${hidden.length} más: ${hidden.map((practice) => practice.label).join(", ")}`}
        >
          +{hidden.length}
        </li>
      ) : null}
    </ul>
  );
}

/** "18 · Endodoncia monorradicular" → "Endodoncia monorradicular". */
function treatmentName(practice: IndicatedPractice): string {
  const prefix = `${practice.tooth} · `;
  return practice.label.startsWith(prefix) ? practice.label.slice(prefix.length) : practice.label;
}
