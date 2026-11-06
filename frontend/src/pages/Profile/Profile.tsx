import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { ChangePasswordModal } from "../../components/ChangePasswordModal";
import { Camera, KeyRound, Lock, Trash2 } from "../../components/icons";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "../../components/listing/styles";
import { Panel } from "../../components/Panel";
import { initials } from "../../components/Sidebar";
import { displayName, ROLE_LABELS, type AuthUser } from "../../context/AuthContext";
import { useAuth } from "../../hooks/useAuth";
import { updateProfile } from "../../services/accounts";
import { getUserError, getUserFieldErrors } from "../../services/users";

// Mismos límites que valida el backend (accounts/profile.py).
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const INPUT =
  "mt-1.5 h-10 w-full rounded-xl border border-transparent bg-slate-100 px-3 text-sm font-normal text-ink outline-none transition placeholder:text-slate-400 hover:bg-slate-200/70 focus:bg-white focus:ring-2 focus:ring-focus dark:bg-white/[.06] dark:text-slate-100 dark:hover:bg-white/[.09] dark:focus:bg-white/[.08]";

type Errors = { first_name?: string; last_name?: string; photo?: string; form?: string };

/**
 * Mi perfil: cada quien cambia su foto, nombre y apellido. Correo, usuario
 * y rol se muestran con candado: los gestiona un admin desde Usuarios.
 */
export function Profile() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }
  // key: si el usuario cambia (otra sesión), el formulario arranca de cero.
  return <ProfileForm key={user.id} user={user} />;
}

function ProfileForm({ user }: { user: AuthUser }) {
  const { refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  // undefined = sin cambios; File = nueva; null = quitar la actual.
  const [photo, setPhoto] = useState<File | null | undefined>(undefined);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Vista previa local de la foto elegida; se libera al cambiarla o al salir.
  const preview = useMemo(
    () => (photo instanceof File ? URL.createObjectURL(photo) : null),
    [photo],
  );
  useEffect(
    () => () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    },
    [preview],
  );

  const shownPhoto = photo === null ? null : (preview ?? user.photo ?? null);
  const dirty =
    firstName.trim() !== user.first_name ||
    lastName.trim() !== user.last_name ||
    photo !== undefined;

  function pickPhoto(files: FileList | null) {
    const file = files?.[0];
    if (fileRef.current) {
      fileRef.current.value = ""; // permite volver a elegir el mismo archivo
    }
    if (!file) {
      return;
    }
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setErrors((current) => ({ ...current, photo: "La foto debe ser JPG, PNG o WebP." }));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErrors((current) => ({ ...current, photo: "La foto no puede superar 2 MB." }));
      return;
    }
    setErrors((current) => ({ ...current, photo: undefined }));
    setPhoto(file);
  }

  function reset() {
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setPhoto(undefined);
    setErrors({});
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found: Errors = {};
    if (!firstName.trim()) {
      found.first_name = "El nombre es obligatorio.";
    }
    if (!lastName.trim()) {
      found.last_name = "El apellido es obligatorio.";
    }
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      await updateProfile({ first_name: firstName.trim(), last_name: lastName.trim() }, photo);
      // Refresca la sesión: el avatar del menú y del Navbar toman la foto nueva.
      await refreshUser();
      setPhoto(undefined);
      toast.success("Perfil actualizado.");
    } catch (error) {
      const fields = getUserFieldErrors(error);
      if (fields.first_name || fields.last_name || fields.photo) {
        setErrors({ first_name: fields.first_name, last_name: fields.last_name, photo: fields.photo });
      } else {
        setErrors({ form: getUserError(error, "No se pudo guardar el perfil.") });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Panel title="Mi perfil" subtitle="Tu foto y tu nombre se ven en el menú y en los registros del sistema.">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-5">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => pickPhoto(event.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="press relative grid size-24 shrink-0 place-items-center overflow-visible rounded-full bg-lavender text-2xl font-semibold text-ink transition hover:brightness-105"
              aria-label="Cambiar foto de perfil"
            >
              {shownPhoto ? (
                <img src={shownPhoto} alt="" className="size-full rounded-full object-cover" />
              ) : (
                initials(user)
              )}
              <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full bg-action text-on-action shadow-md ring-4 ring-surface">
                <Camera className="size-4" aria-hidden="true" />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-bold tracking-tight text-ink dark:text-white">
                {displayName({ ...user, first_name: firstName.trim(), last_name: lastName.trim() })}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{ROLE_LABELS[user.role]}</p>
              {errors.photo ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
                  {errors.photo}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  JPG, PNG o WebP · hasta 2 MB
                </p>
              )}
              {shownPhoto ? (
                <button
                  type="button"
                  onClick={() => setPhoto(user.photo ? null : undefined)}
                  className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Quitar foto
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <Field label="Nombre" error={errors.first_name}>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                maxLength={150}
                className={INPUT}
                aria-invalid={Boolean(errors.first_name)}
              />
            </Field>
            <Field label="Apellido" error={errors.last_name}>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                maxLength={150}
                className={INPUT}
                aria-invalid={Boolean(errors.last_name)}
              />
            </Field>
            <LockedField label="Correo institucional" value={user.email || "—"} />
            <LockedField label="Usuario" value={user.username} />
          </div>

          {errors.form ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {errors.form}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Lock className="size-3.5" aria-hidden="true" />
              Correo, usuario y rol los cambia un administrador.
            </p>
            <div className="flex gap-2">
              {dirty ? (
                <button type="button" onClick={reset} disabled={saving} className={SECONDARY_BUTTON}>
                  Descartar
                </button>
              ) : null}
              <button type="submit" disabled={!dirty || saving} className={PRIMARY_BUTTON}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </Panel>

      <Panel title="Seguridad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink dark:text-white">Contraseña</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Necesitas tu contraseña actual para cambiarla.
            </p>
          </div>
          <button type="button" onClick={() => setPasswordOpen(true)} className={SECONDARY_BUTTON}>
            <KeyRound className="size-4" aria-hidden="true" />
            Cambiar contraseña
          </button>
        </div>
      </Panel>

      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
      {label}
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-normal text-red-600 dark:text-red-400">{error}</span>
      ) : null}
    </label>
  );
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
      {label}
      <p className="mt-1.5 flex h-10 items-center justify-between gap-2 rounded-xl border border-dashed border-ink/10 px-3 text-sm font-normal text-slate-600 dark:border-white/10 dark:text-slate-300">
        <span className="truncate">{value}</span>
        <Lock className="size-3.5 shrink-0 text-slate-400" aria-label="No editable" />
      </p>
    </div>
  );
}
