import {
  AddressBook,
  Books,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Eye,
  Headset,
  LayoutDashboard,
  LogOut,
  Shield,
  Student,
  Tooth,
  UserPlus,
  UsersThree,
  UserSwitch,
} from "./icons";
import { Tooltip } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

import logoSello from "../assets/logo-uees-sello.png";
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

/**
 * Geometría constante: al colapsar NO se reorganiza nada. Cada fila
 * conserva su alto y cada ícono su posición; solo se angosta el menú y
 * los textos quedan recortados con un fundido. Así colapsado se ve igual
 * que expandido, pero solo con íconos.
 *
 *   ancho colapsado 72 = 12 (padding del menú) + 48 (ítem) + 12
 *   ícono de 20 px a 14 px del borde del ítem → centrado en los 48.
 */
const ROW = "h-10"; // ítem principal
const SUB_ROW = "h-9"; // subítem de Pacientes
const SECTION_ROW = "h-7"; // título de sección
const ICON = "size-5 shrink-0";
/** Íconos del menú: duotono (identidad 2026-11). */
const ICON_WEIGHT = "duotone" as const;

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
 * Menú lateral, liso y directo sobre el fondo desenfocado: los ítems no
 * llevan caja; solo el activo va en píldora lima.
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

  const width = collapsed ? "w-[72px]" : "w-60";

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
        className={`relative flex ${width} shrink-0 flex-col py-4 transition-[width] duration-200 ease-out`}
        aria-label="Menú principal"
      >
        {/* Manija para colapsar: sobre el borde, no ocupa una fila. */}
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          aria-expanded={!collapsed}
          className="press absolute -right-3 top-[92px] z-10 grid size-6 cursor-pointer place-items-center rounded-full bg-white text-slate-500 shadow-[0_2px_8px_rgba(22,24,28,0.15)] transition hover:bg-lime hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-lime dark:hover:text-ink"
        >
          <ChevronLeft
            className={`size-3.5 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
          />
        </button>

        <div className="flex h-12 items-center gap-3 overflow-hidden px-3">
          <span className="grid size-12 shrink-0 place-items-center">
            <img src={logoSello} alt="UEES" className="size-10 object-contain" />
          </span>
          <Fade hidden={collapsed}>
            <p className="text-[15px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
              OdontoTrack
            </p>
            <p className="text-[11px] text-slate-500">Banco de pacientes</p>
          </Fade>
        </div>

        <nav className="mt-5 flex flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-3">
          {NAV_SECTIONS.map((section) => {
            const entries = visible.filter((entry) => entry.section === section.id);
            if (entries.length === 0) {
              return null;
            }
            return (
              <div key={section.id}>
                <div className={`${SECTION_ROW} flex items-center px-3.5`}>
                  {collapsed ? (
                    <span className="h-px w-5 bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
                  ) : (
                    <p className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[.14em] text-slate-400 dark:text-slate-500">
                      {section.label}
                    </p>
                  )}
                </div>
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

        <div className="mt-4 flex h-12 items-center gap-3 overflow-hidden px-3">
          <WithTooltip label={`${displayName(user)} · ${ROLE_LABELS[user.role]}`} enabled={collapsed}>
            <span className="grid size-12 shrink-0 place-items-center">
              <Avatar user={user} />
            </span>
          </WithTooltip>
          <Fade hidden={collapsed}>
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {displayName(user)}
            </p>
            <p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
          </Fade>
          {collapsed ? null : (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="press anim-out glass-chip ml-auto grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-ink dark:hover:bg-white/10 dark:hover:text-white"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </aside>
    </Tooltip.Provider>
  );
}

/** Texto que se desvanece al colapsar (el ancho del menú lo recorta). */
function Fade({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return (
    <div
      className={`min-w-0 whitespace-nowrap transition-opacity duration-150 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden={hidden || undefined}
    >
      {children}
    </div>
  );
}

export function initials(user: AuthUser): string {
  const parts = displayName(user).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ user, size = "size-9" }: { user: AuthUser; size?: string }) {
  return (
    <span
      className={`grid ${size} shrink-0 place-items-center rounded-full bg-lavender text-sm font-semibold text-ink`}
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
      {/* Envuelve en un contenedor propio: Radix fusiona la clase con la del
          hijo y NavLink la recibe como función (la convertía en texto). */}
      <Tooltip.Trigger asChild>
        <span className="block">{children}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={12}
          className="z-50 rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white shadow-lg dark:bg-lime dark:text-ink"
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
        className={`absolute right-2.5 top-2 size-2 rounded-full ring-2 ring-[#e9e8e3] dark:ring-slate-950 ${badge.alert ? "bg-amber-400" : "bg-ink dark:bg-lime"}`}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      className={`num ml-auto rounded-full px-1.5 py-px text-[10.5px] font-bold ${
        badge.alert ? "bg-amber-400 text-amber-950" : "bg-ink text-lime"
      }`}
    >
      {badge.count}
    </span>
  );
}

