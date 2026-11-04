import { Check, Undo2, X } from "lucide-react";
import { useState } from "react";

import {
  ORAL_GENERAL_MARK_LABELS,
  TOOTH_STATUS_GROUPS,
  TOOTH_SURFACE_CODES,
  TOOTH_SURFACE_LABELS,
  TOOTH_SURFACE_ORDER,
  TOOTH_STATUS_LABELS,
  formatToothMark,
  markedTeeth,
  viewOfMark,
  type FdiToothNumber,
  type OdontogramValue,
  type OdontogramView,
  type ToothMark,
  type ToothSurface,
} from "../../types";
import { removeMark, setDone } from "./edits";
import { formatDoneAt } from "./formatDoneAt";

type RecordKind = "diagnostico" | "pendiente" | "realizado";
type RecordFilter = "todos" | RecordKind;

type RecordRow = {
  key: string;
  fdi: FdiToothNumber;
  kind: RecordKind;
  /** "16 Caries O": nombre accesible de las acciones de la fila. */
  text: string;
  description: string;
  /** Grupo del estado (Patología, Tratamiento…) en el diagnóstico. */
  group?: string;
  surfaces: ToothSurface[];
  /** Posición de la marca en la pieza; null en placa/sangrado/sarro. */
  markIndex: number | null;
  mark?: ToothMark;
};

const FILTERS: Array<{ id: RecordFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "pendiente", label: "Plan pendiente" },
  { id: "realizado", label: "Realizados" },
];

const KIND_ORDER: Record<RecordKind, number> = { diagnostico: 0, pendiente: 1, realizado: 2 };

const STATUS_GROUP = new Map(
  TOOTH_STATUS_GROUPS.flatMap((group) => group.statuses.map((status) => [status, group.label])),
);

type OdontogramChartRecordProps = {
  value: OdontogramValue;
  /** Nombre por slug de tratamiento, para las marcas con tratamiento. */
  treatmentNames?: Record<string, string>;
  focusedFdi?: number | null;
  onFocusTooth?: (fdi: FdiToothNumber) => void;
  /** Al tocar una fila se abre la vista donde se edita. */
  onViewChange?: (view: OdontogramView) => void;
  /** Sin esto el registro es de solo lectura (sin acciones). */
  onChange?: (value: OdontogramValue) => void;
};

