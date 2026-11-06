/**
 * Clases compartidas de la identidad visual (2026-11): tablas, botones e
 * íconos. Usar estas en vez de repetir clases en cada pantalla.
 * Las filas llevan `group` para que las celdas reaccionen al hover.
 */
/** Encabezado: píldora arena (fondo2). Opaco porque queda fijo al hacer scroll. */
export const LIST_HEADER_CELL =
  "whitespace-nowrap bg-slate-100 px-3 py-2.5 text-[11.5px] font-semibold text-slate-500 first:rounded-l-full last:rounded-r-full dark:bg-slate-800 dark:text-slate-400";

export const LIST_CELL =
  "border-b border-slate-100 px-3 py-2.5 align-middle transition-colors group-hover:bg-slate-50 dark:border-slate-800/70 dark:group-hover:bg-slate-800/40";

/** Primera celda de la fila: barra de acento a la izquierda al pasar el mouse. */
export const LIST_FIRST_CELL =
  "pl-4 shadow-[inset_3px_0_0_transparent] group-hover:shadow-[inset_3px_0_0_var(--action)]";

/** Botón suave de acción por fila ("Ficha", "Asignar"). */
export const ROW_ACTION =
  "press inline-flex items-center gap-1.5 rounded-full bg-lime-soft px-3 py-1.5 text-xs font-semibold text-lime-ink transition hover:bg-action hover:text-on-action";

/** Botón de solo ícono por fila (editar, ver ficha…). */
export const ROW_ICON_ACTION =
  "press flex size-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

/** Acción principal: tinta con texto blanco (en oscuro, lima con texto tinta). */
export const PRIMARY_BUTTON =
  "press inline-flex items-center justify-center gap-2 rounded-full bg-action px-4 py-2 text-sm font-semibold text-on-action shadow-lg shadow-ink/15 transition hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none";

/** Secundario: chip arena sin borde (se ve bien sobre blanco y sobre vidrio). */
export const SECONDARY_BUTTON =
  "press inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/[.06] dark:text-slate-200 dark:hover:bg-white/10";

/** Peligro (borrar, rechazar): rojo sólido. */
export const DANGER_BUTTON =
  "press inline-flex items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60";

/** Ícono de la acción principal dentro de un círculo lima (p. ej. "+" de
 * Registrar paciente). Combinar con PRIMARY_BUTTON y `pl-1.5`. */
export const PRIMARY_ICON_DOT =
  "grid size-7 place-items-center rounded-full bg-lime text-ink dark:bg-ink dark:text-lime";

/** Botón circular de solo ícono (barra superior, tarjetas). Va solo o dentro
 * de una cápsula `glass rounded-full p-1`. */
export const ICON_BUTTON =
  "press relative grid size-9 shrink-0 place-items-center rounded-full text-slate-600 transition hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white";

/* ---------- Doble fondo: vidrio afuera, bloque sólido adentro ---------- */

/** Marco de vidrio de una sección (tarjeta, listado, ficha). */
export const GLASS_PANEL = "glass rounded-[24px] p-2";

/** Título y acciones de la sección, sobre el vidrio (encima del bloque). */
export const PANEL_HEADER = "flex flex-wrap items-center justify-between gap-3 px-3 pt-2 pb-3";

/** Bloque sólido con el contenido denso (texto, tablas, formularios). */
export const SOLID_BLOCK = "rounded-[18px] bg-surface p-4 sm:p-5";

/** Bloque sólido bajo pestañas tipo carpeta: sin esquina superior izquierda
 * cuando la pestaña activa es la primera (así la unión queda continua). */
export function folderBody(firstActive: boolean): string {
  return `rounded-[18px] bg-surface ${firstActive ? "rounded-tl-none" : ""}`;
}

/** Buscador o select compacto sobre el vidrio (encabezado de un panel). */
export const GLASS_CONTROL =
  "glass-chip rounded-full px-3 py-2 text-sm text-slate-600 outline-none transition hover:bg-white focus-within:ring-2 focus-within:ring-focus dark:text-slate-300 dark:hover:bg-white/10";

/** Valor de "sin filtro" en los selects de los listados. */
export const FILTER_ALL = "todos";
