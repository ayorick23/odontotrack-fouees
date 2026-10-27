import axios from "axios";

import type { UserRole } from "../context/AuthContext";
import { api, type PaginatedResponse } from "./api";

export type UserAccount = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  /** false = cuenta bloqueada: no inicia sesión. */
  is_active: boolean;
  last_login: string | null;
  date_joined: string;
};

export type UserFilters = {
  page?: number;
  search?: string;
  role?: UserRole | "";
  isActive?: "true" | "false" | "";
};

export type UserWritePayload = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
};

export function listUsers(filters: UserFilters = {}): Promise<PaginatedResponse<UserAccount>> {
  const params: Record<string, string | number> = { page: filters.page ?? 1 };
  if (filters.search?.trim()) {
    params.search = filters.search.trim();
  }
  if (filters.role) {
    params.role = filters.role;
  }
  if (filters.isActive) {
    params.is_active = filters.isActive;
  }
  return api
    .get<PaginatedResponse<UserAccount>>("/accounts/users/", { params })
    .then((response) => response.data);
}

export function createUser(
  payload: UserWritePayload & { password: string },
): Promise<UserAccount> {
  return api
    .post<UserAccount>("/accounts/users/", payload)
    .then((response) => response.data);
}

export function updateUser(
  id: number,
  payload: Partial<UserWritePayload & { is_active: boolean }>,
): Promise<UserAccount> {
  return api
    .patch<UserAccount>(`/accounts/users/${id}/`, payload)
    .then((response) => response.data);
}

export function deleteUser(id: number): Promise<void> {
  return api.delete(`/accounts/users/${id}/`).then(() => undefined);
}

export function resetUserPassword(id: number, password: string): Promise<void> {
  return api
    .post(`/accounts/users/${id}/set-password/`, { password })
    .then(() => undefined);
}

export function changeOwnPassword(payload: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  return api.post("/accounts/users/me/password/", payload).then(() => undefined);
}

/** Errores por campo del serializer, para mostrarlos bajo cada input. */
export type FieldErrors = Partial<Record<string, string>>;

export function getUserFieldErrors(error: unknown): FieldErrors {
  if (!axios.isAxiosError(error) || typeof error.response?.data !== "object") {
    return {};
  }
  const errors: FieldErrors = {};
  for (const [field, value] of Object.entries(error.response.data as Record<string, unknown>)) {
    const message = firstMessage(value);
    if (message) {
      errors[field] = message;
    }
  }
  return errors;
}

export function getUserError(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error) || error.response === undefined) {
    return fallback;
  }
  const data = error.response.data;
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    const detail = firstMessage(record.detail);
    if (detail) {
      return detail;
    }
    for (const value of Object.values(record)) {
      const message = firstMessage(value);
      if (message) {
        return message;
      }
    }
  }
  if (error.response.status === 403) {
    return "No tienes permiso para esta acción.";
  }
  return fallback;
}

function firstMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first : null;
  }
  return null;
}
