import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import logoSello from "../../assets/logo-uees-sello.png";
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
  const mode: AuthMode =
    location.pathname === "/registro" ? "registro" : "login";
  const isLogin = mode === "login";

  useEffect(() => {
    if (isReady && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isReady, isAuthenticated, navigate]);

  const switchTo = (next: AuthMode) =>
    navigate(next === "login" ? "/login" : "/registro");

  if (!isReady) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cargando sesión...
        </p>
      </div>
    );
  }

  return (
    // Pantalla completa: formulario y panel ocupan media pantalla cada uno;
    // el panel deja un margen leve y tiene esquinas redondeadas.
    <div className="relative min-h-svh overflow-hidden bg-white dark:bg-slate-900">
      <div className="absolute right-5 top-5 z-30">
        <ThemeToggle />
      </div>

      <div className="relative min-h-svh md:h-svh">
        {/* Encabezado en móvil (el panel deslizante es solo de escritorio). */}
        <div className="p-3 md:hidden">
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
          className={`absolute inset-y-0 left-0 z-20 hidden w-1/2 p-3 transition-transform duration-700 motion-reduce:transition-none md:block ${EASE} ${
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
      className={`${active ? "flex" : "hidden md:flex"} items-center justify-center px-6 py-10 sm:px-12 md:absolute md:inset-y-0 md:w-1/2 md:overflow-y-auto ${
        side === "left" ? "md:left-0" : "md:right-0"
      } transition-[opacity,transform] duration-500 motion-reduce:transition-none ${EASE} ${
        active
          ? "translate-x-0 opacity-100 delay-200"
          : `pointer-events-none opacity-0 ${offset}`
      }`}
    >
      {children}
    </section>
  );
}

function BrandPanel({
  mode,
  compact = false,
}: {
  mode: AuthMode;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative isolate h-full overflow-hidden rounded-[28px] bg-teal-950 text-white ${
        compact ? "px-6 py-6" : "p-12 lg:p-16"
      }`}
    >
      {/* Manchas de color difuminadas: el "degradado" del panel. */}
      <div className="absolute -left-[10%] -top-[15%] -z-10 aspect-square w-[70%] rounded-full bg-teal-400/70 blur-[90px]" />
      <div className="absolute -right-[15%] top-[30%] -z-10 aspect-square w-[55%] rounded-full bg-cyan-300/45 blur-[90px]" />
      <div className="absolute -bottom-[25%] left-[15%] -z-10 aspect-square w-[75%] rounded-full bg-sky-600/70 blur-[100px]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-teal-950/70 via-transparent to-transparent" />

      <div
        className={`flex h-full ${compact ? "items-center gap-4" : "flex-col justify-between"}`}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-full bg-white/95 p-2 shadow-lg shadow-teal-950/30">
            <img
              src={logoSello}
              alt="Universidad Evangélica de El Salvador"
              className="size-full object-contain"
            />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">OdontoTrack</p>
            <p className="text-xs text-white/75">FOUEES</p>
          </div>
        </div>

        {compact ? null : (
          // Se vuelve a montar al cambiar de modo para que el texto entre con fundido.
          <div
            key={mode}
            className="animate-in fade-in slide-in-from-bottom-2 duration-700 motion-reduce:animate-none"
          >
            <p className="text-sm font-medium text-white/80">
              {PANEL_TEXT[mode].kicker}
            </p>
            <p className="mt-3 max-w-md text-4xl font-semibold leading-tight tracking-tight">
              {PANEL_TEXT[mode].title}
            </p>
            <p className="mt-6 text-xs text-white/60">
              2026 © Sistema FOUEES - Facultad de Odontología UEES
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
