import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { LIST_HEADER_CELL } from "./styles";

export function HeaderCell({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={`${LIST_HEADER_CELL} ${className}`}>
      {children}
    </th>
  );
}

/** Encabezado ordenable. `ordering` es "campo" o "-campo" (descendente). */
export function SortableHeader<Field extends string>({
  label,
  field,
  ordering,
  onSort,
  className = "",
}: {
  label: string;
  field: Field;
  ordering: string;
  onSort: (field: Field) => void;
  className?: string;
}) {
  const active = ordering.replace(/^-/, "") === field;
  const descending = ordering.startsWith("-");
  const Icon = !active ? ChevronsUpDown : descending ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
      className={`${LIST_HEADER_CELL} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 rounded-md transition hover:text-slate-800 dark:hover:text-slate-200 ${
          active ? "text-slate-800 dark:text-slate-100" : ""
        }`}
      >
        {label}
        <Icon
          className={`size-3.5 ${active ? "text-teal-700 dark:text-teal-300" : "opacity-50"}`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

/** "Mostrando 1–20 de N <noun>" + números de página con saltos (…). */
export function ListPagination({
  page,
  pageCount,
  count,
  pageSize,
  noun,
  label,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  count: number;
  pageSize: number;
  /** Plural de lo que se lista: "pacientes". */
  noun: string;
  /** aria-label de la navegación. */
  label: string;
  onPageChange: (page: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  const pages: Array<number | "gap"> = [];
  for (let current = 1; current <= pageCount; current += 1) {
    if (current === 1 || current === pageCount || Math.abs(current - page) <= 1) {
      pages.push(current);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }
  const base =
    "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-30";
  const idle = "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

  return (
    <nav
      aria-label={label}
      className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
    >
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Mostrando{" "}
        <b className="font-semibold text-slate-700 dark:text-slate-200">
          {from}–{to}
        </b>{" "}
        de <b className="font-semibold text-slate-700 dark:text-slate-200">{count}</b> {noun}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
          className={`${base} ${idle}`}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        {pages.map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              aria-label={`Página ${item}`}
              className={`${base} ${item === page ? "bg-teal-700 text-white" : idle}`}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
          className={`${base} ${idle}`}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-2 px-2 pt-2" aria-hidden="true">
      {["a", "b", "c", "d", "e", "f"].map((row) => (
        <div key={row} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

/** Estado vacío con ícono. `tone="teal"` para un vacío "bueno" (nada pendiente). */
export function ListEmpty({
  title,
  description,
  icon: Icon = SearchX,
  tone = "slate",
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: "slate" | "teal";
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <span
        className={`flex size-14 items-center justify-center rounded-2xl ${
          tone === "teal"
            ? "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-300"
            : "bg-slate-100 text-slate-400 dark:bg-slate-800"
        }`}
      >
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="px-2 py-12 text-center">
      <p className="text-sm text-red-700 dark:text-red-400" role="alert">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
      >
        Reintentar
      </button>
    </div>
  );
}
