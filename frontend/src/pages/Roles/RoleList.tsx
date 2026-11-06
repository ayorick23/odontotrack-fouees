import { Plus, Search, Shield } from "../../components/icons";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { Modal } from "../../components/Modal";
import { GLASS_CONTROL, GLASS_PANEL, PANEL_HEADER, PRIMARY_BUTTON, PRIMARY_ICON_DOT, SOLID_BLOCK } from "../../components/listing/styles";
import { Table } from "../../components/Table";
import { TableRowActions } from "../../components/TableRowActions";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import {
  createRole,
  deleteRole,
  listRoles,
  type RoleRecord,
} from "../../services/roles";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; roles: RoleRecord[] };

type PendingDelete = { id: number; name: string };

export function RoleList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = can(user, "roles.create");
  const canEdit = can(user, "roles.edit");
  const canRemove = can(user, "roles.delete");
  const [search, setSearch] = useState("");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listRoles()
      .then((roles) => {
        if (!cancelled) {
          setState({ status: "ready", roles });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            message: "No se pudieron cargar los roles.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return state.roles;
    }
    return state.roles.filter((role) => {
      const haystack = `${role.name} ${role.description}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [search, state]);

  const columns = useMemo(
    () => [
      {
        header: "Rol",
        render: (role: RoleRecord) => (
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lime-soft text-lime-ink">
              <Shield className="size-4" />
            </span>
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {role.name}
              </p>
              {role.is_system ? (
                <p className="text-xs text-slate-400">Rol de sistema</p>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        header: "Descripción",
        render: (role: RoleRecord) => (
          <p className="max-w-md text-slate-500 dark:text-slate-400">
            {role.description || "—"}
          </p>
        ),
      },
      {
        header: "Permisos",
        render: (role: RoleRecord) => (
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {role.permissions.length}
          </span>
        ),
      },
      {
        header: "Acciones",
        align: "right" as const,
        render: (role: RoleRecord) => (
          <TableRowActions
            editTo={canEdit ? `/roles/${role.id}/edit` : undefined}
            onDelete={
              canRemove && !role.is_system
                ? () => {
                    setDeleteError(null);
                    setPendingDelete({ id: role.id, name: role.name });
                  }
                : undefined
            }
            deleteDisabled={canRemove && role.is_system}
            deleteHint="Los roles de sistema no se pueden eliminar"
          />
        ),
      },
    ],
    [canEdit, canRemove],
  );

  async function confirmDelete() {
    if (pendingDelete === null || state.status !== "ready") {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRole(pendingDelete.id);
      setState({
        status: "ready",
        roles: state.roles.filter((role) => role.id !== pendingDelete.id),
      });
      setPendingDelete(null);
      toast.warning(`Se eliminó el rol “${pendingDelete.name}”.`);
    } catch {
      const message =
        "No se pudo borrar el rol. Puede tener usuarios asignados.";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    // Doble fondo: título y búsqueda sobre el vidrio, la tabla en el bloque sólido.
    <section className={GLASS_PANEL}>
      <div className={PANEL_HEADER}>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink dark:text-white">Roles</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Cada rol define qué puede ver y hacer quien lo tiene.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`flex items-center gap-2 ${GLASS_CONTROL}`}>
            <Search className="size-4 shrink-0" />
            <span className="sr-only">Buscar rol</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar rol"
              className="w-44 bg-transparent outline-none placeholder:text-slate-400"
            />
          </label>
          {canCreate ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={`${PRIMARY_BUTTON} anim-spin-plus py-1.5 pl-1.5`}
            >
              <span className={PRIMARY_ICON_DOT}>
                <Plus className="size-4" weight="bold" aria-hidden="true" />
              </span>
              Nuevo rol
            </button>
          ) : null}
        </div>
      </div>

      <section className={SOLID_BLOCK}>
        {state.status === "loading" ? (
          <p className="px-2 py-10 text-center text-sm text-slate-400">
            Cargando roles...
          </p>
        ) : null}

        {state.status === "error" ? (
          <p className="px-2 py-8 text-center text-sm text-red-600 dark:text-red-400" role="alert">
            {state.message}
          </p>
        ) : null}

        {state.status === "ready" ? (
          <Table
            caption="Roles"
            columns={columns}
            rows={rows}
            getRowKey={(role) => role.id}
            emptyMessage={
              search.trim()
                ? "Ningún rol coincide con la búsqueda."
                : "No hay roles para mostrar."
            }
          />
        ) : null}
      </section>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title={
          pendingDelete ? `¿Eliminar el rol “${pendingDelete.name}”?` : "¿Eliminar rol?"
        }
        error={deleteError}
        busy={deleting}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      />

      <CreateRoleModal
        isOpen={createOpen}
        canEditAfterCreate={canEdit}
        onClose={() => setCreateOpen(false)}
        onCreated={(role) => {
          setCreateOpen(false);
          if (canEdit) {
            toast.success("Rol creado. Asigna los permisos y guarda la matriz.");
            navigate(`/roles/${role.id}/edit`);
            return;
          }
          toast.success(`Rol “${role.name}” creado.`);
          if (state.status === "ready") {
            setState({ status: "ready", roles: [...state.roles, role] });
          }
        }}
      />
    </section>
  );
}

function CreateRoleModal({
  isOpen,
  canEditAfterCreate,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  canEditAfterCreate: boolean;
  onClose: () => void;
  onCreated: (role: RoleRecord) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setName("");
    setDescription("");
    setError(null);
    setSaving(false);
  }, [isOpen]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const role = await createRole({
        name: trimmedName,
        description: description.trim(),
        permissions: [],
      });
      onCreated(role);
    } catch {
      toast.error("No se pudo crear el rol. Revisa el nombre e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo rol">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="space-y-4"
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {canEditAfterCreate
            ? "Primero guarda el rol. Después le asignas la matriz de permisos."
            : "El rol se crea sin permisos. Un administrador puede asignarlos después."}
        </p>
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
          Nombre
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) {
                setError(null);
              }
            }}
            autoFocus
            aria-invalid={error ? true : undefined}
            className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 outline-none dark:bg-slate-800 dark:text-slate-100 ${
              error
                ? "border-red-400 focus:border-red-500 dark:border-red-500"
                : "border-slate-200 focus:border-action dark:border-slate-700"
            }`}
          />
        </label>
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
          Descripción
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-action dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
          <button
            type="submit"
            disabled={saving}
            className={primaryActionClass}
          >
            {saving ? "Creando..." : "Crear rol"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
