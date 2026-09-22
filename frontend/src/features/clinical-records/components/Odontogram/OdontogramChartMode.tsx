import { useEffect, useState } from "react";

import {
  applyChartMode,
  readChartMode,
  readPlanChanges,
  subscribeEngine,
  type EngineChartMode,
} from "./engine";

const MODE_BUTTONS: Array<{ id: EngineChartMode; label: string; hint: string }> =
  [
    {
      id: "status",
      label: "Estado",
      hint: "Hallazgos actuales del paciente",
    },
    {
      id: "plan",
      label: "Plan",
      hint: "Tratamiento propuesto, sin cambiar el estado",
    },
  ];

type OdontogramChartModeProps = {
  readOnly: boolean;
};

export function OdontogramChartMode({ readOnly }: OdontogramChartModeProps) {
  const [mode, setMode] = useState<EngineChartMode>("status");
  const [changeCount, setChangeCount] = useState(0);

  useEffect(() => {
    const sync = () => {
      setMode(readChartMode());
      setChangeCount(readPlanChanges().length);
    };
    sync();
    return subscribeEngine(sync);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
        role="group"
        aria-label="Modo del odontograma"
      >
        {MODE_BUTTONS.map((button) => {
          const active = mode === button.id;
          return (
            <button
              key={button.id}
              type="button"
              title={button.hint}
              aria-pressed={active}
              onClick={() => applyChartMode(button.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                active
                  ? "bg-white text-teal-800 shadow-sm dark:bg-slate-900 dark:text-teal-200"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {button.label}
            </button>
          );
        })}
      </div>
      {mode === "plan" ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {readOnly
            ? "Viendo el plan de tratamiento."
            : "Los cambios de este modo son propuestos."}
          {changeCount > 0
            ? ` ${changeCount} ${changeCount === 1 ? "diferencia" : "diferencias"} respecto al estado.`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
