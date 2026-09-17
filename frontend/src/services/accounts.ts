import type { AuthUser } from "../context/AuthContext";
import { api } from "./api";
import { getUserIdFromAccessToken } from "./tokens";

type UserResponse = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AuthUser["role"];
};

export async function getCurrentUser(): Promise<AuthUser> {
  const userId = getUserIdFromAccessToken();
  if (userId === null) {
    throw new Error("No hay sesión activa.");
  }

  const { data } = await api.get<UserResponse>(`/accounts/users/${userId}/`);
  return data;
}
