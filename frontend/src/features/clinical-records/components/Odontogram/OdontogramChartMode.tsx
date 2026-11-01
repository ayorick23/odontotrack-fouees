import { TOOTH_LAYER_LABELS, type ToothLayer } from "../../types";

const LAYERS: Array<{ id: ToothLayer; hint: string }> = [
  {
    id: "hallazgo",
    hint: "Qué hay ahora en la boca",
  },
  {
    id: "plan",
    hint: "Tratamientos por hacer: quedan disponibles en el banco de pacientes",
  },
  {
    id: "hecho",
    hint: "Trabajo ya realizado",
  },
];

type OdontogramChartModeProps = {
  layer: ToothLayer;
  onLayerChange: (layer: ToothLayer) => void;
  /** Marcas de la capa Plan, para el resumen. */
  planCount: number;
  readOnly: boolean;
};

export function OdontogramChartMode({
  layer,
  onLayerChange,
  planCount,
  readOnly,
}: OdontogramChartModeProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
        role="group"
        aria-label="Capa del odontograma"
      >
        {LAYERS.map((button) => {
          const active = layer === button.id;
          return (
            <button
              key={button.id}
              type="button"
              title={button.hint}
              aria-pressed={active}
              onClick={() => onLayerChange(button.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                active
                  ? "bg-white text-teal-800 shadow-sm dark:bg-slate-900 dark:text-teal-200"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {TOOTH_LAYER_LABELS[button.id]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {readOnly
          ? `${TOOTH_LAYER_LABELS[layer]}.`
          : LAYERS.find((item) => item.id === layer)?.hint}
        {layer === "plan" && planCount > 0
          ? ` ${planCount} ${planCount === 1 ? "tratamiento planificado" : "tratamientos planificados"}.`
          : ""}
      </p>
    </div>
  );
}
