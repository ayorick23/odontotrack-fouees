import { Eye, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type TableRowActionsProps = {
  viewTo?: string;
  editTo?: string;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteHint?: string;
};

const baseClass =
  "inline-flex size-8 items-center justify-center rounded-lg transition";

export function TableRowActions({
  viewTo,
  editTo,
  onDelete,
  deleteDisabled = false,
  deleteHint,
}: TableRowActionsProps) {
  const showDelete = Boolean(onDelete) || deleteDisabled;

  if (!viewTo && !editTo && !showDelete) {
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
      {showDelete ? (
        <button
          type="button"
          title={deleteDisabled ? (deleteHint ?? "No se puede borrar") : "Borrar"}
          aria-label={deleteDisabled ? (deleteHint ?? "No se puede borrar") : "Borrar"}
          disabled={deleteDisabled}
          onClick={onDelete}
          className={`${baseClass} ${
            deleteDisabled
              ? "cursor-not-allowed text-slate-300 opacity-40 dark:text-slate-600"
              : "text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
          }`}
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
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
      className={`${baseClass} text-slate-500 hover:bg-teal-50 hover:text-teal-700 dark:text-slate-400 dark:hover:bg-teal-950/40 dark:hover:text-teal-300`}
    >
      {children}
    </Link>
  );
}
