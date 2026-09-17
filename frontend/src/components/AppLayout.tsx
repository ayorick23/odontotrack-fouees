import { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { getCurrentUser } from "../services/accounts";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { user, isAuthenticated, setUser, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || user) {
      return;
    }

    let cancelled = false;
    getCurrentUser()
      .then((current) => {
        if (!cancelled) {
          setUser(current);
        }
      })
      .catch(() => {
        if (!cancelled) {
          logout();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, setUser, logout]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
