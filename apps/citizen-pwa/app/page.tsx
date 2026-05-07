'use client';

import { t } from '@enagar/i18n';
import { applyTenantTheme } from '@enagar/tenant-theme';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type LanguageCode = 'en' | 'bn' | 'hi';
type Step = 'splash' | 'language' | 'login' | 'otp' | 'tenant' | 'home';

interface TenantSummary {
  id: string;
  code: string;
  name: string;
  district: string;
  ward_count: number;
  theme_color: string;
  logo_url: string | null;
  languages_enabled: LanguageCode[];
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

async function storeEncryptedToken(token: TokenResponse): Promise<void> {
  const payload = JSON.stringify({
    ...token,
    stored_at: new Date().toISOString(),
  });

  if (!globalThis.crypto?.subtle) {
    sessionStorage.setItem('enagar.auth.dev', payload);
    return;
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('enagarseba-sprint-1.3-browser-key'),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(payload),
  );

  sessionStorage.setItem(
    'enagar.auth',
    JSON.stringify({
      salt: Array.from(salt),
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(encrypted)),
    }),
  );
}

export default function HomePage(): JSX.Element {
  const [step, setStep] = useState<Step>('splash');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState<TokenResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [status, setStatus] = useState(t('status.ready', 'en'));

  const tenantCards = useMemo(
    () =>
      tenants.map((tenant) => ({ ...tenant, shortName: tenant.name.replace(' Municipal', '') })),
    [tenants],
  );

  useEffect(() => {
    if (step !== 'tenant') {
      return;
    }

    void fetch(`${apiBaseUrl}/tenants`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load tenants');
        }
        return response.json() as Promise<TenantSummary[]>;
      })
      .then(setTenants)
      .catch((error: Error) => setStatus(error.message));
  }, [step]);

  async function requestOtp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus(t('status.sendingOtp', language));

    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/auth/send-otp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenant_code: 'KMC', mobile }),
      });
    } catch {
      setStatus(t('status.apiUnreachable', language));
      return;
    }

    if (!response.ok) {
      setStatus('Could not send OTP. Check API/Keycloak.');
      return;
    }

    setStatus(t('status.otpSent', language));
    setStep('otp');
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus('Verifying OTP...');

    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenant_code: 'KMC', mobile, otp }),
      });
    } catch {
      setStatus(t('status.apiUnreachable', language));
      return;
    }

    if (!response.ok) {
      setStatus(t('status.otpKeycloakRequired', language));
      return;
    }

    const nextToken = (await response.json()) as TokenResponse;
    setToken(nextToken);
    await storeEncryptedToken(nextToken);
    setStatus(t('status.loginVerified', language));
    setStep('tenant');
  }

  async function chooseTenant(tenant: TenantSummary): Promise<void> {
    setSelectedTenant(tenant);
    applyTenantTheme(tenant);

    if (token?.access_token) {
      try {
        await fetch(`${apiBaseUrl}/citizen/select-tenant`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token.access_token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ tenant_code: tenant.code }),
        });
      } catch {
        setStatus(t('status.tenantSelectedLocal', language));
      }
    }

    setStep('home');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          {t('app.badge', language)}
        </span>
        <span className="text-sm text-slate-500">{status}</span>
      </header>

      {step === 'splash' && (
        <section className="grid flex-1 items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight text-slate-950 md:text-6xl">
              {t('splash.title', language)}
            </h1>
            <p className="max-w-xl text-lg text-slate-600">{t('splash.subtitle', language)}</p>
            <button
              className="rounded-2xl bg-brand px-5 py-3 font-semibold text-white"
              onClick={() => setStep('language')}
            >
              {t('action.continue', language)}
            </button>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
            <div className="rounded-[1.5rem] bg-brand/10 p-6 text-brand">
              <p className="text-sm font-semibold uppercase">Empty Home Preview</p>
              <p className="mt-16 text-2xl font-bold">
                Services, applications, payments, and grievances arrive next.
              </p>
            </div>
          </div>
        </section>
      )}

      {step === 'language' && (
        <section className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">{t('language.title', language)}</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {(['en', 'bn', 'hi'] as const).map((code) => (
              <button
                className={`rounded-2xl border p-4 text-left ${language === code ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200'}`}
                key={code}
                onClick={() => setLanguage(code)}
              >
                <span className="block font-semibold">{code.toUpperCase()}</span>
                <span className="text-sm text-slate-500">{t('splash.title', code)}</span>
              </button>
            ))}
          </div>
          <button
            className="mt-6 rounded-2xl bg-brand px-5 py-3 font-semibold text-white"
            onClick={() => setStep('login')}
          >
            {t('language.continue', language)}
          </button>
        </section>
      )}

      {step === 'login' && (
        <form
          className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-sm"
          onSubmit={requestOtp}
        >
          <h2 className="text-2xl font-bold">{t('login.title', language)}</h2>
          <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="mobile">
            {t('login.mobile', language)}
          </label>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            id="mobile"
            inputMode="numeric"
            maxLength={10}
            onChange={(event) => setMobile(event.target.value)}
            placeholder="9876543210"
            value={mobile}
          />
          <button
            className="mt-6 w-full rounded-2xl bg-brand px-5 py-3 font-semibold text-white"
            type="submit"
          >
            {t('login.sendOtp', language)}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form
          className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-sm"
          onSubmit={verifyOtp}
        >
          <h2 className="text-2xl font-bold">{t('otp.title', language)}</h2>
          <input
            className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3"
            inputMode="numeric"
            maxLength={8}
            onChange={(event) => setOtp(event.target.value)}
            placeholder="Enter OTP"
            value={otp}
          />
          <button
            className="mt-6 w-full rounded-2xl bg-brand px-5 py-3 font-semibold text-white"
            type="submit"
          >
            {t('otp.submit', language)}
          </button>
        </form>
      )}

      {step === 'tenant' && (
        <section>
          <h2 className="text-3xl font-bold">{t('tenant.title', language)}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {tenantCards.map((tenant) => (
              <button
                className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                key={tenant.id}
                onClick={() => void chooseTenant(tenant)}
              >
                <span
                  className="block h-2 w-16 rounded-full"
                  style={{ backgroundColor: tenant.theme_color }}
                />
                <span className="mt-4 block text-lg font-bold">{tenant.code}</span>
                <span className="mt-1 block text-sm text-slate-600">{tenant.shortName}</span>
                <span className="mt-4 block text-sm font-medium text-slate-500">
                  {tenant.ward_count} wards
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'home' && selectedTenant && (
        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase text-brand">{t('home.label', language)}</p>
          <h2 className="mt-2 text-3xl font-bold">{selectedTenant.name}</h2>
          <p className="mt-2 text-slate-600">{t('home.empty', language)}</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <span className="text-sm text-slate-500">{t('home.wards', language)}</span>
              <strong className="block text-2xl">{selectedTenant.ward_count}</strong>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <span className="text-sm text-slate-500">{t('home.language', language)}</span>
              <strong className="block text-2xl">{language.toUpperCase()}</strong>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <span className="text-sm text-slate-500">{t('home.tokenStorage', language)}</span>
              <strong className="block text-2xl">{t('home.tokenEncrypted', language)}</strong>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
