import type { ReactNode } from "react";

import { ODONTOGRAM_VIEW_LABELS, type OdontogramView } from "../../types";

const VIEWS: Array<{ id: OdontogramView; hint: string }> = [
  {
    id: "diagnostico",
    hint: "Lo que el paciente trae hoy, incluidas restauraciones previas.",
  },
  {
    id: "plan",
    hint: "Lo que se le va a hacer al paciente. Lo pendiente queda visible en el banco de pacientes hasta marcarlo como realizado.",
  },
];

type OdontogramChartModeProps = {
  view: OdontogramView;
  onViewChange: (view: OdontogramView) => void;
  /** Registros del diagnóstico (hallazgos y marcas de higiene). */
  findingCount: number;
  /** Tratamientos del plan pendientes y realizados. */
  planCounts: { pending: number; done: number };
  readOnly: boolean;
  /** Controles de la carta (dentición temporal), a la derecha. */
  children?: ReactNode;
};

function planBadge({ pending, done }: { pending: number; done: number }): string {
  const parts = [`${pending} ${pending === 1 ? "pendiente" : "pendientes"}`];
  if (done > 0) {
    parts.push(`${done} ${done === 1 ? "realizado" : "realizados"}`);
  }
  return parts.join(" · ");
}

export function OdontogramChartMode({
  view,
  onViewChange,
  findingCount,
  planCounts,
  readOnly,
  children,
}: OdontogramChartModeProps) {
  const badges: Record<OdontogramView, string> = {
    diagnostico: String(findingCount),
    plan: planBadge(planCounts),
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
        <div className="-mb-px flex gap-1" role="group" aria-label="Vista del odontograma">
          {VIEWS.map((button, index) => {
            const active = view === button.id;
            return (
              <button
                key={button.id}
                type="button"
                title={button.hint}
                aria-pressed={active}
                onClick={() => onViewChange(button.id)}
                className={`group relative flex items-center gap-2 px-3 pt-1.5 pb-3 text-sm font-medium transition ${
                  active
                    ? "text-slate-900 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    active
                      ? "bg-action text-on-action"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {ODONTOGRAM_VIEW_LABELS[button.id]}
                <span
                  className={`rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums ${
                    active
                      ? "bg-lime-soft text-lime-ink "
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                  aria-hidden="true"
                >
                  {badges[button.id]}
                </span>
                <span
                  className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full ${
                    active ? "bg-action " : "bg-transparent"
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <div className="pb-2.5">{children}</div>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {readOnly
          ? `${ODONTOGRAM_VIEW_LABELS[view]}: ${badges[view]}.`
          : VIEWS.find((item) => item.id === view)?.hint}
      </p>
    </div>
  );
}
