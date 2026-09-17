import type { UserRole } from "../context/AuthContext";

export type NavLeaf = {
  to: string;
  label: string;
  roles: readonly UserRole[];
};

export type NavGroup = {
  label: string;
  roles: readonly UserRole[];
  children: readonly NavLeaf[];
};

export type NavEntry =
  | (NavLeaf & { icon: "dashboard" | "calendar" | "supervision" | "students" | "support" })
  | (NavGroup & { icon: "patients" });

const ALL_ROLES: readonly UserRole[] = [
  "admin",
  "docente",
  "estudiante",
  "recepcion",
  "soporte",
];

export const NAV_ENTRIES: readonly NavEntry[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
    roles: ALL_ROLES,
  },
  {
    to: "/calendar",
    label: "Calendario de citas",
    icon: "calendar",
    roles: ["admin", "docente", "estudiante", "recepcion"],
  },
  {
    label: "Pacientes",
    icon: "patients",
    roles: ["admin", "docente", "estudiante", "recepcion"],
    children: [
      {
        to: "/patients/new",
        label: "Registro de paciente",
        roles: ["admin", "recepcion"],
      },
      {
        to: "/patients",
        label: "Directorio",
        roles: ["admin", "docente", "estudiante", "recepcion"],
      },
      {
        to: "/assignments",
        label: "Asignación de paciente",
        roles: ["admin", "docente", "recepcion"],
      },
    ],
  },
  {
    to: "/supervision",
    label: "Supervisión",
    icon: "supervision",
    roles: ["admin", "docente"],
  },
  {
    to: "/students",
    label: "Base de estudiantes",
    icon: "students",
    roles: ["admin", "docente"],
  },
  {
    to: "/support",
    label: "Soporte técnico",
    icon: "support",
    roles: ["admin", "soporte"],
  },
];

export function isAllowed(roles: readonly UserRole[], role: UserRole): boolean {
  return roles.includes(role);
}
