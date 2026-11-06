import { describe, expect, it } from "vitest";

import type { AuthUser } from "../context/AuthContext";
import { canAccessPath } from "./navigation";

const SIN_PERMISOS: AuthUser = {
  id: 1,
  username: "nadie",
  email: "",
  first_name: "",
  last_name: "",
  role: "estudiante",
  permissions: [],
};

describe("canAccessPath", () => {
  it("deja entrar a /perfil a cualquier usuario autenticado, aunque no tenga permisos", () => {
    expect(canAccessPath("/perfil", SIN_PERMISOS)).toBe(true);
    expect(canAccessPath("/perfil/", SIN_PERMISOS)).toBe(true);
  });

  it("sigue bloqueando rutas que dependen de permisos", () => {
    expect(canAccessPath("/users", SIN_PERMISOS)).toBe(false);
  });
});
