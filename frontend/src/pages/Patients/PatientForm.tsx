import { zodResolver } from "@hookform/resolvers/zod";
import {
  Camera,
  CircleCheckBig,
  Clock3,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { can } from "../../acl/can";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { useAuth } from "../../hooks/useAuth";
import { primaryActionClass, secondaryActionClass } from "../../lib/actions";
import {
  CASE_STATUS_LABELS,
  CLINICAL_AREA_LABELS,
  CLINICAL_AREAS,
  EMERGENCY_RELATIONSHIP_LABELS,
  EMERGENCY_RELATIONSHIPS,
  createPatient,
  getPatient,
  getPatientMutationError,
  patientFullName,
  patientInitials,
  updatePatient,
  type CaseStatus,
  type Patient,
  type PatientFieldName,
  type PatientWritePayload,
} from "../../services/patients";

const AREA_NONE = "sin-area";
const RELATIONSHIP_NONE = "sin-parentesco";
const DUI_PATTERN = /^\d{8}-\d$/;
const PASSPORT_PATTERN = /^[A-Za-z][A-Za-z0-9-]{4,29}$/;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const cardClass =
  "rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,40,80,0.06)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:p-6";
const inputClass =
  "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-brand/20 dark:disabled:bg-slate-800/70 dark:disabled:text-slate-400";
const selectClass =
  "mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-none outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800";
const selectMenuClass =
  "rounded-xl border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const STATUS_ICONS: Record<CaseStatus, LucideIcon> = {
  pendiente: Clock3,
  en_proceso: UserCheck,
  finalizado: CircleCheckBig,
};

