import { STATE_OAUTH_STORAGE_KEY, type StateOAuthBundle } from './oauth/session-storage-keys';

export function readStoredStateAuth(): StateOAuthBundle | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.sessionStorage.getItem(STATE_OAUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StateOAuthBundle;
    if (!parsed.access_token || parsed.expires_at < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function readApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { message?: string | string[] };
    if (typeof json.message === 'string') {
      return json.message;
    }
    if (Array.isArray(json.message)) {
      return json.message.join(', ');
    }
  } catch {
    /* not JSON */
  }
  return text || `HTTP ${response.status}`;
}