function buildRows(
  value: OdontogramValue,
  treatmentNames: Record<string, string>,
): RecordRow[] {
  const rows: RecordRow[] = [];
  for (const tooth of markedTeeth(value)) {
    tooth.marks.forEach((mark, index) => {
      const formatted = formatToothMark(mark, treatmentNames);
      const kind: RecordKind =
        viewOfMark(mark) === "diagnostico"
          ? "diagnostico"
          : mark.layer === "hecho"
            ? "realizado"
            : "pendiente";
      rows.push({
        key: `${tooth.fdi}-${index}-${mark.layer}-${mark.status}-${mark.treatment ?? ""}`,
        fdi: tooth.fdi,
        kind,
        text: `${tooth.fdi} ${formatted}`,
        description: mark.treatment
          ? (treatmentNames[mark.treatment] ?? mark.treatment)
          : mark.status
            ? TOOTH_STATUS_LABELS[mark.status]
            : formatted,
        group: kind === "diagnostico" && mark.status ? STATUS_GROUP.get(mark.status) : undefined,
        surfaces: mark.surfaces,
        markIndex: index,
        mark,
      });
    });
    const oral = Object.entries(tooth.oralMarks)
      .filter(([, active]) => active)
      .map(([mark]) => ORAL_GENERAL_MARK_LABELS[mark as keyof typeof ORAL_GENERAL_MARK_LABELS]);
    if (oral.length > 0) {
      rows.push({
        key: `${tooth.fdi}-oral`,
        fdi: tooth.fdi,
        kind: "diagnostico",
        text: `${tooth.fdi} ${oral.join(" · ")}`,
        description: oral.join(" · "),
        group: "Higiene",
        surfaces: [],
        markIndex: null,
      });
    }
  }
  return rows.sort((a, b) => a.fdi - b.fdi || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

/**
 * Registro de la carta: todo lo marcado en el odontograma en una tabla,
 * con filtros por tipo y quién realizó cada tratamiento. Al tocar una fila
 * se ubica la pieza en la carta.
 */
export function OdontogramChartRecord({
  value,
  treatmentNames = {},
  focusedFdi,
  onFocusTooth,
  onViewChange,
  onChange,
}: OdontogramChartRecordProps) {
  const [filter, setFilter] = useState<RecordFilter>("todos");
  const rows = buildRows(value, treatmentNames);
  const counts: Record<RecordFilter, number> = {
    todos: rows.length,
    diagnostico: rows.filter((row) => row.kind === "diagnostico").length,
    pendiente: rows.filter((row) => row.kind === "pendiente").length,
    realizado: rows.filter((row) => row.kind === "realizado").length,
  };
  const visible = filter === "todos" ? rows : rows.filter((row) => row.kind === filter);

  function locate(row: RecordRow) {
    onViewChange?.(row.kind === "diagnostico" ? "diagnostico" : "plan");
    onFocusTooth?.(row.fdi);
  }

  return (
    <section className="mt-5" aria-label="Registro de la carta">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Registro de la carta
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {rows.length > 0
              ? "Haz clic en una fila para ubicar la pieza en la carta."
              : "Aún no hay nada marcado en la carta."}
          </p>
        </div>
        {rows.length > 0 ? (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar registro">
            {FILTERS.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(item.id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {item.label}
                  <span
                    className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                      active ? "bg-white/20" : "bg-white dark:bg-slate-700"
                    }`}
                    aria-hidden="true"
                  >
                    {counts[item.id]}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="relative mt-3 overflow-x-auto rounded-xl ring-1 ring-slate-100 dark:ring-slate-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Registro de la carta</caption>
            <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Pieza</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Superficies</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Descripción</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Tipo</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Estado</th>
                {onChange ? (
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Acciones</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <RecordRowView
                  key={row.key}
                  row={row}
                  value={value}
                  focused={focusedFdi === row.fdi}
                  onLocate={() => locate(row)}
                  onChange={onChange}
                />
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No hay registros con este filtro.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RecordRowView({
  row,
  value,
  focused,
  onLocate,
  onChange,
}: {
  row: RecordRow;
  value: OdontogramValue;
  focused: boolean;
  onLocate: () => void;
  onChange?: (value: OdontogramValue) => void;
}) {
  const canBeDone = row.kind !== "diagnostico" && Boolean(row.mark?.treatment);
  const done = row.kind === "realizado";
  const doneVerb = done ? "Volver a pendiente" : "Marcar como realizado";

  return (
    <tr
      onClick={onLocate}
      className={`group cursor-pointer border-t border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 ${
        focused ? "bg-teal-50/60 dark:bg-teal-950/30" : ""
      }`}
    >
      <td className="px-4 py-2.5">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onLocate();
          }}
          aria-label={`Ubicar ${row.text} en la carta`}
          className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-100 px-1.5 text-xs font-bold tabular-nums text-slate-700 transition group-hover:bg-white dark:bg-slate-800 dark:text-slate-200 dark:group-hover:bg-slate-700"
        >
          {row.fdi}
        </button>
      </td>
      <td className="px-3 py-2.5 text-xs font-semibold tracking-wider text-slate-600 dark:text-slate-300">
        {row.surfaces.length > 0 ? (
          <span title={orderedSurfaces(row.surfaces).map((surface) => TOOTH_SURFACE_LABELS[surface]).join(", ")}>
            {orderedSurfaces(row.surfaces).map((surface) => TOOTH_SURFACE_CODES[surface]).join(" · ")}
          </span>
        ) : (
          <span className="font-normal tracking-normal text-slate-400">
            {row.markIndex == null ? "—" : "Pieza completa"}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <span
          className={`font-medium text-slate-800 dark:text-slate-100 ${
            done ? "line-through decoration-teal-700/40" : ""
          }`}
        >
          {row.description}
        </span>
        {row.group ? (
          <span className="ml-2 text-[11px] text-slate-400">{row.group}</span>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <KindLabel kind={row.kind} />
      </td>
      <td className="px-3 py-2.5">
        <StateLabel row={row} />
      </td>
      {onChange ? (
        <td className="px-4 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
          <div className="inline-flex items-center gap-1 opacity-80 transition group-hover:opacity-100">
            {canBeDone && row.markIndex != null ? (
              <button
                type="button"
                aria-label={`${doneVerb}: ${row.text}`}
                title={doneVerb}
                onClick={() => onChange(setDone(value, row.fdi, row.markIndex!, !done))}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                  done
                    ? "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    : "text-teal-700 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/40"
                }`}
              >
                {done ? (
                  <Undo2 className="size-3.5" aria-hidden="true" />
                ) : (
                  <Check className="size-3.5" aria-hidden="true" />
                )}
                {done ? "Deshacer" : "Marcar realizado"}
              </button>
            ) : null}
            {row.markIndex != null ? (
              <button
                type="button"
                aria-label={`Quitar ${row.text}`}
                title="Quitar"
                onClick={() => onChange(removeMark(value, row.fdi, row.markIndex!))}
                className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

/** En el orden clínico (M O D V L), sin importar cómo se marcaron. */
function orderedSurfaces(surfaces: ToothSurface[]): ToothSurface[] {
  return TOOTH_SURFACE_ORDER.filter((surface) => surfaces.includes(surface));
}

function KindLabel({ kind }: { kind: RecordKind }) {
  if (kind === "diagnostico") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
        <span className="size-2 rounded-full bg-rose-500" aria-hidden="true" />
        Diagnóstico
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
      <span
        className={`size-2 rounded-full ${
          kind === "realizado" ? "bg-teal-600" : "border-2 border-dashed border-violet-500"
        }`}
        aria-hidden="true"
      />
      Plan
    </span>
  );
}

function StateLabel({ row }: { row: RecordRow }) {
  if (row.kind === "diagnostico") {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">Registrado en el diagnóstico</span>
    );
  }
  if (row.kind === "pendiente") {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <span className="size-1.5 rounded-full bg-violet-500" aria-hidden="true" />
          Pendiente
        </span>
        {row.mark?.treatment ? null : (
          <span className="text-[11px] text-amber-700 dark:text-amber-300">
            Sin tratamiento del tarifario: no aparece en el banco
          </span>
        )}
      </span>
    );
  }
  const by = row.mark?.doneByName;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-950/60 dark:text-teal-200">
      <Check className="size-3" aria-hidden="true" />
      {by
        ? `${by}${row.mark?.doneAt ? ` · ${formatDoneAt(row.mark.doneAt)}` : ""}`
        : "Se registra al guardar"}
    </span>
  );
}
