import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import { fieldBorder, fieldInputClass } from "../../lib/forms";
import { getUserError, getUserFieldErrors, resetUserPassword } from "../../services/users";

// Para cuando alguien olvida su contraseña: quien tiene users.edit le
// pone una nueva y se la comparte para que la cambie al entrar.
export function ResetPasswordModal({
  user,
  onClose,
}: {
  user: { id: number; name: string } | null;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPassword("");
    setConfirm("");
    setError(null);
    setConfirmError(null);
    setSaving(false);
  }, [user]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (user === null) {
      return;
    }
    if (!password) {
      setError("Este campo es obligatorio.");
      return;
    }
    if (password !== confirm) {
      setConfirmError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await resetUserPassword(user.id, password);
      toast.success(`Contraseña de ${user.name} restablecida.`);
      onClose();
    } catch (requestError) {
      setError(
        getUserFieldErrors(requestError).password ??
          getUserError(requestError, "No se pudo restablecer la contraseña."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={user !== null} onClose={onClose} title="Restablecer contraseña">
      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nueva contraseña para <strong>{user?.name}</strong>. Compártela con la persona para
          que la cambie al entrar.
        </p>
        <FormField label="Nueva contraseña" error={error ?? undefined}>
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            autoFocus
            autoComplete="new-password"
            aria-invalid={error ? true : undefined}
            className={`${fieldInputClass} ${fieldBorder(Boolean(error))}`}
          />
        </FormField>
        <FormField label="Confirmar contraseña" error={confirmError ?? undefined}>
          <input
            type="password"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              setConfirmError(null);
            }}
            autoComplete="new-password"
            aria-invalid={confirmError ? true : undefined}
            className={`${fieldInputClass} ${fieldBorder(Boolean(confirmError))}`}
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={secondaryActionClass}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryActionClass}>
            {saving ? "Guardando..." : "Restablecer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
