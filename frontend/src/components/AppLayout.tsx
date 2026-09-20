import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

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
      <div className="flex min-h-svh items-center justify-center bg-[#eef3f8] dark:bg-slate-950">
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
      <div className="flex min-h-svh items-center justify-center bg-[#eef3f8] dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tu rol no tiene pantallas habilitadas. Pide a administración que revise
          la matriz de permisos.
        </p>
      </div>
    );
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-svh gap-3 bg-[#eef3f8] p-3 dark:bg-slate-950">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Navbar user={user} onLogout={handleLogout} />
        <main className="min-w-0 flex-1 px-2 pb-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
