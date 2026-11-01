import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "../../hooks/useAuth";
import { getLoginErrorMessage } from "../../services/auth";
import { AuthField, PRIMARY_BUTTON } from "./AuthField";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Ingresa tu correo o usuario"),
  password: z.string().min(1, "Ingresa tu contraseña"),
  remember: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showResetHelp, setShowResetHelp] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", remember: false },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      await login(values.identifier, values.password, values.remember);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(getLoginErrorMessage(error));
    }
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
        Bienvenido de nuevo
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Ingresa con tu correo institucional para continuar.
      </p>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <AuthField
          label="Correo institucional o usuario"
          autoComplete="username"
          placeholder="2025010371@cvirtualuees.edu.sv"
          error={errors.identifier?.message}
          {...register("identifier")}
        />
        <AuthField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          placeholder="Tu contraseña"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300 accent-teal-700 dark:border-slate-600"
              {...register("remember")}
            />
            Recuérdame
          </label>
          <button
            type="button"
            aria-expanded={showResetHelp}
            aria-controls="reset-help"
            onClick={() => setShowResetHelp((open) => !open)}
            className="font-medium text-teal-700 hover:text-teal-800 dark:text-teal-300"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        {showResetHelp ? (
          <p
            id="reset-help"
            className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400"
          >
            Por ahora, pide a administración o soporte que restablezca tu
            contraseña desde Usuarios. Pronto podrás recuperarla por correo.
          </p>
        ) : null}

        <button type="submit" disabled={isSubmitting} className={`${PRIMARY_BUTTON} mt-2`}>
          {isSubmitting ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
        ¿Aún no tienes cuenta?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-300"
        >
          Crear cuenta
        </button>
      </p>
    </div>
  );
}
