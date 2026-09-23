import { FileDown, Image } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { exportChartPdf, exportChartPng } from "./engine";

export function OdontogramExportButtons() {
  return (
    <>
      <ExportButton
        label="PNG"
        icon={<Image className="size-4" aria-hidden="true" />}
        onClick={async () => {
          try {
            await exportChartPng();
          } catch {
            toast.error("No se pudo exportar el PNG.");
          }
        }}
      />
      <ExportButton
        label="PDF"
        icon={<FileDown className="size-4" aria-hidden="true" />}
        onClick={async () => {
          try {
            await exportChartPdf();
          } catch {
            toast.error("No se pudo exportar el PDF.");
          }
        }}
      />
    </>
  );
}

function ExportButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      translate="no"
      aria-label={`Exportar ${label}`}
      onClick={() => {
        void onClick();
      }}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
