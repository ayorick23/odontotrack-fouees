import { useEffect, useState } from "react";

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
  type ToothStatus,
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
import { OdontogramFieldSelect } from "./OdontogramFieldSelect";
import { OdontogramSurfaceDiagram } from "./OdontogramSurfaceDiagram";
import { STATUS_SWATCH } from "./statusColors";

const STATUS_BUTTON: Record<ToothStatus, string> = {
  sano: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  caries:
    "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  fractura:
    "border-red-200 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
  obturado:
    "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  sellante:
    "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  restauracion_temporal:
    "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200",
  endodoncia:
    "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
  pulpotomia:
    "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  extraido:
    "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  raiz_retenida:
    "border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200",
  no_erupcionado:
    "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  ausente_congenito:
    "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
  corona:
    "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200",
  puente:
    "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200",
  implante:
    "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
};

const PRESSED = "ring-2 ring-teal-500 ring-offset-1 dark:ring-offset-slate-900";

const VIEW_HELP: Record<OdontogramView, string> = {
  diagnostico:
    "Lo que trae la pieza, incluidas restauraciones de antes. Cada botón marca o desmarca; Sano limpia el diagnóstico.",
  plan:
    "Elige el tratamiento del tarifario: se dibuja solo y la pieza queda en el banco de pacientes hasta marcarlo como realizado.",
};

/** El diagnóstico se guarda en la capa hallazgo. */
const DIAGNOSIS_LAYER = "hallazgo";

const MARKS = Object.keys(ORAL_GENERAL_MARK_LABELS) as OralGeneralMark[];

type OdontogramToolbarProps = {
  value: OdontogramValue;
  onChange: (value: OdontogramValue) => void;
  readOnly: boolean;
  view: OdontogramView;
  focusedFdi?: number | null;
  clinicalAreas?: PracticeArea[];
  treatmentNames?: Record<string, string>;
  onClearFocus?: () => void;
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
    <div className="flex h-full flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Diente {fdi}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {VIEW_HELP[view]}
        </p>
        {readOnly ? null : (
          <button
            type="button"
            onClick={() => {
              clearChartSelection();
              onClearFocus?.();
            }}
            className="mt-2 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
          >
            Borrar selección
          </button>
        )}
      </div>

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
        <StatusSection
          value={value}
          fdi={fdi}
          onChange={onChange}
          readOnly={readOnly}
        />
      )}

      {view === "plan" ? null : (
        <HygieneSection
          value={value}
          fdi={fdi}
          onChange={onChange}
          readOnly={readOnly}
          open={moreOpen}
          onToggle={() => setMoreOpen((open) => !open)}
        />
      )}
    </div>
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
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Marcas del diente {fdi}
          </p>
          <div className="flex flex-wrap gap-2">
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
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
                    active
                      ? "border-teal-500 bg-teal-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {ORAL_GENERAL_MARK_LABELS[mark]}
                </button>
              );
            })}
          </div>
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.statuses.map((status) => {
              const pressed = active.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={status === "sano" ? undefined : pressed}
                  onClick={() => onChange(toggleStatus(value, fdi, layer, status))}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${STATUS_BUTTON[status]} ${pressed ? PRESSED : ""}`}
                >
                  <span
                    className={`size-2 rounded-full ${STATUS_SWATCH[status]}`}
                    aria-hidden="true"
                  />
                  {TOOTH_STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Superficies
        </p>
        <div className="mb-3 flex gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          {(["caries", "obturado"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={readOnly}
              aria-pressed={surfaceMode === mode}
              aria-label={`Modo superficie ${mode}`}
              onClick={() => setSurfaceMode(mode)}
              className={`flex-1 rounded-full px-2 py-1 text-xs font-semibold transition ${
                surfaceMode === mode
                  ? mode === "caries"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {TOOTH_STATUS_LABELS[mode]}
            </button>
          ))}
        </div>
        <OdontogramSurfaceDiagram
          activeSurfaces={activeSurfaces}
          disabled={readOnly}
          mode={surfaceMode}
          onToggle={(surface, on) =>
            onChange(toggleSurface(value, fdi, layer, surfaceMode, surface, on))
          }
        />
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
  const [areaSlug, setAreaSlug] = useState("");
  const [treatmentSlug, setTreatmentSlug] = useState("");
  const area = clinicalAreas.find((item) => item.slug === areaSlug);
  const treatment = area?.treatments.find((item) => item.slug === treatmentSlug);
  const marks = value.teeth.find((item) => item.fdi === fdi)?.marks ?? [];
  // Pendientes primero; los realizados quedan abajo, tachados.
  const planned = marks
    .map((mark, index) => ({ mark, index }))
    .filter(({ mark }) => mark.layer !== "hallazgo")
    .sort((a, b) => Number(a.mark.layer === "hecho") - Number(b.mark.layer === "hecho"));

  return (
    <>
      <div className="flex flex-col gap-2">
        <OdontogramFieldSelect
          label="Área clínica"
          placeholder="Seleccionar área"
          disabled={readOnly}
          value={areaSlug}
          options={clinicalAreas.map((item) => ({ value: item.slug, label: item.name }))}
          onChange={(next) => {
            setAreaSlug(next);
            setTreatmentSlug("");
          }}
        />
        {area ? (
          <OdontogramFieldSelect
            label="Tratamiento"
            placeholder="Seleccionar tratamiento"
            disabled={readOnly}
            value={treatmentSlug}
            options={area.treatments.map((item) => ({
              value: item.slug,
              label: item.odontogramStatus ? item.name : `${item.name} (sin dibujo)`,
            }))}
            onChange={setTreatmentSlug}
          />
        ) : null}
        <button
          type="button"
          disabled={readOnly || !treatment}
          onClick={() => {
            if (treatment) {
              onChange(addPlannedTreatment(value, fdi, treatment));
              setTreatmentSlug("");
            }
          }}
          className="w-fit rounded-full bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Agregar al plan
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Plan del diente {fdi}
        </p>
        {planned.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nada planificado en esta pieza.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {planned.map(({ mark, index }) => {
              const done = mark.layer === "hecho";
              return (
                <li
                  key={`${index}-${mark.treatment ?? mark.status}`}
                  className={`rounded-xl p-3 ring-1 ${
                    done
                      ? "bg-emerald-50/60 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900"
                      : "bg-white ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      done
                        ? "text-emerald-800 line-through decoration-1 dark:text-emerald-200"
                        : "text-slate-700 dark:text-slate-100"
                    }`}
                  >
                    {formatToothMark(mark, treatmentNames) || "Sin tratamiento"}
                  </p>
                  {mark.treatment ? null : (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Sin tratamiento del tarifario: no aparece en el banco. Quítalo y
                      agrega el tratamiento.
                    </p>
                  )}
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
                  {readOnly ? null : (
                    <div className="mt-2 flex items-center gap-4">
                      {mark.treatment ? (
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={(event) =>
                              onChange(setDone(value, fdi, index, event.target.checked))
                            }
                          />
                          Realizado
                        </label>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onChange(removeMark(value, fdi, index))}
                        className="text-xs font-semibold text-red-700 hover:underline dark:text-red-300"
                      >
                        Quitar
                      </button>
                    </div>
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
