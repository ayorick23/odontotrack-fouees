import type { ReactNode } from "react";

import { ODONTOGRAM_VIEW_LABELS, type OdontogramView } from "../../types";

const VIEWS: Array<{ id: OdontogramView; hint: string }> = [
  {
    id: "diagnostico",
    hint: "Lo que el paciente trae hoy, incluidas restauraciones previas.",
  },
  {
    id: "plan",
    hint: "Tratamientos a realizar. Los pendientes quedan disponibles en el banco de pacientes.",
  },
];

type OdontogramChartModeProps = {
  view: OdontogramView;
  onViewChange: (view: OdontogramView) => void;
  /** Tratamientos del plan pendientes y realizados, para el resumen. */
  planCounts: { pending: number; done: number };
  readOnly: boolean;
  /** Controles de la carta (dentición temporal), a la derecha. */
  children?: ReactNode;
};

function planSummary({ pending, done }: { pending: number; done: number }): string {
  if (pending + done === 0) {
    return "";
  }
  const parts = [`${pending} ${pending === 1 ? "pendiente" : "pendientes"}`];
  if (done > 0) {
    parts.push(`${done} ${done === 1 ? "realizado" : "realizados"}`);
  }
  return ` ${parts.join(" · ")}.`;
}

export function OdontogramChartMode({
  view,
  onViewChange,
  planCounts,
  readOnly,
  children,
}: OdontogramChartModeProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
          role="group"
          aria-label="Vista del odontograma"
        >
          {VIEWS.map((button, index) => {
            const active = view === button.id;
            return (
              <button
                key={button.id}
                type="button"
                title={button.hint}
                aria-pressed={active}
                onClick={() => onViewChange(button.id)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-teal-800 shadow-sm dark:bg-slate-900 dark:text-teal-200"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                }`}
              >
                <span className="mr-1.5 text-xs opacity-60" aria-hidden="true">
                  {index + 1}
                </span>
                {ODONTOGRAM_VIEW_LABELS[button.id]}
              </button>
            );
          })}
        </div>
        {children}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {readOnly
          ? `${ODONTOGRAM_VIEW_LABELS[view]}.`
          : VIEWS.find((item) => item.id === view)?.hint}
        {view === "plan" ? planSummary(planCounts) : ""}
      </p>
    </div>
  );
}
