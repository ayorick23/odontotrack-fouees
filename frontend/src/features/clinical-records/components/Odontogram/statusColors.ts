import type { ToothStatus } from "../../types";

/** Punto de color de cada estado en botones y chips. */
export const STATUS_SWATCH: Record<ToothStatus, string> = {
  sano: "bg-slate-200 dark:bg-slate-600",
  caries: "bg-amber-400",
  fractura: "bg-red-400",
  obturado: "bg-violet-500",
  sellante: "bg-sky-400",
  restauracion_temporal: "bg-orange-400",
  endodoncia: "bg-rose-500",
  pulpotomia: "bg-rose-300",
  corona: "bg-lime",
  puente: "bg-cyan-600",
  implante: "bg-emerald-400",
  extraido: "bg-slate-500",
  raiz_retenida: "bg-stone-500",
  no_erupcionado: "bg-slate-400",
  ausente_congenito: "bg-slate-300",
};

/** Tratamiento planificado sin dibujo (diagnóstico, profilaxis...). */
export const NO_SYMBOL_SWATCH = "bg-sky-300";

/** Borde izquierdo de cada botón de la paleta del diagnóstico. */
export const STATUS_BORDER: Record<ToothStatus, string> = {
  sano: "border-l-slate-300 dark:border-l-slate-500",
  caries: "border-l-amber-400",
  fractura: "border-l-red-400",
  obturado: "border-l-violet-500",
  sellante: "border-l-sky-400",
  restauracion_temporal: "border-l-orange-400",
  endodoncia: "border-l-rose-500",
  pulpotomia: "border-l-rose-300",
  corona: "border-l-lime-strong",
  puente: "border-l-cyan-600",
  implante: "border-l-emerald-400",
  extraido: "border-l-slate-500",
  raiz_retenida: "border-l-stone-500",
  no_erupcionado: "border-l-slate-400",
  ausente_congenito: "border-l-slate-300 dark:border-l-slate-500",
};
