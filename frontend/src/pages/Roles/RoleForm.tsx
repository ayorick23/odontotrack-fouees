import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { useAuth } from "../../hooks/useAuth";
import { dangerActionClass, primaryActionClass } from "../../lib/actions";
import {
  deleteRole,
  getPermissionCatalog,
  getRole,
  updateRole,
  type CatalogModule,
  type CatalogSection,
  type RoleRecord,
} from "../../services/roles";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      role: RoleRecord;
      catalog: CatalogSection[];
    };

export function RoleForm() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const roleId = Number(id);
  const { user, refreshUser } = useAuth();
  const isEditing = location.pathname.endsWith("/edit");
  const canWrite = can(user, "roles.edit") && isEditing;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(roleId) || roleId < 1) {
      setState({ status: "error", message: "Rol no válido." });
      return;
    }

    let cancelled = false;
    Promise.all([getRole(roleId), getPermissionCatalog()])
      .then(([role, catalog]) => {
        if (cancelled) {
          return;
        }
        setName(role.name);
        setDescription(role.description);
        setSelected(new Set(role.permissions));
        setState({ status: "ready", role, catalog });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudo cargar la matriz de este rol.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [roleId]);

  const catalog = state.status === "ready" ? state.catalog : [];
  const allNames = useMemo(
    () => catalog.flatMap((section) => section.modules.flatMap(moduleNames)),
    [catalog],
  );
  const visibleCatalog = useMemo(
    () => filterCatalog(catalog, query),
    [catalog, query],
  );
  const actionTypes = useMemo(
    () => uniqueActions(visibleCatalog),
    [visibleCatalog],
  );

  function toggle(name: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return next;
    });
  }

  function setMany(names: string[], checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const item of names) {
        if (checked) {
          next.add(item);
        } else {
          next.delete(item);
        }
      }
      return next;
    });
  }

  async function handleSave() {
    if (!canWrite || state.status !== "ready") {
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateRole(state.role.id, {
        name: trimmedName,
        description: description.trim(),
        permissions: [...selected],
      });
      setState({ ...state, role: updated });
      setSelected(new Set(updated.permissions));
      toast.success("Matriz de permisos guardada.");
      if (user?.role === updated.slug) {
        await refreshUser();
      }
    } catch {
      toast.error(
        "No se pudo guardar. Revisa que los permisos existan en el catálogo.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (state.status !== "ready" || state.role.is_system) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRole(state.role.id);
      toast.warning(`Se eliminó el rol “${state.role.name}”.`);
      navigate("/roles");
    } catch {
      const message =
        "No se pudo borrar el rol. Puede tener usuarios asignados.";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  if (state.status === "loading") {
    return <p className="text-sm text-slate-400">Cargando matriz...</p>;
  }

  if (state.status === "error") {
    return (
      <p className="text-sm text-red-600 dark:text-red-400" role="alert">
        {state.message}
      </p>
    );
  }

  const canRemove = can(user, "roles.delete") && !state.role.is_system;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/roles"
          className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
        >
          ← Volver a roles
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {canRemove ? (
            <button
              type="button"
              onClick={() => {
                setPendingDelete(true);
                setDeleteError(null);
              }}
              className={dangerActionClass}
            >
              Eliminar rol
            </button>
          ) : null}
          {canWrite ? (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className={primaryActionClass}
            >
              {saving ? "Guardando..." : "Guardar matriz"}
            </button>
          ) : can(user, "roles.edit") ? (
            <Link
              to={`/roles/${state.role.id}/edit`}
              className={primaryActionClass}
            >
              Editar
            </Link>
          ) : (
            <p className="text-xs text-slate-400">Solo lectura</p>
          )}
        </div>
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete}
        title={`¿Eliminar el rol “${state.role.name}”?`}
        error={deleteError}
        busy={deleting}
        onCancel={() => {
          setPendingDelete(false);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      />

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-white/10">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Nombre
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canWrite}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#2ad4c5] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Descripción
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!canWrite}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#2ad4c5] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-white/10">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar módulo o permiso..."
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#2ad4c5] dark:border-slate-700 dark:bg-slate-800"
          />
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-medium text-slate-400">
              Seleccionar todos por permiso
            </p>
            {actionTypes.map((action) => {
              const names = namesForAction(visibleCatalog, action.key);
              if (names.length === 0) {
                return null;
              }
              return (
                <label
                  key={action.key}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[#2ad4c5]"
                    disabled={!canWrite}
                    checked={names.every((item) => selected.has(item))}
                    onChange={(event) => setMany(names, event.target.checked)}
                  />
                  {action.label}
                </label>
              );
            })}
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setMany(allNames, true)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {visibleCatalog.map((section) => {
            const sectionNames = section.modules.flatMap(moduleNames);
            return (
              <div key={section.key}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    {section.label}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => setMany(sectionNames, true)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      Seleccionar sección
                    </button>
                    <button
                      type="button"
                      disabled={!canWrite}
                      onClick={() => setMany(sectionNames, false)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300"
                    >
                      Limpiar sección
                    </button>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {section.modules.map((module) => {
                    const names = moduleNames(module);
                    const allChecked = names.every((item) => selected.has(item));
                    return (
                      <article
                        key={module.key}
                        className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800"
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-semibold text-slate-800 dark:text-slate-100">
                              {module.label}
                            </h4>
                            <p className="text-xs text-slate-400">
                              {module.description}
                            </p>
                          </div>
                          <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                            <input
                              type="checkbox"
                              className="size-4 accent-[#2ad4c5]"
                              disabled={!canWrite}
                              checked={allChecked}
                              onChange={(event) =>
                                setMany(names, event.target.checked)
                              }
                            />
                            Todos
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {module.actions.map((action) => (
                            <label
                              key={action.name}
                              className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-200"
                            >
                              <input
                                type="checkbox"
                                className="size-4 accent-[#2ad4c5]"
                                disabled={!canWrite}
                                checked={selected.has(action.name)}
                                onChange={(event) =>
                                  toggle(action.name, event.target.checked)
                                }
                              />
                              {action.label}
                            </label>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function moduleNames(module: CatalogModule): string[] {
  return module.actions.map((action) => action.name);
}

function uniqueActions(catalog: CatalogSection[]): Array<{ key: string; label: string }> {
  const seen = new Map<string, string>();
  for (const section of catalog) {
    for (const module of section.modules) {
      for (const action of module.actions) {
        if (!seen.has(action.key)) {
          seen.set(action.key, action.label);
        }
      }
    }
  }
  return [...seen.entries()].map(([key, label]) => ({ key, label }));
}

function namesForAction(catalog: CatalogSection[], actionKey: string): string[] {
  return catalog.flatMap((section) =>
    section.modules.flatMap((module) =>
      module.actions
        .filter((action) => action.key === actionKey)
        .map((action) => action.name),
    ),
  );
}

function filterCatalog(catalog: CatalogSection[], query: string): CatalogSection[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return catalog;
  }
  return catalog
    .map((section) => ({
      ...section,
      modules: section.modules.filter((module) => {
        const haystack = [
          module.label,
          module.description,
          module.key,
          ...module.actions.map((action) => `${action.label} ${action.name}`),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      }),
    }))
    .filter((section) => section.modules.length > 0);
}
