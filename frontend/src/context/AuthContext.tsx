import { createContext, useMemo, useState, type ReactNode } from "react";

import { getStoredAccessToken } from "../services/tokens";

export type UserRole =
  | "admin"
  | "docente"
  | "estudiante"
  | "recepcion"
  | "soporte";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setAuthenticated] = useState(
    () => getStoredAccessToken() !== null,
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      setUser,
      isAuthenticated,
      setAuthenticated,
    }),
    [user, isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
