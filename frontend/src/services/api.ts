import axios from "axios";

import { getStoredAccessToken } from "./tokens";

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

// URL base de la API de Django. Se lee de una variable de entorno de
// Vite (definida en el archivo .env del frontend) para que cada
// desarrollador pueda apuntar a su propio backend sin tocar el código.
// Ver .env.example en la raíz del proyecto.
const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export const api = axios.create({
  baseURL,
});

// Adjunta el access token JWT (si existe) a cada petición saliente.
// El token se guarda en localStorage o sessionStorage al hacer login.
api.interceptors.request.use((requestConfig) => {
  const accessToken = getStoredAccessToken();
  if (accessToken) {
    requestConfig.headers.Authorization = `Bearer ${accessToken}`;
  }
  return requestConfig;
});

export default api;
