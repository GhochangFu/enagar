import type { Locale } from '@enagar/i18n';
import { resolveLocale } from '@enagar/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import type { TenantListItem } from '../tenantApi';

const LEGACY_SELECTED_TENANT_KEY = '@enagar/mobile/selected-tenant-json';

function tokenAccessKey(): string {
  return Platform.OS === 'web' ? '@enagar/public/access_token' : 'enagar.access_token';
}

function tokenRefreshKey(): string {
  return Platform.OS === 'web' ? '@enagar/public/refresh_token' : 'enagar.refresh_token';
}

async function persistSecret(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

async function readSecret(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function deleteSecret(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /** ignore missing */
  }
}

/** Expo injects `EXPO_PUBLIC_*` at bundle time. */
export function sessionApiRoot(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL;
  const base =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim().replace(/\/$/, '') : '';
  return base.length > 0 ? base : 'http://localhost:3001/api';
}

type SessionState = {
  locale: Locale;
  setLocale: (lng: Locale) => void;
  selectedTenant: TenantListItem | null;
  selectTenant: (tenant: TenantListItem | null) => void;
  accessToken: string | null;
  refreshToken: string | null;
  mobile: string | null;
  setTokens: (tokens: {
    accessToken: string;
    refreshToken?: string | null | undefined;
    mobileDigits: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Hydrate tokens + municipality from persistence; resolves when React state caught up. */
  restoreSession: () => Promise<boolean>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => resolveLocale(undefined));
  const [selectedTenant, setSelectedTenantState] = useState<TenantListItem | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshTokenState] = useState<string | null>(null);
  const [mobile, setMobile] = useState<string | null>(null);

  const setLocale = useCallback((lng: Locale) => {
    setLocaleState(lng);
  }, []);

  const selectTenant = useCallback((tenant: TenantListItem | null) => {
    setSelectedTenantState(tenant);
    void AsyncStorage.setItem(LEGACY_SELECTED_TENANT_KEY, tenant ? JSON.stringify(tenant) : '');
  }, []);

  const setTokens = useCallback(
    async (tokens: { accessToken: string; refreshToken?: string | null; mobileDigits: string }) => {
      setAccessToken(tokens.accessToken);
      const rt = tokens.refreshToken ?? null;
      setRefreshTokenState(rt);
      setMobile(tokens.mobileDigits);
      await persistSecret(tokenAccessKey(), tokens.accessToken);
      if (typeof rt === 'string' && rt.length > 0) {
        await persistSecret(tokenRefreshKey(), rt);
      }
      await AsyncStorage.setItem('@enagar/mobile/citizen-mobile', tokens.mobileDigits);
    },
    [],
  );

  const signOut = useCallback(async () => {
    setAccessToken(null);
    setRefreshTokenState(null);
    setMobile(null);
    await deleteSecret(tokenAccessKey());
    await deleteSecret(tokenRefreshKey());
    await AsyncStorage.removeItem('@enagar/mobile/citizen-mobile');
  }, []);

  const restoreSession = useCallback(async (): Promise<boolean> => {
    const tenantRaw = await AsyncStorage.getItem(LEGACY_SELECTED_TENANT_KEY);
    let tenantOk = false;
    if (tenantRaw && tenantRaw.length > 0) {
      try {
        const row = JSON.parse(tenantRaw) as TenantListItem;
        if (row && typeof row.code === 'string') {
          setSelectedTenantState(row);
          tenantOk = true;
        }
      } catch {
        /** ignore corrupted */
      }
    }

    const at = await readSecret(tokenAccessKey());
    const rt = await readSecret(tokenRefreshKey());
    const mob = await AsyncStorage.getItem('@enagar/mobile/citizen-mobile');
    const recovered = !!(at && mob && mob.length >= 10 && tenantOk);
    if (recovered && at && mob) {
      setAccessToken(at);
      setRefreshTokenState(rt);
      setMobile(mob);
    }
    return recovered;
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      locale,
      setLocale,
      selectedTenant,
      selectTenant,
      accessToken,
      refreshToken,
      mobile,
      setTokens,
      signOut,
      restoreSession,
    }),
    [
      accessToken,
      locale,
      mobile,
      refreshToken,
      restoreSession,
      selectTenant,
      setLocale,
      setTokens,
      signOut,
      selectedTenant,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession requires SessionProvider');
  }
  return ctx;
}
