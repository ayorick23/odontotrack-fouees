import { useContext } from "react";

import { AuthContext } from "../context/AuthContext";
import { loginWithCredentials } from "../services/auth";
import { clearTokens, persistTokens } from "../services/tokens";

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de un <AuthProvider>");
  }

  const auth = context;

  async function login(
    identifier: string,
    password: string,
    remember: boolean,
  ): Promise<void> {
    const tokens = await loginWithCredentials(identifier, password);
    persistTokens(tokens, remember);
    auth.setAuthenticated(true);
  }

  function logout(): void {
    clearTokens();
    auth.setUser(null);
    auth.setAuthenticated(false);
  }

  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    login,
    logout,
  };
}
