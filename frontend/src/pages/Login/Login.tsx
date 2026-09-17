import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import logoUees from "../../assets/logo-uees.png";
import { useAuth } from "../../hooks/useAuth";
import { getLoginErrorMessage } from "../../services/auth";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Ingresa tu correo o usuario"),
  password: z.string().min(1, "Ingresa tu contraseña"),
  remember: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      remember: false,
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function onSubmit(values: LoginFormValues) {
    setSubmitError(null);
    try {
      await login(values.identifier, values.password, values.remember);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setSubmitError(getLoginErrorMessage(error));
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#eef3f8] px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-10 shadow-[0_20px_50px_rgba(15,40,80,0.08)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={logoUees}
            alt="Universidad Evangélica de El Salvador"
            className="h-28 w-28 object-contain"
          />
          <h1 className="mt-4 text-2xl font-semibold text-slate-800">
            Iniciar Sesión
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ingresa tu correo o usuario y contraseña para entrar al panel
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="block text-left text-sm font-medium text-slate-600">
            Correo electrónico
            <input
              type="text"
              autoComplete="username"
              placeholder="Ingresa tu correo o usuario"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
              {...register("identifier")}
            />
            {errors.identifier ? (
              <span className="mt-1 block text-xs text-red-600">
                {errors.identifier.message}
              </span>
            ) : null}
          </label>

          <label className="block text-left text-sm font-medium text-slate-600">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
              {...register("password")}
            />
            {errors.password ? (
              <span className="mt-1 block text-xs text-red-600">
                {errors.password.message}
              </span>
            ) : null}
          </label>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-500">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-teal-500"
                {...register("remember")}
              />
              Recuérdame
            </label>
            <span className="cursor-not-allowed text-slate-400">
              ¿Olvidaste tu contraseña?
            </span>
          </div>

          {submitError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {submitError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#2ad4c5] py-2.5 text-sm font-semibold text-white transition hover:bg-[#24c4b6] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>

        <div className="mt-6 space-y-3 text-center">
          <p className="text-xs text-slate-400">
            El acceso lo crea administración o soporte. No hay registro público.
          </p>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 py-2.5 text-sm font-medium text-slate-500"
          >
            <GoogleIcon />
            Ingresar por Google
          </button>
        </div>

        <p className="mt-8 text-center text-[11px] text-slate-400">
          2026 © Sistema FOUEES — Facultad de Odontología UEES
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9Z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7 12.9 19.5C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.97 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9Z"
      />
    </svg>
  );
}
