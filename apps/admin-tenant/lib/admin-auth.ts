import { publicEnv } from './env/public-env';
import { normalizeApiBaseUrl } from './normalize-api-base';
import { ADMIN_OAUTH_STORAGE_KEY, type AdminOAuthBundle } from './oauth/session-storage-keys';

/** Refresh access token this many seconds before Keycloak expiry. */
export const ACCESS_TOKEN_REFRESH_BUFFER_SEC = 90;

export function readStoredAuth(): AdminOAuthBundle | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = sessionStorage.getItem(ADMIN_OAUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AdminOAuthBundle;
    if (!parsed.access_token || typeof parsed.expires_at !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredAuth(bundle: AdminOAuthBundle): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.setItem(ADMIN_OAUTH_STORAGE_KEY, JSON.stringify(bundle));
}

export function clearStoredAuth(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_OAUTH_STORAGE_KEY);
  }
}

function resolveApiBase(bundle: AdminOAuthBundle): string {
  const fallback = normalizeApiBaseUrl(publicEnv().apiBaseUrl);
  return normalizeApiBaseUrl(bundle.api_base_url ?? fallback);
}

export function isAccessTokenExpiringSoon(
  auth: AdminOAuthBundle,
  bufferSec = ACCESS_TOKEN_REFRESH_BUFFER_SEC,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  return auth.expires_at <= now + bufferSec;
}

/** Silently refresh Keycloak tokens when nearing expiry; returns null when re-login is required. */
export async function ensureFreshAccessToken(): Promise<{
  token: string;
  apiBase: string;
} | null> {
  const auth = readStoredAuth();
  if (!auth) {
    return null;
  }
  const apiBase = resolveApiBase(auth);
  if (!isAccessTokenExpiringSoon(auth)) {
    return { token: auth.access_token, apiBase };
  }
  if (!auth.refresh_token?.trim()) {
    return { token: auth.access_token, apiBase };
  }

  const res = await fetch('/api/admin-auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: auth.refresh_token }),
  });
  if (!res.ok) {
    clearStoredAuth();
    return null;
  }

  const raw = (await res.json()) as {
    access_token?: string;
    expires_at?: number;
    refresh_token?: string;
    api_base_url?: string;
  };
  if (!raw.access_token || typeof raw.expires_at !== 'number') {
    clearStoredAuth();
    return null;
  }

  const next: AdminOAuthBundle = {
    access_token: raw.access_token,
    expires_at: raw.expires_at,
    refresh_token: raw.refresh_token ?? auth.refresh_token,
    api_base_url: raw.api_base_url ?? auth.api_base_url,
  };
  writeStoredAuth(next);
  return { token: next.access_token, apiBase: resolveApiBase(next) };
}
