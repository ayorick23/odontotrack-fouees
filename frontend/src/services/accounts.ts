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
};

export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await api.get<UserResponse>("/accounts/users/me/");
  return {
    ...data,
    permissions: data.permissions ?? [],
  };
}
