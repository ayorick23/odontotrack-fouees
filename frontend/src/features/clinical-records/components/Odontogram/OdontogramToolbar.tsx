import { Check, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  ORAL_GENERAL_MARK_LABELS,
  SURFACE_STATUSES,
  TOOTH_STATUS_GROUPS,
  TOOTH_STATUS_LABELS,
  emptyOralMarks,
  formatToothMark,
  isFdiToothNumber,
  updateTooth,
  type FdiToothNumber,
  type OralGeneralMark,
  type OdontogramValue,
  type OdontogramView,
  type PracticeArea,
} from "../../types";
import { clearChartSelection } from "./engine";
import {
  addPlannedTreatment,
  layerStatuses,
  removeMark,
  setDone,
  setMarkSurface,
  toggleStatus,
  toggleSurface,
} from "./edits";
import { formatDoneAt } from "./formatDoneAt";
import { OdontogramSurfaceDiagram } from "./OdontogramSurfaceDiagram";
import { STATUS_BORDER, STATUS_SWATCH } from "./statusColors";
import { neighborTooth, toothName } from "./toothNames";

/** El diagnóstico se guarda en la capa hallazgo. */
const DIAGNOSIS_LAYER = "hallazgo";

const MARKS = Object.keys(ORAL_GENERAL_MARK_LABELS) as OralGeneralMark[];

const SECTION_TITLE =
  "mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";

/** Sin acentos ni mayúsculas: "monorra" encuentra "Monorradicular". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type OdontogramToolbarProps = {
  value: OdontogramValue;
  onChange: (value: OdontogramValue) => void;
  readOnly: boolean;
  view: OdontogramView;
  focusedFdi?: number | null;
  clinicalAreas?: PracticeArea[];
  treatmentNames?: Record<string, string>;
  onClearFocus?: () => void;
  /** Pasar a otra pieza (flechas ‹ ›). */
  onFocusTooth?: (fdi: FdiToothNumber) => void;
};

export function OdontogramToolbar({
  value,
  onChange,
  readOnly,
  view,
  focusedFdi,
  clinicalAreas = [],
  treatmentNames = {},
  onClearFocus,
  onFocusTooth,
}: OdontogramToolbarProps) {
  const focused =
    focusedFdi != null && isFdiToothNumber(focusedFdi)
      ? value.teeth.find((tooth) => tooth.fdi === focusedFdi)
      : undefined;
  const focusedOral = focused?.oralMarks ?? emptyOralMarks();
  const extrasOpen = focusedOral.placa || focusedOral.sangrado || focusedOral.sarro;
  const [moreOpen, setMoreOpen] = useState(extrasOpen);

  useEffect(() => {
    setMoreOpen(extrasOpen);
  }, [focusedFdi, extrasOpen]);

  if (!focused) {
    return null;
  }
  const fdi = focused.fdi;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 border-b border-slate-100 pb-3 dark:border-slate-800">
        {onFocusTooth ? (
          <NavButton label="Pieza anterior" onClick={() => onFocusTooth(neighborTooth(fdi, -1))}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </NavButton>
        ) : null}
        <div className="min-w-0 flex-1 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-white">Pieza {fdi}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{toothName(fdi)}</p>
        </div>
        {onFocusTooth ? (
          <NavButton label="Pieza siguiente" onClick={() => onFocusTooth(neighborTooth(fdi, 1))}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </NavButton>
        ) : null}
        {readOnly ? null : (
          <NavButton
            label="Quitar selección"
            onClick={() => {
              clearChartSelection();
              onClearFocus?.();
            }}
          >
            <X className="size-4" aria-hidden="true" />
          </NavButton>
        )}
      </div>

      <div className="flex flex-col gap-4 pt-4">
        {view === "plan" ? (
          <PlanSection
            value={value}
            fdi={fdi}
            onChange={onChange}
            readOnly={readOnly}
            clinicalAreas={clinicalAreas}
            treatmentNames={treatmentNames}
          />
        ) : (
          <>
            <StatusSection value={value} fdi={fdi} onChange={onChange} readOnly={readOnly} />
            <HygieneSection
              value={value}
              fdi={fdi}
              onChange={onChange}
              readOnly={readOnly}
              open={moreOpen}
              onToggle={() => setMoreOpen((open) => !open)}
            />
          </>
        )}
      </div>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      {children}
    </button>
  );
}

