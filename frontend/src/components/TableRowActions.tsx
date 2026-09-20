import { Eye, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type TableRowActionsProps = {
  viewTo?: string;
  editTo?: string;
  onDelete?: () => void;
};

const baseClass =
  "inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800";

export function TableRowActions({
  viewTo,
  editTo,
  onDelete,
}: TableRowActionsProps) {
  if (!viewTo && !editTo && !onDelete) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <div className="inline-flex items-center justify-end gap-0.5">
      {viewTo ? (
        <ActionLink to={viewTo} label="Ver">
          <Eye className="size-4" />
        </ActionLink>
      ) : null}
      {editTo ? (
        <ActionLink to={editTo} label="Editar">
          <Pencil className="size-4" />
        </ActionLink>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          title="Borrar"
          aria-label="Borrar"
          onClick={onDelete}
          className={`${baseClass} hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400`}
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function ConfirmDeleteBar({
  message,
  error,
  busy,
  onCancel,
  onConfirm,
}: {
  message: string;
  error?: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 dark:border-red-900/40 dark:bg-red-950/30">
      <p className="text-sm text-red-800 dark:text-red-200">{message}</p>
      {error ? (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {busy ? "Eliminando..." : "Borrar"}
        </button>
      </div>
    </div>
  );
}

function ActionLink({
  to,
  label,
  children,
}: {
  to: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      title={label}
      aria-label={label}
      className={`${baseClass} hover:text-teal-600 dark:hover:text-teal-400`}
    >
      {children}
    </Link>
  );
}
