import { KeyRound, LogOut, Search } from "./icons";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { can } from "../acl/can";
import {
  displayName,
  ROLE_LABELS,
  type AuthUser,
} from "../context/AuthContext";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { ICON_BUTTON } from "./listing/styles";
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

  return (
    // Directo sobre el fondo: título a la izquierda y, a la derecha, una
    // cápsula de vidrio con búsqueda, tema y notificaciones.
    // relative z-30: el vidrio (backdrop-filter) crea su propio apilamiento y
    // sin esto los menús desplegables (notificaciones, cuenta) quedaban
    // detrás del contenido de la página.
    <header className="relative z-30 flex items-center justify-between gap-4 px-1 pt-5 pb-4">
      <div className="min-w-0">
        <h1 className="truncate text-[26px] leading-tight font-bold tracking-[-0.03em] text-ink dark:text-white">
          {meta.title}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">{meta.crumb}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="glass flex items-center gap-0.5 rounded-full p-1">
          {can(user, "patients.view") ? <QuickSearch onSearch={navigate} /> : null}
          <ThemeToggle />
          {can(user, "notifications.view") ? <NotificationBell /> : null}
        </div>
        {user ? (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              aria-label="Menú de la cuenta"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Avatar user={user} size="size-10" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 w-60 rounded-2xl bg-white p-1.5 shadow-[0_12px_40px_-8px_rgba(22,24,28,0.25)] dark:bg-slate-900 dark:ring-1 dark:ring-white/10"
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
                  className="anim-out flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-700 outline-none data-[highlighted]:bg-rose-50 dark:text-rose-300 dark:data-[highlighted]:bg-rose-950/50"
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

/**
 * Búsqueda rápida: la lupa despliega el campo de derecha a izquierda.
 * Enter lleva al directorio filtrado (nombre, DUI o teléfono); Escape o
 * salir del campo vacío lo cierra. Atajo: "/" fuera de un campo de texto.
 */
function QuickSearch({ onSearch }: { onSearch: (to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function close() {
    setQuery("");
    setOpen(false);
  }

  return (
    <form
      role="search"
      // max-md:hidden y no "hidden md:flex": el CSS de la librería del
      // odontograma trae un .hidden sin capa que le gana a md:flex.
      className="flex items-center max-md:hidden"
      onSubmit={(event) => {
        event.preventDefault();
        const term = query.trim();
        onSearch(term ? `/patients?search=${encodeURIComponent(term)}` : "/patients");
        close();
        inputRef.current?.blur();
      }}
    >
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={(event) => {
          // Si el foco pasa a la lupa, ella decide (abrir/cerrar) en su clic.
          if (event.relatedTarget === buttonRef.current) {
            return;
          }
          if (!query.trim()) {
            setOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            close();
            inputRef.current?.blur();
          }
        }}
        tabIndex={open ? 0 : -1}
        placeholder="Buscar paciente, DUI o teléfono…"
        aria-label="Buscar paciente por nombre, DUI o teléfono"
        className={`h-9 bg-transparent text-[13px] text-ink outline-none transition-[width,opacity,padding] duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)] placeholder:text-slate-400 motion-reduce:transition-none dark:text-slate-100 ${
          open ? "w-60 pl-3 opacity-100" : "w-0 p-0 opacity-0"
        }`}
      />
      <button
        ref={buttonRef}
        type="button"
        // Mantiene el foco en el campo: si no, el blur lo cerraba y el clic
        // lo volvía a abrir.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) {
            close();
            inputRef.current?.blur();
          } else {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
        title={open ? "Cerrar búsqueda" : "Buscar paciente (/)"}
        aria-label={open ? "Cerrar búsqueda" : "Abrir búsqueda de pacientes"}
        aria-expanded={open}
        className={ICON_BUTTON}
      >
        <Search className="size-[17px]" />
      </button>
    </form>
  );
}
