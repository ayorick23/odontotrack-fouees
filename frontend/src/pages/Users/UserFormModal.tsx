import { useEffect, useState, type FormEvent } from "react";

import { FormField } from "../../components/FormField";
import { Modal } from "../../components/Modal";
import { ROLE_LABELS, type UserRole } from "../../context/AuthContext";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import { fieldBorder, fieldInputClass } from "../../lib/forms";
import {
  createUser,
  getUserError,
  getUserFieldErrors,
  updateUser,
  type FieldErrors,
  type UserAccount,
} from "../../services/users";

const ROLE_ORDER: UserRole[] = ["estudiante", "docente", "recepcion", "soporte", "admin"];

type FormValues = {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  role: UserRole;
  password: string;
};

const EMPTY: FormValues = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  role: "estudiante",
  password: "",
};

// Alta (user = null) o edición. La contraseña solo se pide al crear; para
// cambiarla después está "Restablecer contraseña".
export function UserFormModal({
  isOpen,
  user,
  canAssignAdmin,
  isSelf,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  user: UserAccount | null;
  canAssignAdmin: boolean;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (user: UserAccount, created: boolean) => void;
}) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = user !== null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setValues(
      user
        ? {
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            email: user.email,
            role: user.role,
            password: "",
          }
        : EMPTY,
    );
    setErrors({});
    setFormError(null);
    setSaving(false);
  }, [isOpen, user]);

  // Soporte no asigna admin (el backend lo rechaza igual); se muestra solo
  // si la cuenta ya lo es, para no dejar el select vacío.
  const roleOptions = ROLE_ORDER.filter(
    (role) => canAssignAdmin || role !== "admin" || values.role === "admin",
  );

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    for (const field of ["first_name", "last_name", "username", "email"] as const) {
      if (!values[field].trim()) {
        found[field] = "Este campo es obligatorio.";
      }
    }
    if (!isEdit && !values.password) {
      found.password = "Este campo es obligatorio.";
    }
    return found;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      username: values.username.trim(),
      email: values.email.trim(),
      role: values.role,
    };
    try {
      const saved = isEdit
        ? await updateUser(user.id, payload)
        : await createUser({ ...payload, password: values.password });
      onSaved(saved, !isEdit);
    } catch (error) {
      // Errores de un campo del formulario van bajo el campo; el resto
      // (permiso, detail) arriba de los botones.
      const fieldErrors = getUserFieldErrors(error);
      if (Object.keys(fieldErrors).some((key) => key in EMPTY)) {
        setErrors(fieldErrors);
      } else {
        setFormError(getUserError(error, "No se pudo guardar la cuenta."));
      }
    } finally {
      setSaving(false);
    }
  }

  function inputProps(field: keyof FormValues) {
    return {
      value: values[field],
      onChange: (event: { target: { value: string } }) => update(field, event.target.value),
      "aria-invalid": errors[field] ? true : undefined,
      className: `${fieldInputClass} ${fieldBorder(Boolean(errors[field]))}`,
    };
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? "Editar cuenta" : "Nueva cuenta"}>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Nombres" error={errors.first_name}>
            <input {...inputProps("first_name")} autoFocus />
          </FormField>
          <FormField label="Apellidos" error={errors.last_name}>
            <input {...inputProps("last_name")} />
          </FormField>
        </div>
        <FormField label="Usuario" error={errors.username}>
          <input {...inputProps("username")} autoComplete="off" />
        </FormField>
        <FormField label="Correo" error={errors.email}>
          <input {...inputProps("email")} type="email" autoComplete="off" />
        </FormField>
        <FormField
          label="Rol"
          error={errors.role}
          hint={isSelf ? "No puedes cambiar tu propio rol." : undefined}
        >
          <select
            value={values.role}
            onChange={(event) => update("role", event.target.value as UserRole)}
            disabled={isSelf}
            className={`${fieldInputClass} ${fieldBorder(Boolean(errors.role))}`}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </FormField>
        {!isEdit ? (
          <FormField
            label="Contraseña inicial"
            error={errors.password}
            hint="Mínimo 8 caracteres, no solo números ni parecida al usuario. Compártela con la persona para que la cambie al entrar."
          >
            <input {...inputProps("password")} type="password" autoComplete="new-password" />
          </FormField>
        ) : null}

        {formError ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={secondaryActionClass}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={primaryActionClass}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear cuenta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
