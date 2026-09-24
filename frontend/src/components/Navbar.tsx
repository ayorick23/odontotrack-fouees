import { Bell, LogOut, Search } from "lucide-react";
import { useLocation } from "react-router-dom";

import {
  displayName,
  ROLE_LABELS,
  type AuthUser,
} from "../context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";

const PAGE_META: Record<string, { title: string; crumb: string }> = {
  "/dashboard": { title: "Panel Administrativo", crumb: "Dashboard › Inicio" },
  "/patients": { title: "Directorio de pacientes", crumb: "Pacientes › Directorio" },
  "/patients/available": {
    title: "Pacientes disponibles",
    crumb: "Pacientes › Disponibles",
  },
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
  "/roles": { title: "Roles y permisos", crumb: "Sistema › Roles" },
  "/catalogs": { title: "Catálogos clínicos", crumb: "Sistema › Catálogos" },
  "/support": { title: "Soporte técnico", crumb: "Dashboard › Soporte" },
};

function pageMeta(pathname: string): { title: string; crumb: string } {
  const exact = PAGE_META[pathname];
  if (exact) {
    return exact;
  }
  if (/^\/patients\/\d+\/edit$/.test(pathname)) {
    return { title: "Editar paciente", crumb: "Pacientes › Editar" };
  }
  if (/^\/patients\/\d+$/.test(pathname)) {
    return { title: "Ficha de paciente", crumb: "Pacientes › Detalle" };
  }
  if (/^\/roles\/\d+\/edit$/.test(pathname)) {
    return { title: "Editar rol", crumb: "Sistema › Roles › Editar" };
  }
  if (/^\/roles\/\d+$/.test(pathname)) {
    return { title: "Ver rol", crumb: "Sistema › Roles › Detalle" };
  }
  return { title: "FOUEES", crumb: "Panel" };
}

export function Navbar({
  user,
  onLogout,
}: {
  user: AuthUser | null;
  onLogout: () => void;
}) {
  const location = useLocation();
  const meta = pageMeta(location.pathname);

  return (
    <header className="flex items-center justify-between rounded-2xl bg-white px-5 py-3 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {meta.title}
        </h1>
        <p className="text-xs text-slate-400">{meta.crumb}</p>
      </div>

      <div className="flex items-center gap-3">
        <label className="hidden items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm text-slate-400 dark:bg-slate-800 md:flex">
          <Search className="size-4" />
          <input
            disabled
            placeholder="¿Buscas algo?"
            className="w-40 bg-transparent outline-none"
          />
        </label>
        <div className="flex items-center">
          <ThemeToggle />
          <button
            type="button"
            disabled
            title="Próximamente"
            className="rounded-full p-2 text-slate-400"
          >
            <Bell className="size-4" />
          </button>
        </div>
        {user ? (
          <p className="hidden text-right text-sm font-medium text-slate-700 sm:block dark:text-slate-200">
            {displayName(user)}
            <span className="block text-xs font-normal text-slate-400">
              {ROLE_LABELS[user.role]}
            </span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <LogOut className="size-4" />
          Salir
        </button>
      </div>
    </header>
  );
}
