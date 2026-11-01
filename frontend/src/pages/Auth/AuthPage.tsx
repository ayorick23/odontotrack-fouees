import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import logoUees from "../../assets/logo-uees.png";
import { ThemeToggle } from "../../components/ThemeToggle";
import { useAuth } from "../../hooks/useAuth";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export type AuthMode = "login" | "registro";

const PANEL_TEXT: Record<AuthMode, { kicker: string; title: string }> = {
  login: {
    kicker: "Facultad de Odontología · UEES",
    title: "Tu práctica clínica, organizada en un solo lugar.",
  },
  registro: {
    kicker: "Banco digital de pacientes",
    title: "Crea tu cuenta con tu correo institucional y empieza a practicar.",
  },
};

// Curva suave de entrada y salida para el deslizamiento del panel.
const EASE = "ease-[cubic-bezier(0.65,0,0.35,1)]";

/**
 * Ingresar y Crear cuenta en una sola tarjeta (rutas /login y /registro).
 * El panel con degradado se desliza al lado opuesto y los formularios
 * cambian con un fundido. Con "reducir movimiento" el cambio es directo.
 * En pantallas chicas el panel queda como encabezado y no se anima.
 */
export function AuthPage() {
  const { isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mode: AuthMode = location.pathname === "/registro" ? "registro" : "login";
  const isLogin = mode === "login";

  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isReady, isAuthenticated, navigate]);

  const switchTo = (next: AuthMode) => navigate(next === "login" ? "/login" : "/registro");

  if (!isReady) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando sesión...</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-slate-100 px-4 py-10 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-5xl overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.25)] md:h-[680px] dark:bg-slate-900 dark:shadow-none">
        {/* Encabezado en móvil (el panel deslizante es solo de escritorio). */}
        <div className="md:hidden">
          <BrandPanel mode={mode} compact />
        </div>

        <FormSlot side="left" active={isLogin}>
          <LoginForm onSwitch={() => switchTo("registro")} />
        </FormSlot>
        <FormSlot side="right" active={!isLogin}>
          <RegisterForm onSwitch={() => switchTo("login")} />
        </FormSlot>

        {/* Panel deslizante: a la derecha al ingresar, a la izquierda al registrarse. */}
        <div
          className={`absolute inset-y-3 left-3 hidden w-[calc(50%-12px)] transition-transform duration-700 motion-reduce:transition-none md:block ${EASE} ${
            isLogin ? "translate-x-full" : "translate-x-0"
          }`}
          aria-hidden="true"
        >
          <BrandPanel mode={mode} />
        </div>
      </div>
    </div>
  );
}

function FormSlot({
  side,
  active,
  children,
}: {
  side: "left" | "right";
  active: boolean;
  children: ReactNode;
}) {
  // El formulario que sale se corre hacia donde va el panel y se desvanece.
  const offset = side === "left" ? "-translate-x-6" : "translate-x-6";
  return (
    <section
      inert={!active}
      aria-hidden={!active}
      className={`${active ? "flex" : "hidden md:flex"} items-center justify-center px-6 py-10 sm:px-12 md:absolute md:inset-y-3 md:w-[calc(50%-12px)] ${
        side === "left" ? "md:left-3" : "md:right-3"
      } transition-[opacity,transform] duration-500 motion-reduce:transition-none ${EASE} ${
        active ? "translate-x-0 opacity-100 delay-200" : `pointer-events-none opacity-0 ${offset}`
      }`}
    >
      {children}
    </section>
  );
}

function BrandPanel({ mode, compact = false }: { mode: AuthMode; compact?: boolean }) {
  return (
    <div
      className={`relative isolate h-full overflow-hidden rounded-[22px] bg-teal-950 text-white ${
        compact ? "px-6 py-6" : "p-10"
      }`}
    >
      {/* Manchas de color difuminadas: el "degradado" del panel. */}
      <div className="absolute -left-24 -top-24 -z-10 size-96 rounded-full bg-teal-400/70 blur-3xl" />
      <div className="absolute -right-20 top-1/3 -z-10 size-80 rounded-full bg-cyan-300/50 blur-3xl" />
      <div className="absolute -bottom-32 left-1/4 -z-10 size-[28rem] rounded-full bg-sky-600/70 blur-3xl" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-teal-950/70 via-transparent to-transparent" />

      <div className={`flex h-full ${compact ? "items-center gap-4" : "flex-col justify-between"}`}>
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-full bg-white/95 p-1.5 shadow-lg shadow-teal-950/30">
            <img src={logoUees} alt="Universidad Evangélica de El Salvador" className="size-full object-contain" />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">OdontoTrack</p>
            <p className="text-xs text-white/75">FOUEES</p>
          </div>
        </div>

        {compact ? null : (
          // Se vuelve a montar al cambiar de modo para que el texto entre con fundido.
          <div key={mode} className="animate-in fade-in slide-in-from-bottom-2 duration-700 motion-reduce:animate-none">
            <p className="text-sm font-medium text-white/80">{PANEL_TEXT[mode].kicker}</p>
            <p className="mt-3 max-w-sm text-3xl font-semibold leading-tight tracking-tight">
              {PANEL_TEXT[mode].title}
            </p>
            <p className="mt-6 text-xs text-white/60">2026 © Sistema FOUEES — Facultad de Odontología UEES</p>
          </div>
        )}
      </div>
    </div>
  );
}
