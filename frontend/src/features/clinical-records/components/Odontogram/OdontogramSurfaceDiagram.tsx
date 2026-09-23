import {
  TOOTH_SURFACE_CODES,
  TOOTH_SURFACE_LABELS,
  type ToothSurface,
} from "../../types";

const ZONES: Array<{
  surface: ToothSurface;
  className: string;
}> = [
  { surface: "vestibular", className: "left-1/2 top-0 -translate-x-1/2" },
  { surface: "mesial", className: "left-0 top-1/2 -translate-y-1/2" },
  { surface: "oclusal", className: "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" },
  { surface: "distal", className: "right-0 top-1/2 -translate-y-1/2" },
  { surface: "lingual", className: "bottom-0 left-1/2 -translate-x-1/2" },
];

type OdontogramSurfaceDiagramProps = {
  activeSurfaces: ToothSurface[];
  disabled: boolean;
  mode: "caries" | "obturado";
  onToggle: (surface: ToothSurface, nextActive: boolean) => void;
};

export function OdontogramSurfaceDiagram({
  activeSurfaces,
  disabled,
  mode,
  onToggle,
}: OdontogramSurfaceDiagramProps) {
  const active = new Set(activeSurfaces);

  return (
    <div
      className="relative mx-auto size-36"
      role="group"
      aria-label="Superficies del diente"
    >
      <div
        className="absolute inset-6 rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
        aria-hidden="true"
      />
      {ZONES.map((zone) => {
        const pressed = active.has(zone.surface);
        return (
          <button
            key={zone.surface}
            type="button"
            disabled={disabled}
            title={TOOTH_SURFACE_LABELS[zone.surface]}
            aria-label={TOOTH_SURFACE_LABELS[zone.surface]}
            aria-pressed={pressed}
            onClick={() => onToggle(zone.surface, !pressed)}
            className={`absolute flex size-10 items-center justify-center rounded-full border text-sm font-semibold transition disabled:opacity-50 ${
              zone.className
            } ${
              pressed
                ? mode === "caries"
                  ? "border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                  : "border-violet-400 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200"
                : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {TOOTH_SURFACE_CODES[zone.surface]}
          </button>
        );
      })}
    </div>
  );
}
