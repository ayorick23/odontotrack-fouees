import { createContext, useMemo, useState, type ReactNode } from "react";

import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  type Theme,
} from "../theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = readStoredTheme();
    applyTheme(initial);
    return initial;
  });

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (next: Theme) => {
        persistTheme(next);
        setThemeState(next);
      },
      toggleTheme: () => {
        const next = theme === "dark" ? "light" : "dark";
        persistTheme(next);
        setThemeState(next);
      },
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
