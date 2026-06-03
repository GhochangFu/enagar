'use client';

import { applyPlatformTheme } from '@enagar/tenant-theme';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { clearStoredAuth, readStoredAuth } from '../lib/admin-auth';
import { publicEnv } from '../lib/env/public-env';
import { normalizeApiBaseUrl } from '../lib/normalize-api-base';

export type TenantAdminSessionMe = {
  tenant_code?: string;
  roles: string[];
  normalized_roles: string[];
  is_admin: boolean;
};

type TenantAdminSessionValue = {
  token: string;
  apiBase: string;
  me: TenantAdminSessionMe | null;
  loadingMe: boolean;
  meError: string | null;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const TenantAdminSessionContext = createContext<TenantAdminSessionValue | null>(null);

const ME_FETCH_TIMEOUT_MS = 12_000;

type BootState = 'pending' | 'ready' | 'redirect';

function resolveStoredSession(fallbackApi: string): {
  token: string | null;
  apiBase: string;
  redirectToLogin: boolean;
} {
  const auth = readStoredAuth();
  if (!auth) {
    return { token: null, apiBase: fallbackApi, redirectToLogin: true };
  }
  if (auth.expires_at < Math.floor(Date.now() / 1000)) {
    clearStoredAuth();
    return { token: null, apiBase: fallbackApi, redirectToLogin: true };
  }
  return {
    token: auth.access_token,
    apiBase: normalizeApiBaseUrl(auth.api_base_url ?? fallbackApi),
    redirectToLogin: false,
  };
}

function SessionGate({
  bootState,
  children,
}: {
  bootState: BootState;
  children: ReactNode;
}): JSX.Element {
  if (bootState === 'pending') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-6">
        <p className="text-sm font-medium text-ink-primary">Checking session…</p>
        <p className="max-w-sm text-center text-xs text-ink-muted">
          Reading your operator sign-in from this browser.
        </p>
      </div>
    );
  }

  if (bootState === 'redirect') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-6">
        <p className="text-sm font-medium text-ink-primary">Redirecting to sign in…</p>
        <p className="max-w-sm text-center text-xs text-ink-muted">
          No active session was found. If nothing happens, open{' '}
          <a className="font-medium text-brand underline" href="/login">
            /login
          </a>{' '}
          and ensure the API is running on port 3001.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export function TenantAdminSessionProvider({
  children,
  onUnauthorized,
}: {
  children: ReactNode;
  onUnauthorized: () => void;
}): JSX.Element {
  const fallbackApi = useMemo(() => normalizeApiBaseUrl(publicEnv().apiBaseUrl), []);
  const [bootState, setBootState] = useState<BootState>('pending');
  const [token, setToken] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState(fallbackApi);
  const [me, setMe] = useState<TenantAdminSessionMe | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const resolved = resolveStoredSession(fallbackApi);
    if (resolved.redirectToLogin) {
      setBootState('redirect');
      onUnauthorized();
      return;
    }
    setToken(resolved.token);
    setApiBase(resolved.apiBase);
    applyPlatformTheme();
    setBootState('ready');
  }, [fallbackApi, onUnauthorized]);

  const refreshMe = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoadingMe(true);
    setMeError(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), ME_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${apiBase}/admin/tenant/desk/me`, {
        cache: 'no-store',
        headers: { authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        setMe(null);
        setMeError(
          res.status === 401
            ? 'Session expired — sign in again.'
            : `Could not load operator profile (HTTP ${res.status}). Is the API running?`,
        );
        if (res.status === 401) {
          clearStoredAuth();
          onUnauthorized();
        }
        return;
      }
      setMe((await res.json()) as TenantAdminSessionMe);
    } catch (error) {
      setMe(null);
      const timedOut = error instanceof DOMException && error.name === 'AbortError';
      setMeError(
        timedOut
          ? `API did not respond within ${ME_FETCH_TIMEOUT_MS / 1000}s — start the API (port 3001) and refresh.`
          : 'Could not reach the API — confirm http://localhost:3001 is up.',
      );
    } finally {
      window.clearTimeout(timer);
      setLoadingMe(false);
    }
  }, [apiBase, onUnauthorized, token]);

  useEffect(() => {
    if (bootState === 'ready' && token) {
      void refreshMe();
    }
  }, [bootState, refreshMe, token]);

  const logout = useCallback(() => {
    window.location.assign('/api/admin-auth/logout');
  }, []);

  return (
    <SessionGate bootState={bootState}>
      {bootState === 'ready' && token ? (
        <TenantAdminSessionContext.Provider
          value={{ token, apiBase, me, loadingMe, meError, refreshMe, logout }}
        >
          {meError ? (
            <div
              className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
              role="status"
            >
              {meError}{' '}
              <button
                className="font-medium text-brand underline"
                onClick={() => void refreshMe()}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : null}
          {children}
        </TenantAdminSessionContext.Provider>
      ) : null}
    </SessionGate>
  );
}

export function useTenantAdminSession(): TenantAdminSessionValue {
  const ctx = useContext(TenantAdminSessionContext);
  if (!ctx) {
    throw new Error('useTenantAdminSession must be used within TenantAdminSessionProvider');
  }
  return ctx;
}
