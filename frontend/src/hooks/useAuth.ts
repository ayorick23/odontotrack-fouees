import { useCallback, useContext } from "react";

import { AuthContext } from "../context/AuthContext";
import { getCurrentUser } from "../services/accounts";
import { loginWithCredentials } from "../services/auth";
import { clearTokens, persistTokens } from "../services/tokens";

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de un <AuthProvider>");
  }

  const auth = context;

  const logout = useCallback(() => {
    clearTokens();
    auth.setUser(null);
    auth.setAuthenticated(false);
  }, [auth]);

  async function login(
    identifier: string,
    password: string,
    remember: boolean,
  ): Promise<void> {
    const tokens = await loginWithCredentials(identifier, password);
    persistTokens(tokens, remember);
    auth.setAuthenticated(true);
    auth.setUser(await getCurrentUser());
  }

  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    setUser: auth.setUser,
    login,
    logout,
  };
}
