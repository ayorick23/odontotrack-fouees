import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import logoUees from "../../assets/logo-uees.png";
import { ThemeToggle } from "../../components/ThemeToggle";
import { useAuth } from "../../hooks/useAuth";
import { getLoginErrorMessage } from "../../services/auth";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Ingresa tu correo o usuario"),
  password: z.string().min(1, "Ingresa tu contraseña"),
  remember: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function Login() {
  const { isAuthenticated, isReady, login } = useAuth();
  const navigate = useNavigate();

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
    if (isReady && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isReady, isAuthenticated, navigate]);

  async function onSubmit(values: LoginFormValues) {
    try {
      await login(values.identifier, values.password, values.remember);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(getLoginErrorMessage(error));
    }
  }

  if (!isReady) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[#eef3f8] dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cargando sesión...
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-[#eef3f8] px-4 py-10 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[420px] rounded-2xl bg-white px-8 py-10 shadow-[0_20px_50px_rgba(15,40,80,0.08)] dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={logoUees}
            alt="Universidad Evangélica de El Salvador"
            className="h-28 w-28 object-contain"
          />
          <h1 className="mt-4 text-2xl font-semibold text-slate-800 dark:text-slate-100">
            Iniciar Sesión
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ingresa tu correo o usuario y contraseña para entrar al panel
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="block text-left text-sm font-medium text-slate-600 dark:text-slate-300">
            Correo electrónico
            <input
              type="text"
              autoComplete="username"
              placeholder="Ingresa tu correo o usuario"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:focus:ring-teal-900/40"
              {...register("identifier")}
            />
            {errors.identifier ? (
              <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                {errors.identifier.message}
              </span>
            ) : null}
          </label>

          <label className="block text-left text-sm font-medium text-slate-600 dark:text-slate-300">
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:focus:ring-teal-900/40"
              {...register("password")}
            />
            {errors.password ? (
              <span className="mt-1 block text-xs text-red-600 dark:text-red-400">
                {errors.password.message}
              </span>
            ) : null}
          </label>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300 text-teal-500 dark:border-slate-600"
                {...register("remember")}
              />
              Recuérdame
            </label>
            <span className="cursor-not-allowed text-slate-400">
              ¿Olvidaste tu contraseña?
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[#2ad4c5] py-2.5 text-sm font-semibold text-white transition hover:bg-[#24c4b6] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          El acceso lo crea administración o soporte. No hay registro público.
        </p>

        <p className="mt-8 text-center text-[11px] text-slate-400">
          2026 © Sistema FOUEES — Facultad de Odontología UEES
        </p>
      </div>
    </div>
  );
}