type SectionProps = {
  value: OdontogramValue;
  fdi: FdiToothNumber;
  onChange: (value: OdontogramValue) => void;
  readOnly: boolean;
};

/** Placa, sangrado y sarro de la pieza: son parte del diagnóstico. */
function HygieneSection({
  value,
  fdi,
  onChange,
  readOnly,
  open,
  onToggle,
}: SectionProps & { open: boolean; onToggle: () => void }) {
  const focusedOral =
    value.teeth.find((tooth) => tooth.fdi === fdi)?.oralMarks ?? emptyOralMarks();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
      >
        {open ? "Ocultar higiene" : "Higiene: placa, sangrado, sarro"}
      </button>
      {open ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {MARKS.map((mark) => {
            const active = focusedOral[mark];
            return (
              <button
                key={mark}
                type="button"
                disabled={readOnly}
                aria-pressed={active}
                onClick={() =>
                  onChange(
                    updateTooth(value, fdi, {
                      oralMarks: { ...focusedOral, [mark]: !active },
                    }),
                  )
                }
                className={`rounded-lg px-2.5 py-2 text-xs font-medium transition disabled:opacity-50 ${
                  active
                    ? "bg-teal-700 text-white"
                    : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {ORAL_GENERAL_MARK_LABELS[mark]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function StatusSection({ value, fdi, onChange, readOnly }: SectionProps) {
  const layer = DIAGNOSIS_LAYER;
  const [surfaceMode, setSurfaceMode] = useState<"caries" | "obturado">("caries");
  const active = layerStatuses(value, fdi, layer);
  const tooth = value.teeth.find((item) => item.fdi === fdi);
  const activeSurfaces =
    tooth?.marks.find(
      (mark) => mark.layer === layer && mark.status === surfaceMode && !mark.treatment,
    )?.surfaces ?? [];

  return (
    <>
      {TOOTH_STATUS_GROUPS.map((group) => (
        <div key={group.id}>
          <p className={SECTION_TITLE}>
            {group.id === "tratamiento" ? "Tratamiento previo" : group.label}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {group.statuses.map((status) => {
              const pressed = status !== "sano" && active.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={status === "sano" ? undefined : pressed}
                  title={status === "sano" ? "Marca la pieza como sana: limpia el diagnóstico" : undefined}
                  onClick={() => onChange(toggleStatus(value, fdi, layer, status))}
                  className={`flex items-center gap-2 rounded-lg border-l-[3px] px-2.5 py-2 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${STATUS_BORDER[status]} ${
                    pressed
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{TOOTH_STATUS_LABELS[status]}</span>
                  {pressed ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className={SECTION_TITLE.replace("mb-1.5 ", "")}>Superficies</p>
          <div className="flex gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800">
            {(["caries", "obturado"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={readOnly}
                aria-pressed={surfaceMode === mode}
                aria-label={`Modo superficie ${mode}`}
                onClick={() => setSurfaceMode(mode)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${
                  surfaceMode === mode
                    ? "bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <span className={`size-1.5 rounded-full ${STATUS_SWATCH[mode]}`} aria-hidden="true" />
                {TOOTH_STATUS_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 py-3 dark:bg-slate-800/40">
          <OdontogramSurfaceDiagram
            activeSurfaces={activeSurfaces}
            disabled={readOnly}
            mode={surfaceMode}
            onToggle={(surface, on) =>
              onChange(toggleSurface(value, fdi, layer, surfaceMode, surface, on))
            }
          />
        </div>
        <p className="mt-1.5 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Clic en una superficie para marcar o quitar {TOOTH_STATUS_LABELS[surfaceMode].toLowerCase()}
        </p>
      </div>
    </>
  );
}

function PlanSection({
  value,
  fdi,
  onChange,
  readOnly,
  clinicalAreas,
  treatmentNames,
}: SectionProps & {
  clinicalAreas: PracticeArea[];
  treatmentNames: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const term = normalize(query.trim());
    return clinicalAreas.flatMap((area) =>
      area.treatments
        .filter(
          (treatment) =>
            !term ||
            normalize(treatment.name).includes(term) ||
            normalize(area.name).includes(term),
        )
        .map((treatment) => ({ area, treatment })),
    );
  }, [clinicalAreas, query]);
  const marks = value.teeth.find((item) => item.fdi === fdi)?.marks ?? [];
  // Pendientes primero; los realizados quedan abajo, tachados.
  const planned = marks
    .map((mark, index) => ({ mark, index }))
    .filter(({ mark }) => mark.layer !== "hallazgo")
    .sort((a, b) => Number(a.mark.layer === "hecho") - Number(b.mark.layer === "hecho"));

  return (
    <>
      {readOnly ? null : (
        <div>
          <p className={SECTION_TITLE}>Agregar tratamiento</p>
          <label className="flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm ring-teal-600/40 transition focus-within:bg-white focus-within:ring-2 dark:bg-slate-800 dark:focus-within:bg-slate-900">
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en el tarifario… (endo, resina)"
              aria-label="Buscar tratamiento en el tarifario"
              className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
          <ul className="mt-2 max-h-52 space-y-0.5 overflow-y-auto" aria-label="Tratamientos del tarifario">
            {results.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-slate-400">
                {clinicalAreas.length === 0 ? "Cargando tarifario…" : "Sin coincidencias en el tarifario"}
              </li>
            ) : (
              results.map(({ area, treatment }) => (
                <li key={treatment.slug}>
                  <button
                    type="button"
                    aria-label={`Agregar ${treatment.name} al plan`}
                    onClick={() => {
                      onChange(addPlannedTreatment(value, fdi, treatment));
                      setQuery("");
                    }}
                    className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-teal-50 dark:hover:bg-teal-950/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
                        {treatment.name}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {area.name}
                        {treatment.odontogramStatus ? "" : " · sin dibujo en la carta"}
                      </span>
                    </span>
                    <Plus
                      className="size-4 shrink-0 text-slate-300 transition group-hover:text-teal-700 dark:text-slate-600 dark:group-hover:text-teal-300"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <div>
        <p className={SECTION_TITLE}>Plan de la pieza {fdi}</p>
        {planned.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
            Sin tratamientos para esta pieza.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {planned.map(({ mark, index }) => {
              const done = mark.layer === "hecho";
              const name = formatToothMark(mark, treatmentNames) || "Sin tratamiento";
              return (
                <li
                  key={`${index}-${mark.treatment ?? mark.status}`}
                  className={`rounded-xl p-2.5 ${
                    done ? "bg-teal-50 dark:bg-teal-950/40" : "bg-slate-50 dark:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium text-slate-800 dark:text-slate-100 ${
                          done ? "line-through decoration-teal-700/40" : ""
                        }`}
                      >
                        {name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {done
                          ? mark.doneByName
                            ? `Realizado por ${mark.doneByName}${mark.doneAt ? ` · ${formatDoneAt(mark.doneAt)}` : ""}`
                            : "Se registra quién lo realizó al guardar."
                          : mark.treatment
                            ? "Pendiente · visible en el banco de pacientes"
                            : "Sin tratamiento del tarifario: no aparece en el banco. Quítalo y agrega el tratamiento."}
                      </p>
                    </div>
                    {readOnly ? null : (
                      <button
                        type="button"
                        aria-label={`Quitar del plan: ${name}`}
                        title="Quitar del plan"
                        onClick={() => onChange(removeMark(value, fdi, index))}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {!done && mark.status && SURFACE_STATUSES.includes(mark.status) ? (
                    <div className="mt-2">
                      <OdontogramSurfaceDiagram
                        activeSurfaces={mark.surfaces}
                        disabled={readOnly}
                        mode="obturado"
                        onToggle={(surface, on) =>
                          onChange(setMarkSurface(value, fdi, index, surface, on))
                        }
                      />
                    </div>
                  ) : null}
                  {readOnly || !mark.treatment ? null : (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        className="size-4 accent-teal-700"
                        checked={done}
                        onChange={(event) => onChange(setDone(value, fdi, index, event.target.checked))}
                      />
                      Realizado
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
