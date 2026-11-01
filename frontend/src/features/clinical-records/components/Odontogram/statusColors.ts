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
  corona: "bg-teal-500",
  puente: "bg-cyan-600",
  implante: "bg-emerald-400",
  extraido: "bg-slate-500",
  raiz_retenida: "bg-stone-500",
  no_erupcionado: "bg-slate-400",
  ausente_congenito: "bg-slate-300",
};

/** Tratamiento planificado sin dibujo (diagnóstico, profilaxis...). */
export const NO_SYMBOL_SWATCH = "bg-sky-300";
