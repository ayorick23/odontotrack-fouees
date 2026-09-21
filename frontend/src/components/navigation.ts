import type { AuthUser } from "../context/AuthContext";
import { can } from "../acl/can";

export type NavLeaf = {
  to: string;
  label: string;
  permission: string;
};

export type NavGroup = {
  label: string;
  children: readonly NavLeaf[];
};

export type NavEntry =
  | (NavLeaf & { icon: "dashboard" | "calendar" | "supervision" | "students" | "support" | "roles" })
  | (NavGroup & { icon: "patients" });

export const NAV_ENTRIES: readonly NavEntry[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    permission: "dashboard.view",
  },
  {
    to: "/calendar",
    label: "Calendario de citas",
    icon: "calendar",
    permission: "calendar.view",
  },
  {
    label: "Pacientes",
    icon: "patients",
    children: [
      {
        to: "/patients/new",
        label: "Registro de paciente",
        permission: "patients.create",
      },
      {
        to: "/patients",
        label: "Directorio",
        permission: "patients.view",
      },
      {
        to: "/assignments",
        label: "Asignación de paciente",
        permission: "assignments.view",
      },
    ],
  },
  {
    to: "/supervision",
    label: "Supervisión",
    icon: "supervision",
    permission: "supervision.view",
  },
  {
    to: "/students",
    label: "Base de estudiantes",
    icon: "students",
    permission: "students.view",
  },
  {
    to: "/roles",
    label: "Roles y permisos",
    icon: "roles",
    permission: "roles.view",
  },
  {
    to: "/support",
    label: "Soporte técnico",
    icon: "support",
    permission: "support.view",
  },
];

export function isNavVisible(entry: NavEntry, user: AuthUser): boolean {
  if ("children" in entry) {
    return entry.children.some((child) => can(user, child.permission));
  }
  return can(user, entry.permission);
}

export function firstAllowedPath(user: AuthUser): string | null {
  for (const entry of NAV_ENTRIES) {
    if ("children" in entry) {
      const child = entry.children.find((item) => can(user, item.permission));
      if (child) {
        return child.to;
      }
    } else if (can(user, entry.permission)) {
      return entry.to;
    }
  }
  return null;
}

function navLeaves(): readonly NavLeaf[] {
  return NAV_ENTRIES.flatMap((entry) =>
    "children" in entry ? entry.children : [entry],
  );
}

export function canAccessPath(pathname: string, user: AuthUser): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const leaves = navLeaves();
  const exact = leaves.find((leaf) => leaf.to === normalized);
  if (exact) {
    return can(user, exact.permission);
  }

  if (/^\/patients\/\d+\/edit$/.test(normalized)) {
    return can(user, "patients.edit");
  }

  if (normalized.startsWith("/patients/")) {
    return can(user, "patients.view");
  }

  if (/^\/roles\/\d+\/edit$/.test(normalized)) {
    return can(user, "roles.edit");
  }

  if (/^\/roles\/\d+$/.test(normalized)) {
    return can(user, "roles.view");
  }

  return false;
}
