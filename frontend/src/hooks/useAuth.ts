import { useContext } from "react";

import { AuthContext } from "../context/AuthContext";

/**
 * Hook para leer/actualizar el usuario autenticado desde cualquier
 * componente. La lógica de login (llamar a /api/auth/token/, guardar
 * los tokens JWT y setear el usuario) se implementará junto con la
 * pantalla de Login.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de un <AuthProvider>");
  }

  return context;
}
