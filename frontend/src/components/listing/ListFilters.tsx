import { Search, X } from "../icons";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { FILTER_ALL } from "./styles";

type Option = { value: string; label: string };

/** Select con la etiqueta encima; activo se resalta en lima y trae ✕. */
export function ListFilter({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const labelId = `${id}-label`;
  const active = value !== FILTER_ALL;

  return (
    <div className="min-w-0">
      <span id={labelId} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <div
        className={`relative flex h-10 items-center rounded-xl text-sm transition ${
          active
            ? "bg-lime-soft ring-1 ring-lime-strong "
            : "bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700/70"
        }`}
      >
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            id={id}
            aria-labelledby={labelId}
            className={`h-full w-full min-w-0 border-0 bg-transparent pl-3 font-medium shadow-none dark:bg-transparent dark:hover:bg-transparent ${
              active ? "pr-9 text-lime-ink " : "text-slate-700 dark:text-slate-200"
            }`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="start"
            className="max-h-72 rounded-xl border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="rounded-lg focus:bg-slate-100 focus:text-slate-800 dark:focus:bg-slate-700 dark:focus:text-white"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {active ? (
          <button
            type="button"
            onClick={() => onChange(FILTER_ALL)}
            aria-label={`Quitar filtro de ${label.toLowerCase()}`}
            className="absolute right-8 flex size-5 items-center justify-center rounded-full text-lime-ink transition hover:bg-lime-soft"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Buscador con la etiqueta "Buscar" encima, a juego con ListFilter. */
export function ListSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
        Buscar
      </span>
      <span className="flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm ring-lime-strong transition focus-within:bg-white focus-within:ring-2 dark:bg-slate-800 dark:focus-within:bg-slate-900">
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
        />
      </span>
    </label>
  );
}
