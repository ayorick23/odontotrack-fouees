import type { AuthUser } from "../context/AuthContext";
import { can, canAny } from "../acl/can";

export type NavLeaf = {
  to: string;
  label: string;
  /** Con varios permisos, basta con tener uno. */
  permission: string | readonly string[];
};

export type NavGroup = {
  label: string;
  children: readonly NavLeaf[];
};

export type NavEntry =
  | (NavLeaf & { icon: "dashboard" | "calendar" | "supervision" | "students" | "support" | "roles" | "catalogs" })
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
        to: "/patients/available",
        label: "Pacientes disponibles",
        permission: ["assignments.claim", "assignments.assign_student"],
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
    to: "/catalogs",
    label: "Catálogos clínicos",
    icon: "catalogs",
    permission: "catalogs.view",
  },
  {
    to: "/support",
    label: "Soporte técnico",
    icon: "support",
    permission: "support.view",
  },
];

export function canSeeLeaf(user: AuthUser, leaf: NavLeaf): boolean {
  return typeof leaf.permission === "string"
    ? can(user, leaf.permission)
    : canAny(user, leaf.permission);
}

export function isNavVisible(entry: NavEntry, user: AuthUser): boolean {
  if ("children" in entry) {
    return entry.children.some((child) => canSeeLeaf(user, child));
  }
  return canSeeLeaf(user, entry);
}

export function firstAllowedPath(user: AuthUser): string | null {
  for (const entry of NAV_ENTRIES) {
    if ("children" in entry) {
      const child = entry.children.find((item) => canSeeLeaf(user, item));
      if (child) {
        return child.to;
      }
    } else if (canSeeLeaf(user, entry)) {
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
    return canSeeLeaf(user, exact);
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
