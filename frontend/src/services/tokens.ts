export type TokenPair = {
  access: string;
  refresh: string;
};

function activeTokenStorage(): Storage {
  if (
    localStorage.getItem("accessToken") !== null ||
    localStorage.getItem("refreshToken") !== null
  ) {
    return localStorage;
  }
  return sessionStorage;
}

export function getStoredAccessToken(): string | null {
  return (
    localStorage.getItem("accessToken") ?? sessionStorage.getItem("accessToken")
  );
}

export function getStoredRefreshToken(): string | null {
  return (
    localStorage.getItem("refreshToken") ??
    sessionStorage.getItem("refreshToken")
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

export function persistRotatedTokens(tokens: {
  access: string;
  refresh?: string;
}): void {
  const storage = activeTokenStorage();
  storage.setItem("accessToken", tokens.access);
  if (tokens.refresh) {
    storage.setItem("refreshToken", tokens.refresh);
  }
}

export function clearTokens(): void {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("refreshToken");
}
