/**
 * Clases compartidas por las tablas del rediseño (directorio, asignaciones…).
 * Las filas llevan `group` para que las celdas reaccionen al hover.
 */
export const LIST_HEADER_CELL =
  "whitespace-nowrap border-b border-slate-100 bg-white px-3 py-2.5 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400";

export const LIST_CELL =
  "border-b border-slate-100 px-3 py-2.5 align-middle transition-colors group-hover:bg-slate-50 dark:border-slate-800/70 dark:group-hover:bg-slate-800/40";

/** Primera celda de la fila: barra teal a la izquierda al pasar el mouse. */
export const LIST_FIRST_CELL =
  "pl-4 shadow-[inset_3px_0_0_transparent] group-hover:shadow-[inset_3px_0_0_#0d9488]";

/** Botón suave de acción por fila ("Ficha", "Asignar"). */
export const ROW_ACTION =
  "inline-flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-700 hover:text-white dark:bg-teal-950/60 dark:text-teal-200 dark:hover:bg-teal-500 dark:hover:text-slate-950";

/** Botón de solo ícono por fila (editar, ver ficha…). */
export const ROW_ICON_ACTION =
  "flex size-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

/** Acción principal del rediseño (teal-700: contrasta con texto blanco). */
export const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-900/20 transition hover:bg-teal-800 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

/** Valor de "sin filtro" en los selects de los listados. */
export const FILTER_ALL = "todos";
