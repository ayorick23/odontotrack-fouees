import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FolderOpen,
  GraduationCap,
  Headset,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { Tooltip } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

import logoUees from "../assets/logo-uees.png";
import { displayName, ROLE_LABELS, type AuthUser } from "../context/AuthContext";
import { getMenuCounters, type MenuCounters } from "../services/dashboard";
import {
  canSeeLeaf,
  isNavVisible,
  NAV_ENTRIES,
  NAV_SECTIONS,
  type NavEntry,
  type NavGroup,
} from "./navigation";

const COLLAPSED_KEY = "fouees-sidebar-collapsed";

/** Contador junto al ítem: ámbar si pide acción, gris si es informativo. */
type Badge = { count: number; alert: boolean };

function badgeFor(to: string, counters: MenuCounters | null): Badge | null {
  if (!counters) {
    return null;
  }
  if (to === "/supervision" && counters.supervision) {
    return { count: counters.supervision, alert: true };
  }
  if (to === "/assignments" && counters.assignments) {
    return { count: counters.assignments, alert: false };
  }
  return null;
}

/**
 * Menú lateral. Va pintado sobre el marco (mismo color que el fondo y la
 * barra superior, sin bordes); solo el panel de contenido se eleva.
 * Se puede colapsar a íconos; la preferencia se recuerda en el navegador.
 */
