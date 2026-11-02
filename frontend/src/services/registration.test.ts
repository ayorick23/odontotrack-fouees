import { describe, expect, it } from "vitest";

import {
  cifFromEmail,
  passwordRules,
  registrationErrorMessage,
} from "./registration";

const axiosError = (status: number, data: unknown = {}) => ({
  isAxiosError: true,
  response: { status, data },
});

describe("correo institucional", () => {
  it("acepta el CIF de 10 dígitos del dominio, sin importar mayúsculas", () => {
    expect(cifFromEmail("2025010371@cvirtualuees.edu.sv")).toBe("2025010371");
    expect(cifFromEmail("  2025010371@CVIRTUALUEES.EDU.SV ")).toBe("2025010371");
  });

  it("rechaza otro largo, letras u otro dominio", () => {
    for (const email of [
      "202501037@cvirtualuees.edu.sv",
      "20250103711@cvirtualuees.edu.sv",
      "juan.perez@cvirtualuees.edu.sv",
      "2025010371@gmail.com",
      "2025010371@uees.edu.sv",
    ]) {
      expect(cifFromEmail(email), email).toBeNull();
    }
  });
});

describe("reglas de contraseña", () => {
  const failing = (password: string, email = "") =>
    passwordRules(password, email)
      .filter((rule) => !rule.ok)
      .map((rule) => rule.id);

  it("una contraseña fuerte cumple todo", () => {
    expect(failing("Odonto2026x")).toEqual([]);
  });

  it("marca lo que falta", () => {
    expect(failing("corta1A")).toEqual(["length"]);
    expect(failing("sinmayusculas1")).toEqual(["upper"]);
    expect(failing("SINMINUSCULAS1")).toEqual(["lower"]);
    expect(failing("SinNumerosAqui")).toEqual(["number"]);
  });

  it("no puede contener el CIF", () => {
    expect(failing("Clave2025010371", "2025010371@cvirtualuees.edu.sv")).toEqual(["cif"]);
  });
});

describe("mensajes de error", () => {
  it("sin backend avisa que el registro no está habilitado", () => {
    expect(registrationErrorMessage(axiosError(404))).toMatch(/todavía no está habilitado/);
  });

  it("muestra el primer error del servidor", () => {
    expect(
      registrationErrorMessage(axiosError(400, { email: ["Este correo ya tiene cuenta."] })),
    ).toBe("Este correo ya tiene cuenta.");
  });
});
