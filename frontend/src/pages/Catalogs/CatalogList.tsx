import { BookOpen, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { Modal } from "../../components/Modal";
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

const panelClass =
  "flex min-h-[28rem] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10";

const deleteButtonClass =
  "inline-flex size-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300";

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
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Catálogo clínico
          </h2>
          <p className="text-sm text-slate-400">
            Áreas y tratamientos que aparecen al registrar un paciente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300 dark:ring-1 dark:ring-white/10">
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
              className={primaryActionClass}
            >
              <Plus className="size-4" />
              Nueva área
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-[28rem] gap-4 lg:h-[calc(100svh-11rem)] lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
        <section className={panelClass}>
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
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
                            ? "bg-teal-50 dark:bg-teal-950/40"
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
                                ? "text-teal-800 dark:text-teal-200"
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
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tratamientos
              </p>
              <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
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
