import { Bell, LogOut, Search } from "lucide-react";
import { useLocation } from "react-router-dom";

import {
  displayName,
  ROLE_LABELS,
  type AuthUser,
} from "../context/AuthContext";

const PAGE_META: Record<string, { title: string; crumb: string }> = {
  "/dashboard": { title: "Panel Administrativo", crumb: "Dashboard › Inicio" },
  "/patients": { title: "Directorio de pacientes", crumb: "Pacientes › Directorio" },
  "/patients/new": {
    title: "Registro de paciente",
    crumb: "Pacientes › Registro",
  },
  "/assignments": {
    title: "Asignación de paciente",
    crumb: "Pacientes › Asignación",
  },
  "/calendar": { title: "Calendario de citas", crumb: "Dashboard › Calendario" },
  "/supervision": { title: "Supervisión", crumb: "Dashboard › Supervisión" },
  "/students": { title: "Base de estudiantes", crumb: "Dashboard › Estudiantes" },
  "/support": { title: "Soporte técnico", crumb: "Dashboard › Soporte" },
};

export function Navbar({
  user,
  onLogout,
}: {
  user: AuthUser | null;
  onLogout: () => void;
}) {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? {
    title: "FOUEES",
    crumb: "Panel",
  };

  return (
    <header className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">{meta.title}</h1>
        <p className="text-xs text-slate-400">{meta.crumb}</p>
      </div>

      <div className="flex items-center gap-3">
        <label className="hidden items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm text-slate-400 md:flex">
          <Search className="size-4" />
          <input
            disabled
            placeholder="¿Buscas algo?"
            className="w-40 bg-transparent outline-none"
          />
        </label>
        <button
          type="button"
          disabled
          title="Próximamente"
          className="rounded-full p-2 text-slate-400"
        >
          <Bell className="size-4" />
        </button>
        {user ? (
          <p className="hidden text-right text-sm font-medium text-slate-700 sm:block">
            {displayName(user)}
            <span className="block text-xs font-normal text-slate-400">
              {ROLE_LABELS[user.role]}
            </span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <LogOut className="size-4" />
          Salir
        </button>
      </div>
    </header>
  );
}
