import { ADMIN_OAUTH_STORAGE_KEY, type AdminOAuthBundle } from './oauth/session-storage-keys';

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

export function clearStoredAuth(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(ADMIN_OAUTH_STORAGE_KEY);
  }
}
