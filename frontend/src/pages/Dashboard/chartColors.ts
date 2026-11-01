import { useTheme } from "../../hooks/useTheme";
import type { CaseStatus } from "../../services/dashboard";

/**
 * Colores de las gráficas del dashboard, validados con el script de la
 * guía de visualización (banda de luminosidad, croma, separación para
 * daltonismo y contraste contra el fondo), en claro y en oscuro.
 *
 * Estados del caso en orden fijo: pendiente → en proceso → finalizado.
 * La versión oscura tiene su propio violeta (el claro no contrasta sobre
 * slate-900); no es una inversión automática.
 */
const CASE_STATUS_COLORS: Record<"light" | "dark", Record<CaseStatus, string>> = {
  light: { pendiente: "#6250d6", en_proceso: "#0d9488", finalizado: "#d97706" },
  dark: { pendiente: "#8b7fe8", en_proceso: "#0d9488", finalizado: "#d97706" },
};

export const CASE_STATUS_ORDER: CaseStatus[] = ["pendiente", "en_proceso", "finalizado"];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  pendiente: "En el banco",
  en_proceso: "En proceso",
  finalizado: "Finalizado",
};

/** Una sola serie (asignaciones, demanda del banco): teal de la marca. */
export const SINGLE_SERIES_COLOR = "#0d9488";

export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return {
    axis: "#94a3b8",
    grid: dark ? "#1e293b" : "#eef2f7",
    /** Fondo de la tarjeta: separa segmentos apilados. */
    surface: dark ? "#0f172a" : "#ffffff",
    cursor: dark ? "#1e293b" : "#f8fafc",
    status: CASE_STATUS_COLORS[dark ? "dark" : "light"],
    tooltipStyle: {
      backgroundColor: dark ? "#0f172a" : "#ffffff",
      border: `1px solid ${dark ? "#334155" : "#e2e8f0"}`,
      borderRadius: 12,
      color: dark ? "#e2e8f0" : "#334155",
      fontSize: 12,
    },
  };
}
