import type { TokenPair } from "./auth";

export function getStoredAccessToken(): string | null {
  return (
    localStorage.getItem("accessToken") ?? sessionStorage.getItem("accessToken")
  );
}

export function getUserIdFromAccessToken(): number | null {
  const token = getStoredAccessToken();
  if (!token) {
    return null;
  }

  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalized = padded + "=".repeat((4 - (padded.length % 4)) % 4);
    const parsed = JSON.parse(atob(normalized)) as { user_id?: string | number };
    const userId = Number(parsed.user_id);
    return Number.isFinite(userId) ? userId : null;
  } catch {
    return null;
  }
}

export function persistTokens(tokens: TokenPair, remember: boolean): void {
  const storage = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;

  other.removeItem("accessToken");
  other.removeItem("refreshToken");
  storage.setItem("accessToken", tokens.access);
  storage.setItem("refreshToken", tokens.refresh);
}

export function clearTokens(): void {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("refreshToken");
}
