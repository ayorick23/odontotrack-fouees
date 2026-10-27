import { format } from "date-fns";
import { es } from "date-fns/locale";
import { KeyRound, Lock, LockOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { can } from "../../acl/can";
import { ConfirmDeleteDialog } from "../../components/ConfirmDeleteDialog";
import { Table } from "../../components/Table";
import { ROLE_LABELS, type UserRole } from "../../context/AuthContext";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import {
  deleteUser,
  getUserError,
  listUsers,
  updateUser,
  type UserAccount,
} from "../../services/users";
import { ResetPasswordModal } from "./ResetPasswordModal";
import { UserFormModal } from "./UserFormModal";

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

const filterClass =
  "rounded-full bg-white px-3 py-2 text-sm text-slate-600 shadow-sm outline-none dark:bg-slate-900 dark:text-slate-300 dark:ring-1 dark:ring-white/10";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; users: UserAccount[]; count: number };

type Pending = { kind: "deactivate" | "delete"; user: UserAccount };

// ODO-64: alta, edición y bloqueo de cuentas. Las reglas finas (cuentas
// admin, auto-bloqueo, borrar con historial) las aplica el backend; aquí
// solo se deshabilita lo que de todas formas sería rechazado.
export function UserList() {
  const { user: me } = useAuth();
  const canCreate = can(me, "users.create");
  const canEdit = can(me, "users.edit");
  const canRemove = can(me, "users.delete");
  const isAdmin = me?.role === "admin";

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [isActive, setIsActive] = useState<"true" | "false" | "">("");
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const [formUser, setFormUser] = useState<UserAccount | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [resetUser, setResetUser] = useState<{ id: number; name: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    listUsers({ page, search, role, isActive })
      .then((payload) => {
        if (!cancelled) {
          setState({ status: "ready", users: payload.results, count: payload.count });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", message: "No se pudieron cargar las cuentas." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, role, isActive, reloadToken]);

  function replaceRow(saved: UserAccount) {
    setState((current) =>
      current.status === "ready"
        ? { ...current, users: current.users.map((row) => (row.id === saved.id ? saved : row)) }
        : current,
    );
  }

  async function setActive(target: UserAccount, active: boolean) {
    try {
      const saved = await updateUser(target.id, { is_active: active });
      replaceRow(saved);
      toast.success(
        active ? `Cuenta de ${fullName(saved)} activada.` : `Cuenta de ${fullName(saved)} desactivada.`,
      );
      return true;
    } catch (error) {
      const message = getUserError(error, "No se pudo cambiar el estado de la cuenta.");
      if (active) {
        toast.error(message);
      } else {
        setPendingError(message);
      }
      return false;
    }
  }

  async function confirmPending() {
    if (pending === null) {
      return;
    }
    setPendingBusy(true);
    setPendingError(null);
    if (pending.kind === "deactivate") {
      if (await setActive(pending.user, false)) {
        setPending(null);
      }
      setPendingBusy(false);
      return;
    }
    try {
      await deleteUser(pending.user.id);
      toast.warning(`Se eliminó la cuenta de ${fullName(pending.user)}.`);
      setPending(null);
      setReloadToken((token) => token + 1);
    } catch (error) {
      setPendingError(getUserError(error, "No se pudo eliminar la cuenta."));
    } finally {
      setPendingBusy(false);
    }
  }

  const columns = [
      {
        header: "Nombre",
        render: (row: UserAccount) => (
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100">{fullName(row)}</p>
            <p className="text-xs text-slate-400">{row.username}</p>
          </div>
        ),
      },
      { header: "Correo", render: (row: UserAccount) => row.email || "—" },
      { header: "Rol", render: (row: UserAccount) => ROLE_LABELS[row.role] ?? row.role },
      { header: "Estado", render: (row: UserAccount) => <StatusBadge active={row.is_active} /> },
      {
        header: "Último acceso",
        render: (row: UserAccount) =>
          row.last_login ? format(new Date(row.last_login), "d MMM yyyy", { locale: es }) : "Nunca",
      },
      {
        header: "Acciones",
        align: "right" as const,
        render: (row: UserAccount) => {
          const isSelf = row.id === me?.id;
          const lockedAdmin = row.role === "admin" && !isAdmin;
          const adminHint = "Solo un administrador gestiona cuentas de administrador";
          return (
            <div className="inline-flex items-center justify-end gap-0.5">
              {canEdit ? (
                <RowAction
                  label={lockedAdmin ? adminHint : "Editar"}
                  disabled={lockedAdmin}
                  onClick={() => {
                    setFormUser(row);
                    setFormOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                </RowAction>
              ) : null}
              {canEdit ? (
                <RowAction
                  label={lockedAdmin ? adminHint : "Restablecer contraseña"}
                  disabled={lockedAdmin}
                  onClick={() => setResetUser({ id: row.id, name: fullName(row) })}
                >
                  <KeyRound className="size-4" />
                </RowAction>
              ) : null}
              {canEdit ? (
                <RowAction
                  label={
                    lockedAdmin
                      ? adminHint
                      : isSelf
                        ? "No puedes desactivar tu propia cuenta"
                        : row.is_active
                          ? "Desactivar"
                          : "Activar"
                  }
                  disabled={lockedAdmin || isSelf}
                  onClick={() => {
                    if (row.is_active) {
                      setPendingError(null);
                      setPending({ kind: "deactivate", user: row });
                    } else {
                      void setActive(row, true);
                    }
                  }}
                >
                  {row.is_active ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                </RowAction>
              ) : null}
              {canRemove ? (
                <RowAction
                  label={
                    lockedAdmin ? adminHint : isSelf ? "No puedes eliminar tu propia cuenta" : "Eliminar"
                  }
                  disabled={lockedAdmin || isSelf}
                  danger
                  onClick={() => {
                    setPendingError(null);
                    setPending({ kind: "delete", user: row });
                  }}
                >
                  <Trash2 className="size-4" />
                </RowAction>
              ) : null}
            </div>
          );
        },
      },
  ];

  const pageCount = state.status === "ready" ? Math.max(Math.ceil(state.count / PAGE_SIZE), 1) : 1;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Cuentas</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`flex items-center gap-2 ${filterClass}`}>
            <Search className="size-4 shrink-0" />
            <span className="sr-only">Buscar cuenta</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nombre, usuario o correo"
              className="w-48 bg-transparent outline-none placeholder:text-slate-400"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por rol</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value as UserRole | "");
                setPage(1);
              }}
              className={filterClass}
            >
              <option value="">Todos los roles</option>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por estado</span>
            <select
              value={isActive}
              onChange={(event) => {
                setIsActive(event.target.value as "true" | "false" | "");
                setPage(1);
              }}
              className={filterClass}
            >
              <option value="">Activas y desactivadas</option>
              <option value="true">Solo activas</option>
              <option value="false">Solo desactivadas</option>
            </select>
          </label>
          {canCreate ? (
            <button
              type="button"
              onClick={() => {
                setFormUser(null);
                setFormOpen(true);
              }}
              className={primaryActionClass}
            >
              <Plus className="size-4" />
              Nueva cuenta
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-5">
        {state.status === "loading" ? (
          <p className="px-2 py-10 text-center text-sm text-slate-400">Cargando cuentas...</p>
        ) : null}

        {state.status === "error" ? (
          <div className="px-2 py-8 text-center">
            <p className="text-sm text-red-700 dark:text-red-400" role="alert">
              {state.message}
            </p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className={`${primaryActionClass} mt-4`}
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {state.status === "ready" ? (
          <>
            <Table
              caption="Cuentas del sistema"
              columns={columns}
              rows={state.users}
              getRowKey={(row) => row.id}
              emptyMessage={
                search || role || isActive
                  ? "Ninguna cuenta coincide con los filtros."
                  : "Aún no hay cuentas registradas."
              }
            />
            {state.count > PAGE_SIZE ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 px-1 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                <p>
                  Página {page} de {pageCount} · {state.count} cuentas
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className={secondaryActionClass}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={page >= pageCount}
                    onClick={() => setPage(page + 1)}
                    className={secondaryActionClass}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <UserFormModal
        isOpen={formOpen}
        user={formUser}
        canAssignAdmin={isAdmin}
        isSelf={formUser !== null && formUser.id === me?.id}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, created) => {
          setFormOpen(false);
          if (created) {
            toast.success(`Cuenta de ${fullName(saved)} creada.`);
            setReloadToken((token) => token + 1);
          } else {
            toast.success("Cambios guardados.");
            replaceRow(saved);
          }
        }}
      />

      <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />

      <ConfirmDeleteDialog
        open={pending !== null}
        title={
          pending?.kind === "delete" ? "¿Eliminar esta cuenta?" : "¿Desactivar esta cuenta?"
        }
        description={
          pending === null
            ? undefined
            : pending.kind === "delete"
              ? `Se eliminará la cuenta de ${fullName(pending.user)}. Solo es posible si no tiene historial clínico; si lo tiene, desactívala.`
              : `${fullName(pending.user)} no podrá iniciar sesión hasta que se vuelva a activar. Su historial se conserva.`
        }
        error={pendingError}
        busy={pendingBusy}
        confirmLabel={pending?.kind === "delete" ? "Eliminar" : "Desactivar"}
        busyLabel={pending?.kind === "delete" ? "Eliminando..." : "Desactivando..."}
        onCancel={() => {
          setPending(null);
          setPendingError(null);
        }}
        onConfirm={() => void confirmPending()}
      />
    </section>
  );
}

function fullName(user: UserAccount): string {
  return `${user.first_name} ${user.last_name}`.trim() || user.username;
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
      Activa
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      Desactivada
    </span>
  );
}

function RowAction({
  label,
  disabled = false,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const tone = disabled
    ? "cursor-not-allowed text-slate-300 opacity-40 dark:text-slate-600"
    : danger
      ? "text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/40"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex size-8 items-center justify-center rounded-lg transition ${tone}`}
    >
      {children}
    </button>
  );
}
