import { createContext, useState, type ReactNode } from "react";

// Roles posibles de un usuario, deben coincidir con las choices de
// accounts.models.User.Role en el backend.
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
}

// El valor real se arma dentro de AuthProvider; este contexto solo
// declara la forma de los datos. La lógica de login/logout vive en el
// hook useAuth (src/hooks/useAuth.ts) para no mezclar responsabilidades.
export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const value: AuthContextValue = {
    user,
    setUser,
    isAuthenticated: user !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
