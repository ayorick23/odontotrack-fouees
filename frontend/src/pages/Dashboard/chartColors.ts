import { useTheme } from "../../hooks/useTheme";
import type { CaseStatus } from "../../services/dashboard";
import { CASE_STATUS_LABELS } from "../../services/patients";

/**
 * Colores de las gráficas del dashboard, validados con el script de la
 * guía de visualización (banda de luminosidad, croma, separación para
 * daltonismo y contraste contra el fondo), en claro y en oscuro.
 *
 * Estados del caso en orden fijo: pendiente → asignado → finalizado.
 * Identidad 2026-11: pendiente lima, asignado tinta (hueso en oscuro),
 * finalizado violeta. En claro el lima es el fuerte (el claro no se ve
 * en puntos chicos sobre blanco).
 */
const CASE_STATUS_COLORS: Record<"light" | "dark", Record<CaseStatus, string>> = {
  light: { pendiente: "#c8e43c", en_proceso: "#16181c", finalizado: "#8b7fe8" },
  dark: { pendiente: "#dcf26a", en_proceso: "#eceef1", finalizado: "#8b7fe8" },
};

export const CASE_STATUS_ORDER: CaseStatus[] = ["pendiente", "en_proceso", "finalizado"];

// Mismos nombres de estado en toda la app (directorio, ficha y dashboard).
export { CASE_STATUS_LABELS };

/** Una sola serie (asignaciones, demanda del banco): la acción (tinta / lima en oscuro).
 * Es una variable CSS: usarla en `style`, no en atributos SVG. */
export const SINGLE_SERIES_COLOR = "var(--action)";

export function useChartTheme() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return {
    dark,
    axis: "#9c9b95",
    grid: dark ? "#26282d" : "#eeede8",
    /** Fondo de la tarjeta: separa segmentos apilados. */
    surface: dark ? "#181b20" : "#ffffff",
    cursor: dark ? "#26282d" : "#f7f7f4",
    status: CASE_STATUS_COLORS[dark ? "dark" : "light"],
    tooltipStyle: {
      backgroundColor: dark ? "#181b20" : "#ffffff",
      border: `1px solid ${dark ? "#26282d" : "#e1e0da"}`,
      borderRadius: 12,
      color: dark ? "#eceef1" : "#3c3d41",
      fontSize: 12,
    },
  };
}
