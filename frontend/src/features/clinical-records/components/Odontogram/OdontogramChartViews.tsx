import { useState } from "react";

import {
  applyBoneVisible,
  applyOcclusalVisible,
  applyPulpVisible,
} from "./engine";

const VIEWS = [
  {
    id: "oclusal",
    label: "Oclusal",
    hint: "Mostrar o ocultar la vista oclusal",
    apply: applyOcclusalVisible,
  },
  {
    id: "hueso",
    label: "Hueso",
    hint: "Mostrar o ocultar el hueso y la encía",
    apply: applyBoneVisible,
  },
  {
    id: "pulpa",
    label: "Pulpa",
    hint: "Mostrar o ocultar la pulpa",
    apply: applyPulpVisible,
  },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

export function OdontogramChartViews() {
  const [visible, setVisible] = useState<Record<ViewId, boolean>>({
    oclusal: true,
    hueso: true,
    pulpa: true,
  });

  return (
    <div
      className="odontogram-chart-views flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
      role="group"
      aria-label="Vistas de la carta dental"
    >
      {VIEWS.map((view) => {
        const on = visible[view.id];
        return (
          <button
            key={view.id}
            type="button"
            title={view.hint}
            aria-pressed={on}
            onClick={() => {
              const next = !on;
              setVisible((current) => ({ ...current, [view.id]: next }));
              view.apply(next);
            }}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              on
                ? "bg-white text-teal-800 shadow-sm dark:bg-slate-900 dark:text-teal-200"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
