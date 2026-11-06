import { CASE_STATUS_LABELS, type CaseStatus } from "../../services/patients";
import { useChartTheme } from "../Dashboard/chartColors";

/**
 * Estado del caso con los colores de la identidad (los mismos de las
 * gráficas): pendiente lima, asignado tinta/hueso, finalizado violeta.
 * Se usa en el directorio, la ficha y el formulario de paciente.
 */
export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const { status: colors } = useChartTheme();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-slate-700 dark:border-slate-700 dark:text-slate-200">
      <span className="size-1.5 rounded-full" style={{ background: colors[status] }} aria-hidden="true" />
      {CASE_STATUS_LABELS[status]}
    </span>
  );
}
