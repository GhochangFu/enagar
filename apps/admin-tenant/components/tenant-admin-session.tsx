'use client';

import { applyPlatformTheme } from '@enagar/tenant-theme';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { clearStoredAuth, readStoredAuth } from '../lib/admin-auth';
import { publicEnv } from '../lib/env/public-env';

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
  refreshMe: () => Promise<void>;
  logout: () => void;
};

const TenantAdminSessionContext = createContext<TenantAdminSessionValue | null>(null);

export function TenantAdminSessionProvider({
  children,
  onUnauthorized,
}: {
  children: ReactNode;
  onUnauthorized: () => void;
}): JSX.Element {
  const fallbackApi = useMemo(() => publicEnv().apiBaseUrl, []);
  const [token, setToken] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState(fallbackApi);
  const [me, setMe] = useState<TenantAdminSessionMe | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  useEffect(() => {
    const auth = readStoredAuth();
    if (!auth) {
      onUnauthorized();
      return;
    }
    if (auth.expires_at < Math.floor(Date.now() / 1000)) {
      clearStoredAuth();
      onUnauthorized();
      return;
    }
    setToken(auth.access_token);
    setApiBase(auth.api_base_url ?? fallbackApi);
    applyPlatformTheme();
  }, [fallbackApi, onUnauthorized]);

  const refreshMe = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoadingMe(true);
    try {
      const res = await fetch(`${apiBase}/admin/tenant/desk/me`, {
        cache: 'no-store',
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setMe(null);
        return;
      }
      setMe((await res.json()) as TenantAdminSessionMe);
    } catch {
      setMe(null);
    } finally {
      setLoadingMe(false);
    }
  }, [apiBase, token]);

  useEffect(() => {
    if (token) {
      void refreshMe();
    }
  }, [refreshMe, token]);

  const logout = useCallback(() => {
    clearStoredAuth();
    onUnauthorized();
  }, [onUnauthorized]);

  if (!token) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-6">
        <p className="text-sm text-ink-secondary">Checking session…</p>
      </div>
    );
  }

  return (
    <TenantAdminSessionContext.Provider
      value={{ token, apiBase, me, loadingMe, refreshMe, logout }}
    >
      {children}
    </TenantAdminSessionContext.Provider>
  );
}

export function useTenantAdminSession(): TenantAdminSessionValue {
  const ctx = useContext(TenantAdminSessionContext);
  if (!ctx) {
    throw new Error('useTenantAdminSession must be used within TenantAdminSessionProvider');
  }
  return ctx;
}
