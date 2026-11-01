import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Circle, MailCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  carneFromEmail,
  INSTITUTIONAL_DOMAIN,
  normalizeEmail,
  passwordRules,
  registerStudent,
  registrationErrorMessage,
  resendRegistrationCode,
  verifyRegistration,
} from "../../services/registration";
import { AuthField, PRIMARY_BUTTON } from "./AuthField";

const registerSchema = z
  .object({
    first_name: z.string().trim().min(2, "Ingresa tus nombres"),
    last_name: z.string().trim().min(2, "Ingresa tus apellidos"),
    email: z
      .string()
      .trim()
      .min(1, "Ingresa tu correo institucional")
      .refine((value) => carneFromEmail(value) !== null, {
        message: `Usa tu correo institucional: carné de 10 dígitos @${INSTITUTIONAL_DOMAIN}`,
      }),
    password: z.string(),
    confirm: z.string(),
  })
  .superRefine((values, ctx) => {
    if (passwordRules(values.password, values.email).some((rule) => !rule.ok)) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "La contraseña no cumple todos los requisitos",
      });
    }
    if (values.confirm !== values.password) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "Las contraseñas no coinciden" });
    }
  });

type RegisterValues = z.infer<typeof registerSchema>;

type Step = { kind: "form" } | { kind: "verify"; email: string } | { kind: "done" };

export function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "form" });

  return (
    <div className="w-full max-w-sm">
      {step.kind === "form" ? (
        <DataStep onSwitch={onSwitch} onSent={(email) => setStep({ kind: "verify", email })} />
      ) : null}
      {step.kind === "verify" ? (
        <CodeStep email={step.email} onVerified={() => setStep({ kind: "done" })} />
      ) : null}
      {step.kind === "done" ? <DoneStep onSwitch={onSwitch} /> : null}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p
      role="alert"
      className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      {message}
    </p>
  );
}

function DataStep({
  onSwitch,
  onSent,
}: {
  onSwitch: () => void;
  onSent: (email: string) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { first_name: "", last_name: "", email: "", password: "", confirm: "" },
  });
  const [password, email] = useWatch({ control, name: ["password", "email"] });
  const rules = passwordRules(password ?? "", email ?? "");

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    const normalized = normalizeEmail(values.email);
    try {
      await registerStudent({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: normalized,
        password: values.password,
      });
      onSent(normalized);
    } catch (error) {
      setFormError(registrationErrorMessage(error));
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Crea tu cuenta
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Para estudiantes de la Facultad de Odontología, con tu correo institucional.
      </p>

      <form className="mt-6 space-y-3.5" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <AuthField
            label="Nombres"
            autoComplete="given-name"
            error={errors.first_name?.message}
            {...register("first_name")}
          />
          <AuthField
            label="Apellidos"
            autoComplete="family-name"
            error={errors.last_name?.message}
            {...register("last_name")}
          />
        </div>
        <AuthField
          label="Correo institucional"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={`2025010371@${INSTITUTIONAL_DOMAIN}`}
          error={errors.email?.message}
          {...register("email")}
        />
        <AuthField
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          hint={
            <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1" aria-label="Requisitos de la contraseña">
              {rules.map((rule) => (
                <li
                  key={rule.id}
                  className={`flex items-center gap-1.5 ${
                    rule.ok ? "text-teal-700 dark:text-teal-300" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {rule.ok ? (
                    <Check className="size-3.5" aria-label="Cumple" />
                  ) : (
                    <Circle className="size-3" aria-label="Pendiente" />
                  )}
                  {rule.label}
                </li>
              ))}
            </ul>
          }
          {...register("password")}
        />
        <AuthField
          label="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register("confirm")}
        />

        <FormError message={formError} />

        <button type="submit" disabled={isSubmitting} className={`${PRIMARY_BUTTON} mt-1`}>
          {isSubmitting ? "Enviando..." : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        ¿Ya tienes cuenta?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-300"
        >
          Ingresar
        </button>
      </p>
    </>
  );
}

function CodeStep({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setMessage(null);
    try {
      await verifyRegistration(email, code);
      onVerified();
    } catch (error) {
      setMessage(registrationErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setMessage(null);
    try {
      await resendRegistrationCode(email);
      setMessage("Te enviamos un código nuevo.");
    } catch (error) {
      setMessage(registrationErrorMessage(error));
    }
  }

  return (
    <>
      <span className="grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
        <MailCheck className="size-6" />
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Revisa tu correo
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Enviamos un código de 6 dígitos a <strong className="text-slate-700 dark:text-slate-200">{email}</strong>.
        Vence en 15 minutos.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void verify();
        }}
      >
        <AuthField
          label="Código de verificación"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="[&_input]:text-center [&_input]:text-lg [&_input]:tracking-[0.5em]"
        />
        <FormError message={message} />
        <button type="submit" disabled={busy || code.length !== 6} className={PRIMARY_BUTTON}>
          {busy ? "Verificando..." : "Verificar correo"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => void resend()}
        className="mt-4 w-full text-center text-sm font-medium text-teal-700 hover:text-teal-800 dark:text-teal-300"
      >
        Reenviar código
      </button>
    </>
  );
}

function DoneStep({ onSwitch }: { onSwitch: () => void }) {
  return (
    <>
      <span className="grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
        <ShieldCheck className="size-6" />
      </span>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Correo verificado
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Tu cuenta quedó pendiente de aprobación. Administración la revisará y
        te avisaremos por correo cuando puedas ingresar.
      </p>
      <button type="button" onClick={onSwitch} className={`${PRIMARY_BUTTON} mt-8`}>
        Volver a ingresar
      </button>
    </>
  );
}
