import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  Headset,
  LayoutDashboard,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

import logoUees from "../assets/logo-uees.png";
import { can } from "../acl/can";
import {
  displayName,
  ROLE_LABELS,
  type AuthUser,
} from "../context/AuthContext";
import {
  isNavVisible,
  NAV_ENTRIES,
  type NavEntry,
  type NavGroup,
} from "./navigation";

export function Sidebar({ user }: { user: AuthUser | null }) {
  if (user === null) {
    return (
      <aside className="flex w-64 shrink-0 flex-col rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
        <p className="text-sm text-slate-400">Cargando menú...</p>
      </aside>
    );
  }

  const visible = NAV_ENTRIES.filter((entry) => isNavVisible(entry, user));

  return (
    <aside className="flex w-64 shrink-0 flex-col rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-white/10">
      <div className="mb-6 flex items-center gap-3 px-1">
        <img
          src={logoUees}
          alt="UEES"
          className="size-10 rounded-full object-cover"
        />
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            FOUEES
          </p>
          <p className="text-[11px] text-slate-400">Banco de pacientes</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {displayName(user)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {ROLE_LABELS[user.role]}
        </p>
      </div>

      <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Menú de navegación
      </p>
      <nav className="flex flex-1 flex-col gap-1">
        {visible.map((entry) =>
          "children" in entry ? (
            <PatientsGroup key={entry.label} entry={entry} user={user} />
          ) : (
            <SidebarLink
              key={entry.to}
              to={entry.to}
              label={entry.label}
              icon={navIcon(entry.icon)}
            />
          ),
        )}
      </nav>
    </aside>
  );
}

function PatientsGroup({
  entry,
  user,
}: {
  entry: NavGroup & { icon: "patients" };
  user: AuthUser;
}) {
  const location = useLocation();
  const children = entry.children.filter((child) => can(user, child.permission));
  const childActive = children.some(
    (child) =>
      location.pathname === child.to ||
      (child.to !== "/patients" && location.pathname.startsWith(`${child.to}/`)) ||
      (child.to === "/patients" && location.pathname.startsWith("/patients")),
  );
  const [open, setOpen] = useState(childActive);

  if (children.length === 0) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium ${
          childActive
            ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        <FolderOpen className="size-4 shrink-0" />
        {entry.label}
      </button>
      {open ? (
        <div className="mt-1 ml-4 flex flex-col gap-1 border-l border-slate-100 pl-2 dark:border-slate-800">
          {children.map((child) => (
            <SidebarLink
              key={child.to}
              to={child.to}
              label={child.label}
              icon={childIcon(child.to)}
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
}: {
  to: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/patients"}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
          isActive
            ? "bg-[#2ad4c5] text-white"
            : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function navIcon(icon: Exclude<NavEntry["icon"], "patients">): ReactNode {
  const className = "size-4 shrink-0";
  switch (icon) {
    case "dashboard":
      return <LayoutDashboard className={className} />;
    case "calendar":
      return <CalendarDays className={className} />;
    case "supervision":
      return <ClipboardCheck className={className} />;
    case "students":
      return <GraduationCap className={className} />;
    case "roles":
      return <Shield className={className} />;
    case "catalogs":
      return <BookOpen className={className} />;
    case "support":
      return <Headset className={className} />;
  }
}

function childIcon(to: string): ReactNode {
  const className = "size-4 shrink-0";
  if (to === "/patients/new") {
    return <UserPlus className={className} />;
  }
  if (to === "/assignments") {
    return <ClipboardCheck className={className} />;
  }
  return <Users className={className} />;
}
