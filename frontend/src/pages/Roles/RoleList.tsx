import { Plus, Search, Shield } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { Modal } from "../../components/Modal";
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
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
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
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Roles
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300 dark:ring-1 dark:ring-white/10">
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
              className={primaryActionClass}
            >
              <Plus className="size-4" />
              Nuevo rol
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-5">
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
                : "border-slate-200 focus:border-[#2ad4c5] dark:border-slate-700"
            }`}
          />
        </label>
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
          Descripción
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#2ad4c5] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
