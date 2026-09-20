import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmDeleteDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  error?: string | null;
  busy?: boolean;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteDialog({
  open,
  title,
  description = "Esta acción no se puede deshacer.",
  error,
  busy = false,
  confirmLabel = "Eliminar",
  onCancel,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent className="gap-5 rounded-2xl border-0 p-6 shadow-xl sm:max-w-md data-[size=default]:sm:max-w-md">
        <AlertDialogHeader className="place-items-start gap-1.5 text-left sm:text-left">
          <AlertDialogTitle className="text-lg font-semibold tracking-tight">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter className="gap-3 sm:justify-end">
          <AlertDialogCancel
            disabled={busy}
            className="h-10 rounded-xl border-slate-300 px-5 font-medium dark:border-slate-600"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            className="h-10 rounded-xl bg-red-500 px-5 font-medium text-white hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-600"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {busy ? "Eliminando..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
