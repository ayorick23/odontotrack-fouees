import type { TokenPair } from "./auth";

export function getStoredAccessToken(): string | null {
  return (
    localStorage.getItem("accessToken") ?? sessionStorage.getItem("accessToken")
  );
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
