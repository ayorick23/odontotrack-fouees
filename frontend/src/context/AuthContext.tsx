import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getCurrentUser } from "../services/accounts";
import { setSessionExpiredHandler } from "../services/api";
import { loginWithCredentials } from "../services/auth";
import {
  clearTokens,
  getStoredAccessToken,
  persistTokens,
} from "../services/tokens";

export type UserRole =
  | "admin"
  | "docente"
  | "estudiante"
  | "recepcion"
  | "soporte";

export interface AuthUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  permissions: string[];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  docente: "Docente supervisor",
  estudiante: "Estudiante",
  recepcion: "Recepción",
  soporte: "Soporte técnico",
};

export function displayName(user: AuthUser): string {
  const fullName = `${user.first_name} ${user.last_name}`.trim();
  return fullName || user.username;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (
    identifier: string,
    password: string,
    remember: boolean,
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setAuthenticated] = useState(
    () => getStoredAccessToken() !== null,
  );
  const [isReady, setReady] = useState(false);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setAuthenticated(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const current = await getCurrentUser();
    setUser(current);
    setAuthenticated(true);
  }, []);

  const login = useCallback(
    async (identifier: string, password: string, remember: boolean) => {
      const tokens = await loginWithCredentials(identifier, password);
      persistTokens(tokens, remember);
      try {
        const current = await getCurrentUser();
        setUser(current);
        setAuthenticated(true);
      } catch (error) {
        logout();
        throw error;
      }
    },
    [logout],
  );

  useEffect(() => {
    setSessionExpiredHandler(logout);
    return () => setSessionExpiredHandler(null);
  }, [logout]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (getStoredAccessToken() === null) {
        if (!cancelled) {
          setReady(true);
        }
        return;
      }

      try {
        const current = await getCurrentUser();
        if (!cancelled) {
          setUser(current);
          setAuthenticated(true);
        }
      } catch {
        if (!cancelled) {
          logout();
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isReady,
      login,
      logout,
      refreshUser,
    }),
    [user, isAuthenticated, isReady, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
