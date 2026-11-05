import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "../hooks/useAuth";
import { canAccessPath, firstAllowedPath } from "./navigation";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

/** Fondo de la app: manchas de color desenfocadas + grano (index.css). */
export function AppBackground() {
  return (
    <div className="app-scene" aria-hidden="true">
      <div className="app-blob app-blob-1" />
      <div className="app-blob app-blob-2" />
      <div className="app-blob app-blob-3" />
      <div className="app-grain" />
    </div>
  );
}

export function AppLayout() {
  const { user, isAuthenticated, isReady, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isReady || (isAuthenticated && user === null)) {
    return (
      <div className="relative flex min-h-svh items-center justify-center">
        <AppBackground />
        <p className="relative text-sm text-slate-500 dark:text-slate-400">
          Cargando sesión...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user !== null && !canAccessPath(location.pathname, user)) {
    const fallback = firstAllowedPath(user);
    if (fallback && fallback !== location.pathname) {
      return <Navigate to={fallback} replace />;
    }
    return (
      <div className="relative flex min-h-svh items-center justify-center">
        <AppBackground />
        <p className="relative text-sm text-slate-500 dark:text-slate-400">
          Tu rol no tiene pantallas habilitadas. Pide a administración que revise
          la matriz de permisos.
        </p>
      </div>
    );
  }

  function handleLogout() {
    logout();
    toast.info("Sesión cerrada.");
    navigate("/login", { replace: true });
  }

  // Identidad 2026-11: sin marco general. Menú, barra superior y contenido
  // van directo sobre el fondo desenfocado; las tarjetas de cada página son
  // de vidrio (.glass) con bloques sólidos (bg-surface) para el contenido denso.
  return (
    <div className="relative flex h-svh">
      <AppBackground />
      <Sidebar user={user} onLogout={handleLogout} />
      <div className="relative flex min-w-0 flex-1 flex-col pr-5 pb-5 pl-4">
        <Navbar user={user} onLogout={handleLogout} />
        {/* `relative`: lo posicionado en absoluto dentro de las páginas (el
            <select> oculto de Radix, textos sr-only, subrayados de pestañas)
            se ubica respecto a este panel y se desplaza con él. Sin esto
            se ubicaba respecto al documento, lo estiraba por debajo de la
            ventana y aparecía un segundo scroll en la página. */}
        <main className="relative min-h-0 min-w-0 flex-1 overflow-auto p-1">
          {/* key = ruta: al cambiar de sección el contenido se vuelve a
              montar y entra con .anim-page (fundido + subida + enfoque). */}
          <div key={location.pathname} className="anim-page h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
