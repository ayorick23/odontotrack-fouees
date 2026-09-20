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
  "inline-flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-800";

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
              ? "cursor-not-allowed opacity-40"
              : "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
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
      className={`${baseClass} hover:text-teal-600 dark:hover:text-teal-400`}
    >
      {children}
    </Link>
  );
}
