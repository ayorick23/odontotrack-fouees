import { BookOpen, Plus, Search, Trash2 } from "../../components/icons";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { Modal } from "../../components/Modal";
import {
  GLASS_CONTROL,
  GLASS_PANEL,
  PANEL_HEADER,
  PRIMARY_BUTTON,
  PRIMARY_ICON_DOT,
} from "../../components/listing/styles";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import {
  createClinicalArea,
  createClinicalTreatment,
  deleteClinicalArea,
  deleteClinicalTreatment,
  listClinicalAreas,
  type ClinicalAreaRecord,
} from "../../services/catalogs";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; areas: ClinicalAreaRecord[] };

type PendingDelete =
  | { kind: "area"; id: number; name: string }
  | { kind: "treatment"; id: number; name: string };

// Columna de contenido: bloque sólido dentro del marco de vidrio.
const panelClass =
  "flex min-h-[28rem] flex-col overflow-hidden rounded-[18px] bg-surface";

// Gris en reposo y rojo al pasar el mouse: una papelera roja por fila era ruido.
const deleteButtonClass =
  "press inline-flex size-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-300";

export function CatalogList() {
  const { user } = useAuth();
  const canCreate = can(user, "catalogs.create");
  const canRemove = can(user, "catalogs.delete");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [treatmentModalOpen, setTreatmentModalOpen] = useState(false);

  function reload() {
    listClinicalAreas()
      .then((areas) => {
        setState({ status: "ready", areas });
        setSelectedAreaId((current) => {
          if (current && areas.some((area) => area.id === current)) {
            return current;
          }
          return areas[0]?.id ?? null;
        });
      })
      .catch(() =>
        setState({
          status: "error",
          message: "No se pudo cargar el catálogo clínico.",
        }),
      );
  }

  useEffect(() => {
    reload();
  }, []);

  const selectedArea =
    state.status === "ready"
      ? (state.areas.find((area) => area.id === selectedAreaId) ?? null)
      : null;

  const areaRows = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return state.areas;
    }
    return state.areas.filter((area) =>
      `${area.name} ${area.slug}`.toLowerCase().includes(needle),
    );
  }, [search, state]);

  useEffect(() => {
    if (areaRows.length === 0) {
      return;
    }
    if (
      selectedAreaId === null ||
      !areaRows.some((area) => area.id === selectedAreaId)
    ) {
      setSelectedAreaId(areaRows[0].id);
    }
  }, [areaRows, selectedAreaId]);

  async function confirmDelete() {
    if (pendingDelete === null) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      if (pendingDelete.kind === "area") {
        await deleteClinicalArea(pendingDelete.id);
        toast.warning(`Se eliminó el área “${pendingDelete.name}”.`);
      } else {
        await deleteClinicalTreatment(pendingDelete.id);
        toast.warning(`Se eliminó el tratamiento “${pendingDelete.name}”.`);
      }
      setPendingDelete(null);
      reload();
    } catch {
      const message =
        pendingDelete.kind === "area"
          ? "No se pudo borrar el área. Puede tener pacientes asignados."
          : "No se pudo borrar el tratamiento. Puede estar asignado a un paciente.";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    // Doble fondo: título y acciones sobre el vidrio; áreas y tratamientos en
    // dos bloques sólidos dentro del mismo marco.
    <section className={`${GLASS_PANEL} flex flex-col`}>
      <div className={PANEL_HEADER}>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink dark:text-white">
            Catálogo clínico
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Áreas y tratamientos que aparecen al registrar un paciente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`flex items-center gap-2 ${GLASS_CONTROL}`}>
            <Search className="size-4 shrink-0" />
            <span className="sr-only">Buscar área</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar área"
              className="w-44 bg-transparent outline-none placeholder:text-slate-400"
            />
          </label>
          {canCreate ? (
            <button
              type="button"
              onClick={() => setAreaModalOpen(true)}
              className={`${PRIMARY_BUTTON} anim-spin-plus py-1.5 pl-1.5`}
            >
              <span className={PRIMARY_ICON_DOT}>
                <Plus className="size-4" weight="bold" aria-hidden="true" />
              </span>
              Nueva área
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-[28rem] gap-2 lg:h-[calc(100svh-13rem)] lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
        <section className={panelClass}>
          <p className="border-b border-ink/5 px-4 py-3 text-sm font-semibold text-ink dark:border-white/10 dark:text-white">
            Áreas
          </p>
          {state.status === "loading" ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              Cargando catálogo...
            </p>
          ) : null}
          {state.status === "error" ? (
            <p
              className="px-4 py-8 text-center text-sm text-red-600 dark:text-red-400"
              role="alert"
            >
              {state.message}
            </p>
          ) : null}
          {state.status === "ready" ? (
            areaRows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">
                {search.trim()
                  ? "Ningún área coincide con la búsqueda."
                  : "No hay áreas clínicas."}
              </p>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                {areaRows.map((area) => {
                  const selected = area.id === selectedAreaId;
                  return (
                    <li key={area.id}>
                      <div
                        className={`flex items-center gap-1 rounded-xl ${
                          selected
                            ? "bg-lime-soft "
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedAreaId(area.id)}
                          className="min-w-0 flex-1 px-3 py-2.5 text-left"
                        >
                          <p
                            className={`truncate text-sm font-medium ${
                              selected
                                ? "text-lime-ink "
                                : "text-slate-800 dark:text-slate-100"
                            }`}
                          >
                            {area.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {area.treatments.length === 1
                              ? "1 tratamiento"
                              : `${area.treatments.length} tratamientos`}
                          </p>
                        </button>
                        {canRemove ? (
                          <button
                            type="button"
                            title={`Eliminar ${area.name}`}
                            aria-label={`Eliminar ${area.name}`}
                            onClick={() => {
                              setDeleteError(null);
                              setPendingDelete({
                                kind: "area",
                                id: area.id,
                                name: area.name,
                              });
                            }}
                            className={`mr-1 ${deleteButtonClass}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </section>

        <section className={panelClass}>
          <div className="flex items-center justify-between gap-3 border-b border-ink/5 px-4 py-3 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tratamientos de
              </p>
              <h3 className="truncate text-sm font-semibold text-ink dark:text-white">
                {selectedArea ? selectedArea.name : "Elige un área"}
              </h3>
            </div>
            {canCreate && selectedArea ? (
              <button
                type="button"
                onClick={() => setTreatmentModalOpen(true)}
                className={primaryActionClass}
              >
                <Plus className="size-4" />
                Agregar
              </button>
            ) : null}
          </div>
          {selectedArea ? (
            selectedArea.treatments.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">
                Esta área aún no tiene tratamientos. Agrega el primero.
              </p>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                {selectedArea.treatments.map((treatment) => (
                  <li
                    key={treatment.id}
                    className="flex items-start gap-2 rounded-xl px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  >
                    <p className="min-w-0 flex-1 text-sm font-medium wrap-break-word text-slate-800 dark:text-slate-100">
                      {treatment.name}
                    </p>
                    {canRemove ? (
                      <button
                        type="button"
                        title={`Eliminar ${treatment.name}`}
                        aria-label={`Eliminar ${treatment.name}`}
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDelete({
                            kind: "treatment",
                            id: treatment.id,
                            name: treatment.name,
                          });
                        }}
                        className={`shrink-0 ${deleteButtonClass}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <p className="flex items-center gap-2 px-4 py-10 text-sm text-slate-400">
              <BookOpen className="size-4 shrink-0" />
              Elige un área para ver o agregar tratamientos.
            </p>
          )}
        </section>
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title={
          pendingDelete
            ? `¿Eliminar “${pendingDelete.name}”?`
            : "¿Eliminar?"
        }
        error={deleteError}
        busy={deleting}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      />

      <NameModal
        isOpen={areaModalOpen}
        title="Nueva área clínica"
        label="Nombre del área"
        submitLabel="Crear área"
        onClose={() => setAreaModalOpen(false)}
        onSubmit={async (name) => {
          const area = await createClinicalArea({ name });
          toast.success(`Se creó el área “${area.name}”.`);
          setSelectedAreaId(area.id);
          reload();
        }}
      />

      <NameModal
        isOpen={treatmentModalOpen}
        title="Nuevo tratamiento"
        label="Nombre del tratamiento"
        submitLabel="Agregar tratamiento"
        onClose={() => setTreatmentModalOpen(false)}
        onSubmit={async (name) => {
          if (!selectedArea) {
            throw new Error("Selecciona un área.");
          }
          await createClinicalTreatment({
            name,
            area: selectedArea.id,
          });
          toast.success(`Se agregó “${name}”.`);
          reload();
        }}
      />
    </section>
  );
}

function NameModal({
  isOpen,
  title,
  label,
  submitLabel,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  title: string;
  label: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setName("");
    setError(null);
    setSaving(false);
  }, [isOpen]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch {
      toast.error("No se pudo guardar. Revisa el nombre e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="space-y-4"
      >
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
          {label}
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            autoFocus
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={secondaryActionClass}
          >
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryActionClass}>
            {saving ? "Guardando..." : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
