import axios, { type InternalAxiosRequestConfig } from "axios";

import {
  clearTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  persistRotatedTokens,
} from "./tokens";

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type SessionExpiredHandler = () => void;

let onSessionExpired: SessionExpiredHandler | null = null;
let refreshInFlight: Promise<string> | null = null;

export function setSessionExpiredHandler(
  handler: SessionExpiredHandler | null,
): void {
  onSessionExpired = handler;
}

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((requestConfig) => {
  const accessToken = getStoredAccessToken();
  if (accessToken) {
    requestConfig.headers.Authorization = `Bearer ${accessToken}`;
  }
  return requestConfig;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const original = error.config as RetryConfig | undefined;
    if (isTokenObtainUrl(original?.url)) {
      return Promise.reject(error);
    }
    if (!original || original._retry) {
      expireSession();
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      const access = await refreshAccessToken();
      original.headers.set("Authorization", `Bearer ${access}`);
      return api(original);
    } catch (refreshError) {
      expireSession();
      return Promise.reject(refreshError);
    }
  },
);

function isTokenObtainUrl(url: string | undefined): boolean {
  if (url === undefined) {
    return false;
  }
  return url.includes("/auth/token/") && !url.includes("/auth/token/refresh");
}

function expireSession(): void {
  clearTokens();
  onSessionExpired?.();
}

function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refresh = getStoredRefreshToken();
    if (refresh === null) {
      throw new Error("No hay refresh token.");
    }

    const { data } = await axios.post<{ access: string; refresh?: string }>(
      `${baseURL}/auth/token/refresh/`,
      { refresh },
    );
    persistRotatedTokens(data);
    return data.access;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export default api;
