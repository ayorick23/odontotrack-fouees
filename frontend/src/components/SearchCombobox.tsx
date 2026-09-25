import { useEffect, useId, useState, type KeyboardEvent } from "react";

// Espera a que se deje de escribir antes de buscar en el servidor.
const SEARCH_DELAY_MS = 250;

type LoadStatus = "loading" | "ready" | "error";

type SearchComboboxProps<T extends { id: number }> = {
  label: string;
  placeholder: string;
  /** Nombre accesible de la lista de opciones. */
  listLabel: string;
  value: T | null;
  onChange: (item: T | null) => void;
  /** Debe ser estable (p. ej. una función de services/), no una flecha nueva. */
  search: (query: string) => Promise<T[]>;
  getLabel: (item: T) => string;
  getHint?: (item: T) => string;
  emptyMessage: string;
  errorMessage: string;
};

/**
 * Combobox con búsqueda en el servidor: escribe, elige con clic o teclado
 * (flechas, Enter; Esc cierra la lista sin cerrar el modal).
 */
export function SearchCombobox<T extends { id: number }>({
  label,
  placeholder,
  listLabel,
  value,
  onChange,
  search,
  getLabel,
  getHint,
  emptyMessage,
  errorMessage,
}: SearchComboboxProps<T>) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<T[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      search(query.trim())
        .then((items) => {
          if (!cancelled) {
            setOptions(items);
            setActiveIndex(0);
            setStatus("ready");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatus("error");
          }
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, search]);

  function choose(item: T) {
    onChange(item);
    setQuery(getLabel(item));
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && options[activeIndex]) {
      // Elegir la opción sin enviar el formulario del modal.
      event.preventDefault();
      choose(options[activeIndex]);
    } else if (event.key === "Escape" && open) {
      // Cierra solo la lista, no el modal.
      event.stopPropagation();
      setOpen(false);
    }
  }

  const activeOption = open ? options[activeIndex] : undefined;

  return (
    <div className="text-sm text-slate-600 dark:text-slate-300">
      <label htmlFor={inputId}>{label}</label>
      <div className="relative mt-1">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeOption ? `${listId}-${activeOption.id}` : undefined
          }
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setStatus("loading");
            setOpen(true);
            if (value !== null) {
              onChange(null);
            }
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        {open ? (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-[0_10px_30px_rgba(15,40,80,0.12)] dark:border-slate-700 dark:bg-slate-900">
            {status === "loading" ? (
              <p className="px-3 py-2 text-slate-500">Buscando…</p>
            ) : null}
            {status === "error" ? (
              <p className="px-3 py-2 text-red-600">{errorMessage}</p>
            ) : null}
            {status === "ready" && options.length === 0 ? (
              <p className="px-3 py-2 text-slate-500">{emptyMessage}</p>
            ) : null}
            {status === "ready" && options.length > 0 ? (
              <ul id={listId} role="listbox" aria-label={listLabel}>
                {options.map((item, index) => (
                  <li
                    key={item.id}
                    id={`${listId}-${item.id}`}
                    role="option"
                    aria-selected={value?.id === item.id}
                    // mousedown antes que blur: evita que la lista se cierre
                    // antes de registrar el clic.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(item)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${
                      index === activeIndex
                        ? "bg-teal-50 dark:bg-teal-950/60"
                        : ""
                    }`}
                  >
                    <span className="text-slate-800 dark:text-slate-100">
                      {getLabel(item)}
                    </span>
                    {getHint ? (
                      <span className="shrink-0 text-xs text-slate-500">
                        {getHint(item)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
