import axios from "axios";

import { api } from "./api";

/**
 * Registro de estudiantes con correo institucional (decisión 2026-11-01):
 * - Solo estudiantes, con su CIF (10 dígitos): 2025010371@cvirtualuees.edu.sv.
 * - Se verifica el correo con un código y la cuenta queda pendiente hasta
 *   que administración la apruebe (y decida si la promueve de rol).
 *
 * Contrato que implementará el backend:
 *   POST /accounts/register/          {first_name, last_name, email, password} → 201
 *   POST /accounts/register/verify/   {email, code}                            → 200
 *   POST /accounts/register/resend/   {email}                                  → 204
 * Mientras no exista, el formulario avisa que el registro aún no está
 * habilitado (404/405).
 */

export const INSTITUTIONAL_DOMAIN = "cvirtualuees.edu.sv";
const INSTITUTIONAL_EMAIL = /^(\d{10})@cvirtualuees\.edu\.sv$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** El CIF (número de la UEES) si el correo es institucional válido; si no, null. */
export function cifFromEmail(value: string): string | null {
  return INSTITUTIONAL_EMAIL.exec(normalizeEmail(value))?.[1] ?? null;
}

export const PASSWORD_MIN_LENGTH = 10;

export type PasswordRule = { id: string; label: string; ok: boolean };

/** Requisitos de la contraseña, para validarla y mostrarlos en vivo. */
export function passwordRules(password: string, email = ""): PasswordRule[] {
  const cif = cifFromEmail(email);
  return [
    {
      id: "length",
      label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
      ok: password.length >= PASSWORD_MIN_LENGTH,
    },
    { id: "upper", label: "Una letra mayúscula", ok: /[A-ZÁÉÍÓÚÑ]/.test(password) },
    { id: "lower", label: "Una letra minúscula", ok: /[a-záéíóúñ]/.test(password) },
    { id: "number", label: "Un número", ok: /\d/.test(password) },
    {
      id: "cif",
      label: "No contiene tu CIF",
      ok: password.length > 0 && !(cif && password.includes(cif)),
    },
  ];
}

export type RegisterPayload = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

export function registerStudent(payload: RegisterPayload): Promise<void> {
  return api.post("/accounts/register/", payload).then(() => undefined);
}

export function verifyRegistration(email: string, code: string): Promise<void> {
  return api.post("/accounts/register/verify/", { email, code }).then(() => undefined);
}

export function resendRegistrationCode(email: string): Promise<void> {
  return api.post("/accounts/register/resend/", { email }).then(() => undefined);
}

/** El backend del registro todavía no existe (o está deshabilitado). */
export function isRegistrationUnavailable(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    (error.response?.status === 404 || error.response?.status === 405)
  );
}

export function registrationErrorMessage(error: unknown): string {
  if (isRegistrationUnavailable(error)) {
    return "El registro de cuentas todavía no está habilitado. Pronto podrás crear tu cuenta.";
  }
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    const data = error.response.data as Record<string, unknown> | undefined;
    const first = data && Object.values(data)[0];
    if (Array.isArray(first) && typeof first[0] === "string") {
      return first[0];
    }
    if (typeof first === "string") {
      return first;
    }
    return "Revisa los datos del formulario.";
  }
  if (axios.isAxiosError(error) && error.response?.status === 429) {
    return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
  }
  return "No se pudo completar el registro. Intenta de nuevo.";
}
