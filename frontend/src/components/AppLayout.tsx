import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "../hooks/useAuth";
import { canAccessPath, firstAllowedPath } from "./navigation";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { user, isAuthenticated, isReady, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!isReady || (isAuthenticated && user === null)) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">
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
      <div className="flex min-h-svh items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">
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

  // Marco de un solo color (fondo, menú y barra superior, sin bordes);
  // solo el panel de contenido se eleva y tiene su propio scroll.
  return (
    <div className="flex h-svh bg-slate-100 dark:bg-slate-950">
      <Sidebar user={user} onLogout={handleLogout} />
      <div className="flex min-w-0 flex-1 flex-col pb-3 pr-3">
        <Navbar user={user} onLogout={handleLogout} />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto rounded-3xl bg-slate-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-12px_rgba(15,23,42,0.10)] dark:bg-[#0b1220] dark:shadow-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
