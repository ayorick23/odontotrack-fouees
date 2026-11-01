import { KeyRound, LogOut, Search } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { can } from "../acl/can";
import {
  displayName,
  ROLE_LABELS,
  type AuthUser,
} from "../context/AuthContext";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { Avatar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

const PAGE_META: Record<string, { title: string; crumb: string }> = {
  "/dashboard": { title: "Panel", crumb: "Dashboard › Inicio" },
  "/patients": { title: "Directorio de pacientes", crumb: "Pacientes › Directorio" },
  "/patients/new": {
    title: "Registro de paciente",
    crumb: "Pacientes › Registro",
  },
  "/assignments": {
    title: "Asignaciones",
    crumb: "Pacientes › Asignaciones",
  },
  "/calendar": { title: "Calendario de citas", crumb: "Dashboard › Calendario" },
  "/supervision": { title: "Supervisión", crumb: "Dashboard › Supervisión" },
  "/students": { title: "Base de estudiantes", crumb: "Dashboard › Estudiantes" },
  "/users": { title: "Usuarios", crumb: "Personas › Usuarios" },
  "/roles": { title: "Roles y permisos", crumb: "Sistema › Roles" },
  "/catalogs": { title: "Catálogos clínicos", crumb: "Sistema › Catálogos" },
  "/support": { title: "Soporte técnico", crumb: "Dashboard › Soporte" },
};

const DASHBOARD_TITLES: Record<AuthUser["role"], string> = {
  admin: "Panel administrativo",
  docente: "Panel docente",
  estudiante: "Mi panel",
  recepcion: "Panel de recepción",
  soporte: "Panel de soporte",
};

function pageMeta(
  pathname: string,
  user: AuthUser | null,
): { title: string; crumb: string } {
  if (pathname === "/dashboard" && user) {
    return { ...PAGE_META[pathname], title: DASHBOARD_TITLES[user.role] };
  }
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
  const meta = pageMeta(location.pathname, user);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  return (
    // Pintada sobre el marco: sin tarjeta, mismo color que el fondo.
    <header className="flex items-center justify-between gap-4 px-3 py-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {meta.title}
        </h1>
        <p className="text-xs text-slate-500">{meta.crumb}</p>
      </div>

      <div className="flex items-center gap-2">
        {can(user, "patients.view") ? (
          // Búsqueda rápida: lleva al directorio filtrado (nombre, DUI o teléfono).
          <form
            role="search"
            className="hidden items-center gap-2 rounded-full bg-white px-3.5 py-2.5 text-sm text-slate-400 transition focus-within:ring-2 focus-within:ring-teal-500/40 dark:bg-slate-900 md:flex"
            onSubmit={(event) => {
              event.preventDefault();
              const term = query.trim();
              navigate(term ? `/patients?search=${encodeURIComponent(term)}` : "/patients");
              setQuery("");
            }}
          >
            <Search className="size-4" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar paciente"
              aria-label="Buscar paciente por nombre, DUI o teléfono"
              className="w-52 bg-transparent text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </form>
        ) : null}
        <ThemeToggle />
        {can(user, "notifications.view") ? <NotificationBell /> : null}
        {user ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              aria-label="Menú de la cuenta"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <Avatar user={user} size="size-10" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 w-60 rounded-2xl bg-white p-1.5 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25)] dark:bg-slate-900 dark:ring-1 dark:ring-white/10"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {displayName(user)}
                  </p>
                  <p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                <DropdownMenu.Item
                  onSelect={() => setPasswordOpen(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100 dark:text-slate-200 dark:data-[highlighted]:bg-slate-800"
                >
                  <KeyRound className="size-4" />
                  Cambiar contraseña
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={onLogout}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-700 outline-none data-[highlighted]:bg-rose-50 dark:text-rose-300 dark:data-[highlighted]:bg-rose-950/50"
                >
                  <LogOut className="size-4" />
                  Cerrar sesión
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        ) : null}
        <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
      </div>
    </header>
  );
}