const ITEM =
  "press anim-nudge relative flex w-full cursor-pointer items-center gap-3 rounded-full px-3.5 text-[13.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
// Liso: sin caja; al pasar el mouse, un velo blanco muy suave.
const ITEM_IDLE =
  "text-slate-600 hover:bg-white/45 hover:text-ink dark:text-slate-400 dark:hover:bg-white/[.06] dark:hover:text-white";
// Activo: píldora lima con texto tinta (igual en claro y oscuro).
const ITEM_ACTIVE = "bg-lime text-ink shadow-[0_8px_20px_-10px_rgba(150,180,20,.9)]";

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

  return (
    <div>
      <WithTooltip label={entry.label} enabled={collapsed}>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label={collapsed ? entry.label : undefined}
          className={`${ITEM} ${ROW} text-left ${
            childActive && !open ? ITEM_ACTIVE : ITEM_IDLE
          }`}
        >
          <Tooth className={ICON} weight={ICON_WEIGHT} />
          <span className={`whitespace-nowrap transition-opacity duration-150 ${collapsed ? "opacity-0" : ""}`}>
            {entry.label}
          </span>
          {collapsed ? null : (
            <ChevronDown
              className={`ml-auto size-4 opacity-60 transition-transform ${open ? "" : "-rotate-90"}`}
            />
          )}
        </button>
      </WithTooltip>
      {open ? (
        // Expandido, los hijos van sangrados con línea guía; colapsado,
        // alineados con el resto para que todos los íconos formen una columna.
        <div
          className={`mt-0.5 flex flex-col gap-0.5 ${
            collapsed ? "" : "ml-[23px] border-l border-ink/10 pl-2 dark:border-white/10"
          }`}
        >
          {children.map((child) => (
            <SidebarLink
              key={child.to}
              to={child.to}
              label={child.label}
              icon={childIcon(child.to)}
              collapsed={collapsed}
              row={SUB_ROW}
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
  row = ROW,
  badge,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  collapsed: boolean;
  row?: string;
  badge: Badge | null;
}) {
  return (
    <WithTooltip label={label} enabled={collapsed}>
      <NavLink
        to={to}
        end={to === "/patients"}
        // View Transition: el ítem activo se llama "nav-pill", así la píldora
        // lima se desliza del ítem anterior al nuevo (index.css).
        viewTransition
        style={({ isActive }) => (isActive ? { viewTransitionName: "nav-pill" } : undefined)}
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) => `${ITEM} ${row} ${isActive ? ITEM_ACTIVE : ITEM_IDLE}`}
      >
        {icon}
        <span
          className={`truncate whitespace-nowrap transition-opacity duration-150 ${collapsed ? "opacity-0" : ""}`}
        >
          {label}
        </span>
        <BadgeView badge={badge} collapsed={collapsed} />
      </NavLink>
    </WithTooltip>
  );
}

function navIcon(icon: Exclude<NavEntry["icon"], "patients">): ReactNode {
  switch (icon) {
    case "dashboard":
      return <LayoutDashboard className={ICON} weight={ICON_WEIGHT} />;
    case "calendar":
      return <CalendarDays className={ICON} weight={ICON_WEIGHT} />;
    case "supervision":
      return <Eye className={ICON} weight={ICON_WEIGHT} />;
    case "students":
      return <Student className={ICON} weight={ICON_WEIGHT} />;
    case "users":
      return <UsersThree className={ICON} weight={ICON_WEIGHT} />;
    case "roles":
      return <Shield className={ICON} weight={ICON_WEIGHT} />;
    case "catalogs":
      return <Books className={ICON} weight={ICON_WEIGHT} />;
    case "support":
      return <Headset className={ICON} weight={ICON_WEIGHT} />;
  }
}

function childIcon(to: string): ReactNode {
  if (to === "/patients/new") {
    return <UserPlus className={ICON} weight={ICON_WEIGHT} />;
  }
  if (to === "/assignments") {
    return <UserSwitch className={ICON} weight={ICON_WEIGHT} />;
  }
  return <AddressBook className={ICON} weight={ICON_WEIGHT} />;
}
