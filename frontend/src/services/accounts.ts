import type { AuthUser } from "../context/AuthContext";
import { api } from "./api";

type UserResponse = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AuthUser["role"];
  permissions?: string[];
  photo?: string | null;
};

function toAuthUser(data: UserResponse): AuthUser {
  return {
    ...data,
    permissions: data.permissions ?? [],
    photo: data.photo ?? null,
  };
}

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await api.get<UserResponse>("/accounts/users/me/");
  return toAuthUser(data);
}

/**
 * Edita el propio perfil (PATCH /me). Solo nombre, apellido y foto: el
 * backend ignora cualquier otro campo.
 * `photo`: un File la reemplaza, `null` la quita, `undefined` no la toca.
 */
export async function updateProfile(
  names: { first_name: string; last_name: string },
  photo?: File | null,
): Promise<AuthUser> {
  let body: FormData | Record<string, unknown> = { ...names };
  if (photo instanceof File) {
    const form = new FormData();
    form.append("first_name", names.first_name);
    form.append("last_name", names.last_name);
    form.append("photo", photo);
    body = form;
  } else if (photo === null) {
    body = { ...names, photo: null };
  }
  const { data } = await api.patch<UserResponse>("/accounts/users/me/", body);
  return toAuthUser(data);
}
