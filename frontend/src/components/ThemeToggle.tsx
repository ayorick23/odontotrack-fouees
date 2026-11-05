import { Moon, Sun } from "./icons";

import { useTheme } from "../hooks/useTheme";
import { ICON_BUTTON } from "./listing/styles";

/** Sol y luna están siempre montados: al cambiar, uno gira y se encoge
 * mientras el otro entra girando (respeta "reducir movimiento"). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const icon =
    "absolute size-[17px] transition-[transform,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={isDark}
      className={`${ICON_BUTTON} ${className}`}
    >
      <Moon
        aria-hidden="true"
        className={`${icon} ${isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
      />
      <Sun
        aria-hidden="true"
        className={`${icon} ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"}`}
      />
    </button>
  );
}