const patientFormSchema = z.object({
  first_name: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  last_name: z.string().trim().min(1, "El apellido es obligatorio").max(100),
  dui: z
    .string()
    .trim()
    .min(1, "El DUI es obligatorio")
    .refine(
      (value) => DUI_PATTERN.test(value) || PASSPORT_PATTERN.test(value),
      "Usa el formato 00000000-0 o un pasaporte de al menos 5 caracteres",
    ),
  date_of_birth: z
    .string()
    .refine(
      (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Fecha no válida",
    )
    .refine((value) => {
      if (value === "") {
        return true;
      }
      const [year, month, day] = value.split("-").map(Number);
      const birth = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return birth <= today;
    }, "La fecha de nacimiento no puede ser futura"),
  carnet: z.string().trim().max(30, "El carnet no puede superar 30 caracteres"),
  phone_number: z.string().trim().max(20, "El teléfono no puede superar 20 caracteres"),
  email: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Correo no válido",
    ),
  address: z.string().trim().max(255, "La dirección no puede superar 255 caracteres"),
  emergency_contact_name: z
    .string()
    .trim()
    .max(150, "El contacto no puede superar 150 caracteres"),
  emergency_contact_phone: z
    .string()
    .trim()
    .max(20, "El teléfono de emergencia no puede superar 20 caracteres"),
  emergency_contact_relationship: z.union([
    z.literal(""),
    z.enum(["madre", "padre", "hermano_a", "conyuge", "hijo_a", "otro"]),
  ]),
  clinical_area: z.union([
    z.literal(""),
    z.enum([
      "operatoria",
      "endodoncia",
      "periodoncia",
      "cirugia",
      "protesis",
      "odontopediatria",
      "ortodoncia",
    ]),
  ]),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;

const EMPTY_VALUES: PatientFormValues = {
  first_name: "",
  last_name: "",
  dui: "",
  date_of_birth: "",
  carnet: "",
  phone_number: "",
  email: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
  clinical_area: "",
};

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; patient: Patient };

export function PatientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const patientId = Number(id);
  const isEditing = Boolean(id);

  const [loadState, setLoadState] = useState<LoadState>(
    isEditing ? { status: "loading" } : { status: "idle" },
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    if (!Number.isInteger(patientId) || patientId < 1) {
      setLoadState({ status: "error", message: "Paciente no válido." });
      return;
    }

    let cancelled = false;
    setLoadState({ status: "loading" });
    getPatient(patientId)
      .then((patient) => {
        if (cancelled) {
          return;
        }
        reset(toFormValues(patient));
        setPhotoFile(null);
        setPhotoError(null);
        setLoadState({ status: "ready", patient });
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState({
            status: "error",
            message: "No se pudo cargar la ficha de este paciente.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isEditing, patientId, reset]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const loadedPatient =
    loadState.status === "ready" ? loadState.patient : null;
  const assignedLocked =
    user?.role === "recepcion" &&
    loadedPatient?.has_active_assignment === true;
  const canWrite =
    !assignedLocked &&
    (isEditing ? can(user, "patients.edit") : can(user, "patients.create"));
  const displayPhoto = photoPreview ?? loadedPatient?.photo ?? null;

  function handlePhotoChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setPhotoError("La foto debe ser JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("La foto no puede superar 2 MB.");
      return;
    }
    setPhotoError(null);
    setPhotoFile(file);
  }

  async function onSubmit(values: PatientFormValues) {
    if (!canWrite) {
      return;
    }
    const payload = toPayload(values);
    try {
      if (isEditing) {
        const updated = await updatePatient(patientId, payload, photoFile);
        reset(toFormValues(updated));
        setPhotoFile(null);
        setLoadState({ status: "ready", patient: updated });
        toast.success(`Se actualizó a ${patientFullName(updated)}.`);
      } else {
        const created = await createPatient(payload, photoFile);
        toast.success(`Se registró a ${patientFullName(created)}.`);
      }
      navigate("/patients");
    } catch (error) {
      const result = getPatientMutationError(error);
      if (result.fields.photo) {
        setPhotoError(result.fields.photo);
      }
      const fieldEntries = Object.entries(result.fields).filter(
        (entry): entry is [Exclude<PatientFieldName, "photo">, string] =>
          entry[0] !== "photo",
      );
      if (fieldEntries.length === 0 && !result.fields.photo) {
        toast.error(result.message);
        return;
      }
      for (const [field, message] of fieldEntries) {
        setError(field, { type: "server", message });
      }
    }
  }

  if (loadState.status === "loading") {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500">
        Cargando ficha del paciente...
      </p>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {loadState.message}
        </p>
        <Link
          to="/patients"
          className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
        >
          ← Volver al directorio
        </Link>
      </div>
    );
  }

  const status = loadedPatient?.case_status ?? "pendiente";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/patients"
          className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
        >
          ← Volver al directorio
        </Link>
        <FormActions
          status={status}
          canWrite={canWrite}
          isEditing={isEditing}
          isSubmitting={isSubmitting}
        />
      </div>

      {assignedLocked ? (
        <p
          className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          Este paciente ya está asignado. Recepción no puede editar la ficha;
          el seguimiento lo llevan estudiante y docente.
        </p>
      ) : null}

      <form
        id="patient-form"
        className="space-y-4"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <section className={cardClass}>
          <SectionHeading
            title="Datos personales"
            description="Identificación de recepción. El expediente clínico se carga después de asignar."
          />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex shrink-0 flex-col items-center lg:w-36">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={!canWrite}
                onChange={(event) => handlePhotoChange(event.target.files)}
              />
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => photoInputRef.current?.click()}
                className="relative flex size-28 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-teal-950/60 dark:text-teal-300 dark:hover:bg-teal-950"
                aria-label="Subir foto del paciente"
              >
                {displayPhoto ? (
                  <img
                    src={displayPhoto}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-semibold">
                    {loadedPatient ? patientInitials(loadedPatient) : "NP"}
                  </span>
                )}
                {canWrite ? (
                  <span className="absolute right-1 bottom-1 flex size-8 items-center justify-center rounded-full bg-brand text-white shadow-sm">
                    <Camera className="size-3.5" aria-hidden="true" />
                  </span>
                ) : null}
              </button>
              {photoError ? (
                <p className="mt-2 max-w-36 text-center text-xs text-red-600 dark:text-red-400">
                  {photoError}
                </p>
              ) : (
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  JPG, PNG o WebP · 2 MB
                </p>
              )}
            </div>

            <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-2">
              <Field
                label="Nombres"
                error={errors.first_name?.message}
                required
              >
                <input
                  autoComplete="given-name"
                  disabled={!canWrite}
                  className={inputClass}
                  {...register("first_name")}
                />
              </Field>
              <Field
                label="Apellidos"
                error={errors.last_name?.message}
                required
              >
                <input
                  autoComplete="family-name"
                  disabled={!canWrite}
                  className={inputClass}
                  {...register("last_name")}
                />
              </Field>
              <Field
                label="DUI o pasaporte"
                error={errors.dui?.message}
                required
              >
                <Controller
                  name="dui"
                  control={control}
                  render={({ field }) => (
                    <input
                      autoComplete="off"
                      disabled={!canWrite}
                      placeholder="00000000-0"
                      maxLength={30}
                      className={inputClass}
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={(event) =>
                        field.onChange(formatDocumentId(event.target.value))
                      }
                    />
                  )}
                />
              </Field>
              <Field label="Carnet" error={errors.carnet?.message}>
                <input
                  autoComplete="off"
                  disabled={!canWrite}
                  placeholder="Expediente interno"
                  className={inputClass}
                  {...register("carnet")}
                />
              </Field>
              <Field
                label="Fecha de nacimiento"
                error={errors.date_of_birth?.message}
              >
                <input
                  type="date"
                  disabled={!canWrite}
                  className={inputClass}
                  {...register("date_of_birth")}
                />
              </Field>
              <Field
                label="Área clínica"
                error={errors.clinical_area?.message}
              >
                <Controller
                  name="clinical_area"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value === "" ? AREA_NONE : field.value}
                      onValueChange={(value) =>
                        field.onChange(value === AREA_NONE ? "" : value)
                      }
                      disabled={!canWrite}
                    >
                      <SelectTrigger className={selectClass}>
                        <SelectValue placeholder="Sin área" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        align="start"
                        className={selectMenuClass}
                      >
                        <SelectItem value={AREA_NONE}>Sin área</SelectItem>
                        {CLINICAL_AREAS.map((area) => (
                          <SelectItem key={area} value={area}>
                            {CLINICAL_AREA_LABELS[area]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className={cardClass}>
          <SectionHeading
            title="Contacto"
            description="Teléfono y correo para localizar al paciente."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Teléfono" error={errors.phone_number?.message}>
              <input
                type="tel"
                autoComplete="tel"
                disabled={!canWrite}
                placeholder="7777-7777"
                className={inputClass}
                {...register("phone_number")}
              />
            </Field>
            <Field label="Correo" error={errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                disabled={!canWrite}
                placeholder="paciente@correo.com"
                className={inputClass}
                {...register("email")}
              />
            </Field>
            <Field
              label="Dirección"
              error={errors.address?.message}
              className="md:col-span-2"
            >
              <input
                autoComplete="street-address"
                disabled={!canWrite}
                placeholder="Municipio, departamento"
                className={inputClass}
                {...register("address")}
              />
            </Field>
          </div>
        </section>

        <section className={cardClass}>
          <SectionHeading
            title="Contacto de emergencia"
            description="Persona a quien llamar si no se localiza al paciente."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Nombre"
              error={errors.emergency_contact_name?.message}
            >
              <input
                autoComplete="off"
                disabled={!canWrite}
                className={inputClass}
                {...register("emergency_contact_name")}
              />
            </Field>
            <Field
              label="Teléfono"
              error={errors.emergency_contact_phone?.message}
            >
              <input
                type="tel"
                autoComplete="tel"
                disabled={!canWrite}
                placeholder="7777-7777"
                className={inputClass}
                {...register("emergency_contact_phone")}
              />
            </Field>
            <Field
              label="Parentesco"
              error={errors.emergency_contact_relationship?.message}
            >
              <Controller
                name="emergency_contact_relationship"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value === "" ? RELATIONSHIP_NONE : field.value}
                    onValueChange={(value) =>
                      field.onChange(value === RELATIONSHIP_NONE ? "" : value)
                    }
                    disabled={!canWrite}
                  >
                    <SelectTrigger className={selectClass}>
                      <SelectValue placeholder="Sin parentesco" />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className={selectMenuClass}
                    >
                      <SelectItem value={RELATIONSHIP_NONE}>
                        Sin parentesco
                      </SelectItem>
                      {EMERGENCY_RELATIONSHIPS.map((relationship) => (
                        <SelectItem key={relationship} value={relationship}>
                          {EMERGENCY_RELATIONSHIP_LABELS[relationship]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <FormActions
            status={status}
            canWrite={canWrite}
            isEditing={isEditing}
            isSubmitting={isSubmitting}
            hideStatus
          />
        </div>
      </form>
    </div>
  );
}

function FormActions({
  status,
  canWrite,
  isEditing,
  isSubmitting,
  hideStatus = false,
}: {
  status: CaseStatus;
  canWrite: boolean;
  isEditing: boolean;
  isSubmitting: boolean;
  hideStatus?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hideStatus ? null : <StatusPill status={status} />}
      <Link to="/patients" className={secondaryActionClass}>
        Cancelar
      </Link>
      {canWrite ? (
        <button
          type="submit"
          form="patient-form"
          disabled={isSubmitting}
          className={primaryActionClass}
        >
          {isEditing ? null : <UserPlus className="size-4" />}
          {submitLabel(isEditing, isSubmitting)}
        </button>
      ) : null}
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function StatusPill({ status }: { status: CaseStatus }) {
  const Icon = STATUS_ICONS[status];
  const styles: Record<CaseStatus, string> = {
    pendiente:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    en_proceso: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    finalizado: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {CASE_STATUS_LABELS[status]}
    </span>
  );
}

function Field({
  label,
  error,
  required = false,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-sm font-medium text-slate-600 dark:text-slate-300 ${className}`}>
      {label}
      {required ? (
        <span className="ml-0.5 text-red-500" aria-hidden="true">
          *
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-normal text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function toFormValues(patient: Patient): PatientFormValues {
  return {
    first_name: patient.first_name,
    last_name: patient.last_name,
    dui: formatDocumentId(patient.dui),
    date_of_birth: patient.date_of_birth ?? "",
    carnet: patient.carnet ?? "",
    phone_number: patient.phone_number,
    email: patient.email,
    address: patient.address,
    emergency_contact_name: patient.emergency_contact_name,
    emergency_contact_phone: patient.emergency_contact_phone,
    emergency_contact_relationship: patient.emergency_contact_relationship,
    clinical_area: patient.clinical_area,
  };
}

function toPayload(values: PatientFormValues): PatientWritePayload {
  return {
    first_name: values.first_name,
    last_name: values.last_name,
    dui: values.dui,
    date_of_birth: values.date_of_birth || null,
    carnet: values.carnet,
    phone_number: values.phone_number,
    email: values.email,
    address: values.address,
    emergency_contact_name: values.emergency_contact_name,
    emergency_contact_phone: values.emergency_contact_phone,
    emergency_contact_relationship: values.emergency_contact_relationship,
    clinical_area: values.clinical_area,
  };
}

function formatDocumentId(value: string): string {
  if (/[A-Za-z]/.test(value)) {
    return value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 30);
  }
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 8) {
    return digits;
  }
  return `${digits.slice(0, 8)}-${digits.slice(8)}`;
}

function submitLabel(isEditing: boolean, isSubmitting: boolean): string {
  if (isSubmitting) {
    return isEditing ? "Guardando..." : "Registrando...";
  }
  return isEditing ? "Guardar cambios" : "Registrar paciente";
}