export function Sidebar({
  user,
  onLogout,
}: {
  user: AuthUser | null;
  onLogout: () => void;
}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSED_KEY) === "1",
  );
  const [counters, setCounters] = useState<MenuCounters | null>(null);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Al navegar se refrescan: validar o elegir un paciente cambia los números.
  useEffect(() => {
    if (user === null) {
      return;
    }
    let cancelled = false;
    getMenuCounters()
      .then((next) => {
        if (!cancelled) {
          setCounters(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname]);

  const width = collapsed ? "w-[76px]" : "w-64";

  if (user === null) {
    return (
      <aside className={`${width} shrink-0 px-3 py-4`}>
        <p className="text-sm text-slate-400">Cargando menú...</p>
      </aside>
    );
  }

  const visible = NAV_ENTRIES.filter((entry) => isNavVisible(entry, user));

  return (
    <Tooltip.Provider delayDuration={150}>
      <aside
        className={`flex ${width} shrink-0 flex-col px-3 py-4 transition-[width] duration-200`}
        aria-label="Menú principal"
      >
        <div
          className={`mb-6 flex items-center gap-3 ${collapsed ? "flex-col" : "px-2"}`}
        >
          <img src={logoUees} alt="UEES" className="size-10 shrink-0 rounded-full object-cover" />
          {collapsed ? null : (
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                OdontoTrack
              </p>
              <p className="truncate text-[11px] text-slate-500">Banco de pacientes</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-expanded={!collapsed}
            className={`grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200 ${collapsed ? "" : "ml-auto"}`}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>

        <nav
          className={`flex flex-1 flex-col gap-5 ${collapsed ? "" : "overflow-y-auto"}`}
        >
          {NAV_SECTIONS.map((section) => {
            const entries = visible.filter((entry) => entry.section === section.id);
            if (entries.length === 0) {
              return null;
            }
            return (
              <div key={section.id}>
                {collapsed ? (
                  <div className="mx-auto mb-2 h-px w-6 bg-slate-200 dark:bg-slate-800" />
                ) : (
                  <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {section.label}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {entries.map((entry) =>
                    "children" in entry ? (
                      <PatientsGroup
                        key={entry.label}
                        entry={entry}
                        user={user}
                        collapsed={collapsed}
                        counters={counters}
                      />
                    ) : (
                      <SidebarLink
                        key={entry.to}
                        to={entry.to}
                        label={entry.label}
                        icon={navIcon(entry.icon)}
                        collapsed={collapsed}
                        badge={badgeFor(entry.to, counters)}
                      />
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        <div
          className={`mt-4 flex items-center gap-3 rounded-2xl py-2 ${collapsed ? "flex-col" : "px-2"}`}
        >
          <Avatar user={user} />
          {collapsed ? null : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {displayName(user)}
              </p>
              <p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
            </div>
          )}
          <WithTooltip label="Cerrar sesión" enabled={collapsed}>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Cerrar sesión"
              title={collapsed ? undefined : "Cerrar sesión"}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
            >
              <LogOut className="size-4" />
            </button>
          </WithTooltip>
        </div>
      </aside>
    </Tooltip.Provider>
  );
}

export function initials(user: AuthUser): string {
  const parts = displayName(user).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ user, size = "size-9" }: { user: AuthUser; size?: string }) {
  return (
    <span
      className={`grid ${size} shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-sm font-semibold text-white`}
      aria-hidden="true"
    >
      {initials(user)}
    </span>
  );
}

function WithTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: ReactNode;
}) {
  if (!enabled) {
    return <>{children}</>;
  }
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={10}
          className="z-50 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-lg dark:bg-slate-700"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function BadgeView({ badge, collapsed }: { badge: Badge | null; collapsed: boolean }) {
  if (!badge) {
    return null;
  }
  if (collapsed) {
    return (
      <span
        className={`absolute right-2 top-1.5 size-2 rounded-full ${badge.alert ? "bg-amber-400" : "bg-slate-400"}`}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        badge.alert
          ? "bg-amber-400 text-amber-950"
          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
      }`}
    >
      {badge.count}
    </span>
  );
}

const ITEM =
  "relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500";
const ITEM_IDLE =
  "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100";
// Teal profundo: el teal claro de la marca no contrasta con texto blanco.
const ITEM_ACTIVE = "bg-teal-700 text-white shadow-sm shadow-teal-900/20";

function PatientsGroup({
  entry,
  user,
  collapsed,
  counters,
}: {
  entry: NavGroup & { icon: "patients" };
  user: AuthUser;
  collapsed: boolean;
  counters: MenuCounters | null;
}) {
  const location = useLocation();
  const children = entry.children.filter((child) => canSeeLeaf(user, child));
  const childActive = children.some(
    (child) =>
      location.pathname === child.to ||
      (child.to !== "/patients" && location.pathname.startsWith(`${child.to}/`)) ||
      (child.to === "/patients" && location.pathname.startsWith("/patients")),
  );
  const [open, setOpen] = useState(true);

  if (children.length === 0) {
    return null;
  }

  // Colapsado no hay espacio para el submenú: cada hijo va como ícono.
  if (collapsed) {
    return (
      <>
        {children.map((child) => (
          <SidebarLink
            key={child.to}
            to={child.to}
            label={child.label}
            icon={childIcon(child.to)}
            collapsed
            badge={badgeFor(child.to, counters)}
          />
        ))}
      </>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`${ITEM} w-full px-3 py-2.5 text-left ${
          childActive && !open
            ? "bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
            : ITEM_IDLE
        }`}
      >
        <FolderOpen className="size-[18px] shrink-0" />
        {entry.label}
        <ChevronDown
          className={`ml-auto size-4 opacity-60 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open ? (
        <div className="ml-[22px] mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 pl-3 dark:border-slate-800">
          {children.map((child) => (
            <SidebarLink
              key={child.to}
              to={child.to}
              label={child.label}
              icon={childIcon(child.to)}
              collapsed={false}
              compact
              badge={badgeFor(child.to, counters)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SidebarLink({
  to,
  label,
  icon,
  collapsed,
  compact = false,
  badge,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  collapsed: boolean;
  compact?: boolean;
  badge: Badge | null;
}) {
  return (
    <WithTooltip label={label} enabled={collapsed}>
      <NavLink
        to={to}
        end={to === "/patients"}
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) =>
          `${ITEM} ${collapsed ? "justify-center py-2.5" : `px-3 ${compact ? "py-1.5" : "py-2.5"}`} ${
            isActive ? ITEM_ACTIVE : ITEM_IDLE
          }`
        }
      >
        {icon}
        {collapsed ? null : <span className="truncate">{label}</span>}
        <BadgeView badge={badge} collapsed={collapsed} />
      </NavLink>
    </WithTooltip>
  );
}

function navIcon(icon: Exclude<NavEntry["icon"], "patients">): ReactNode {
  const className = "size-[18px] shrink-0";
  switch (icon) {
    case "dashboard":
      return <LayoutDashboard className={className} />;
    case "calendar":
      return <CalendarDays className={className} />;
    case "supervision":
      return <ClipboardCheck className={className} />;
    case "students":
      return <GraduationCap className={className} />;
    case "users":
      return <UserCog className={className} />;
    case "roles":
      return <Shield className={className} />;
    case "catalogs":
      return <BookOpen className={className} />;
    case "support":
      return <Headset className={className} />;
  }
}

function childIcon(to: string): ReactNode {
  const className = "size-[18px] shrink-0";
  if (to === "/patients/new") {
    return <UserPlus className={className} />;
  }
  if (to === "/assignments") {
    return <ClipboardList className={className} />;
  }
  return <Users className={className} />;
}
