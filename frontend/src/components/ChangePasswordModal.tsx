import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { primaryActionClass, secondaryActionClass } from "../lib/actions";
import { fieldBorder, fieldInputClass } from "../lib/forms";
import { changeOwnPassword, getUserError, getUserFieldErrors } from "../services/users";
import { FormField } from "./FormField";
import { Modal } from "./Modal";

type Errors = { current?: string; next?: string; confirm?: string; form?: string };

// Cambio de la propia contraseña. Disponible para cualquier rol desde el
// Navbar; el backend no pide permiso ACL para esto.
export function ChangePasswordModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setErrors({});
    setSaving(false);
  }, [isOpen]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found: Errors = {};
    if (!current) {
      found.current = "Este campo es obligatorio.";
    }
    if (!next) {
      found.next = "Este campo es obligatorio.";
    } else if (next !== confirm) {
      found.confirm = "Las contraseñas no coinciden.";
    }
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await changeOwnPassword({ current_password: current, new_password: next });
      toast.success("Contraseña actualizada.");
      onClose();
    } catch (error) {
      const fields = getUserFieldErrors(error);
      if (fields.current_password || fields.new_password) {
        setErrors({ current: fields.current_password, next: fields.new_password });
      } else {
        setErrors({ form: getUserError(error, "No se pudo cambiar la contraseña.") });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cambiar contraseña">
      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
        <FormField label="Contraseña actual" error={errors.current}>
          <input
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoFocus
            autoComplete="current-password"
            aria-invalid={errors.current ? true : undefined}
            className={`${fieldInputClass} ${fieldBorder(Boolean(errors.current))}`}
          />
        </FormField>
        <FormField
          label="Nueva contraseña"
          error={errors.next}
          hint="Mínimo 8 caracteres, no solo números ni parecida a tu usuario."
        >
          <input
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
            aria-invalid={errors.next ? true : undefined}
            className={`${fieldInputClass} ${fieldBorder(Boolean(errors.next))}`}
          />
        </FormField>
        <FormField label="Confirmar nueva contraseña" error={errors.confirm}>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            aria-invalid={errors.confirm ? true : undefined}
            className={`${fieldInputClass} ${fieldBorder(Boolean(errors.confirm))}`}
          />
        </FormField>
        {errors.form ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {errors.form}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={secondaryActionClass}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryActionClass}>
            {saving ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
