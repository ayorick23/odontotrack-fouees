import type { ReactNode } from "react";

import { GLASS_PANEL, PANEL_HEADER, SOLID_BLOCK } from "./listing/styles";

/**
 * Sección con doble fondo (identidad 2026-11): marco de vidrio afuera, con
 * título y acciones encima, y el contenido sobre un bloque sólido.
 */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = SOLID_BLOCK,
  ariaLabel,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Clases del bloque sólido (por defecto con padding). */
  bodyClassName?: string;
  ariaLabel?: string;
}) {
  return (
    <section className={`${GLASS_PANEL} flex flex-col ${className}`} aria-label={ariaLabel}>
      {title || actions ? (
        <div className={PANEL_HEADER}>
          {title ? (
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink dark:text-white">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
              ) : null}
            </div>
          ) : (
            <span />
          )}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export type FolderTab<Value extends string> = {
  value: Value;
  label: ReactNode;
  /** Conteo junto al texto; null = cargando. */
  count?: number | null;
  /** Color del punto antes del texto (p. ej. estado del caso). */
  dot?: string;
};

/**
 * Pestañas tipo carpeta (fondo1): van sobre el vidrio y la activa se une
 * al bloque sólido de abajo con esquinas cóncavas (.tab-joined). El bloque
 * usa `folderBody(activa === primera)` para perder su esquina superior
 * izquierda cuando corresponde.
 */
export function FolderTabs<Value extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: FolderTab<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-end" role="group" aria-label={ariaLabel}>
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={active}
            data-active={active}
            data-first={index === 0}
            onClick={() => onChange(tab.value)}
            className={`tab-joined flex items-center gap-2 px-4 pt-2.5 pb-3 text-[13.5px] font-semibold transition-colors duration-200 ${
              active
                ? "text-ink dark:text-white"
                : "text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {tab.dot ? (
              <span className="size-2 rounded-full" style={{ background: tab.dot }} aria-hidden="true" />
            ) : null}
            {tab.label}
            {tab.count !== undefined ? (
              <span
                className={`num min-w-6 rounded-full px-1.5 py-px text-center text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-lime text-ink"
                    : "bg-ink/5 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                }`}
              >
                {tab.count === null ? "·" : tab.count.toLocaleString("es-SV")}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
