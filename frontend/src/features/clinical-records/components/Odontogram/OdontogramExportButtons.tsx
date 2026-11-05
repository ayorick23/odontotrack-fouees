import { ChevronDown, Download, FileText, Image } from "../../../../components/icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { exportChartPdf, exportChartPng } from "./engine";

/** Menú "Exportar" con PNG y PDF: quita dos botones de la barra. */
export function OdontogramExportButtons() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function run(action: () => Promise<void>, label: string) {
    setOpen(false);
    try {
      await action();
    } catch {
      toast.error(`No se pudo exportar el ${label}.`);
    }
  }

  return (
    <div ref={rootRef} className="relative" translate="no">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Download className="size-4" aria-hidden="true" />
        Exportar
        <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Exportar odontograma"
          className="absolute right-0 top-11 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          <ExportItem
            label="PNG"
            text="Imagen PNG"
            icon={<Image className="size-4" aria-hidden="true" />}
            onClick={() => run(exportChartPng, "PNG")}
          />
          <ExportItem
            label="PDF"
            text="Documento PDF"
            icon={<FileText className="size-4" aria-hidden="true" />}
            onClick={() => run(exportChartPdf, "PDF")}
          />
        </div>
      ) : null}
    </div>
  );
}

function ExportItem({
  label,
  text,
  icon,
  onClick,
}: {
  label: string;
  text: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={`Exportar ${label}`}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {icon}
      {text}
    </button>
  );
}
