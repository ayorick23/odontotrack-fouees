import axios from "axios";

import { api } from "./api";
import type { TokenPair } from "./tokens";

export function loginWithCredentials(
  identifier: string,
  password: string,
): Promise<TokenPair> {
  const payload = identifier.includes("@")
    ? { username: identifier, email: identifier, password }
    : { username: identifier, password };

  return api.post<TokenPair>("/auth/token/", payload).then((response) => response.data);
}

export function getLoginErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    return "Correo o contraseña incorrectos.";
  }
  if (axios.isAxiosError(error) && error.response?.status === 400) {
    return "Ingresa tu correo o usuario y tu contraseña.";
  }
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}
