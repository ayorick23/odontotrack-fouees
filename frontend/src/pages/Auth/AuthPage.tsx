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
// Una sola duración para panel y formularios: todo se mueve al mismo ritmo.
const DURATION = "duration-700";

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
    <div className="relative min-h-svh overflow-hidden bg-surface">
      <div className="absolute right-5 top-5 z-30">
        <ThemeToggle className="glass-chip size-10" />
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

        {/* Panel deslizante: a la derecha al ingresar, a la izquierda al registrarse.
            will-change lo deja en su propia capa con las manchas difuminadas ya
            pintadas; sin eso el navegador las rasteriza al arrancar la animación
            y todo se congela un instante (el "frenazo"). */}
        <div
          className={`absolute inset-y-0 left-0 z-20 hidden w-1/2 p-3 transition-transform will-change-transform ${DURATION} motion-reduce:transition-none md:block ${EASE} ${
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
  // Solo fundido, con la misma duración y curva que el panel: el único que se
  // desplaza es el panel, que tapa al formulario que sale y destapa al que entra.
  return (
    <section
      inert={!active}
      aria-hidden={!active}
      className={`${active ? "flex" : "hidden md:flex"} items-center justify-center px-6 py-10 sm:px-12 md:absolute md:inset-y-0 md:w-1/2 md:overflow-y-auto ${
        side === "left" ? "md:left-0" : "md:right-0"
      } transition-opacity ${DURATION} motion-reduce:transition-none ${EASE} ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
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
      // Claro: base arena con manchas pastel y texto tinta. Oscuro: tinta con
      // manchas intensas y texto blanco.
      className={`relative isolate h-full overflow-hidden rounded-[28px] bg-[#f1f0ea] text-ink dark:bg-ink dark:text-white ${
        compact ? "px-6 py-6" : "p-12 lg:p-16"
      }`}
    >
      {/* Manchas de color difuminadas: el "degradado" del panel. */}
      <div className="absolute -left-[10%] -top-[15%] -z-10 aspect-square w-[70%] rounded-full bg-lime/80 blur-[90px] dark:bg-lime/70" />
      <div className="absolute -right-[15%] top-[30%] -z-10 aspect-square w-[55%] rounded-full bg-[#b9c6ff]/70 blur-[90px] dark:bg-[#8fa3ff]/45" />
      <div className="absolute -bottom-[25%] left-[15%] -z-10 aspect-square w-[75%] rounded-full bg-[#d8c3f0]/75 blur-[100px] dark:bg-[#c9a8f0]/55" />
      <div className="absolute -right-[10%] -bottom-[15%] -z-10 aspect-square w-[45%] rounded-full bg-[#f6c7b4]/60 blur-[90px] dark:bg-[#f6c7b4]/35" />
      <div className="absolute -left-[15%] bottom-[10%] -z-10 aspect-square w-[40%] rounded-full bg-[#bfe2a6]/60 blur-[90px] dark:hidden" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-white/55 via-transparent to-transparent dark:from-ink/70" />

      <div
        className={`flex h-full ${compact ? "items-center gap-4" : "flex-col justify-between"}`}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-14 place-items-center rounded-full bg-white p-2 shadow-lg shadow-ink/15 dark:bg-white/95 dark:shadow-ink/30">
            <img
              src={logoSello}
              alt="Universidad Evangélica de El Salvador"
              className="size-full object-contain"
            />
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">OdontoTrack</p>
            <p className="text-xs text-ink/60 dark:text-white/75">FOUEES</p>
          </div>
        </div>

        {compact ? null : (
          // Se vuelve a montar al cambiar de modo para que el texto entre con fundido.
          <div
            key={mode}
            className="animate-in fade-in slide-in-from-bottom-2 duration-700 motion-reduce:animate-none"
          >
            <p className="text-sm font-medium text-ink/70 dark:text-white/80">
              {PANEL_TEXT[mode].kicker}
            </p>
            <p className="mt-3 max-w-md text-4xl font-bold leading-tight tracking-[-0.03em]">
              {PANEL_TEXT[mode].title}
            </p>
            <p className="mt-6 text-xs text-ink/55 dark:text-white/60">
              2026 © Sistema FOUEES - Facultad de Odontología UEES
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
