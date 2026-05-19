'use client';

import { t } from '@enagar/i18n';
import { Badge, Button, Card } from '@enagar/ui';

import type { PwaLocaleCode } from '../lib/workspace-types';
import type { FormEvent, JSX } from 'react';

type TenantOption = {
  code: string;
  name: string;
  district: string;
  theme_color: string;
};

type AuthLanguage = PwaLocaleCode;

export function CitizenAuthFrame({
  children,
  status,
}: {
  children: JSX.Element;
  status: string;
}): JSX.Element {
  return (
    <section className="relative isolate -mx-6 -my-10 flex min-h-screen items-center overflow-hidden bg-canvas px-6 py-10">
      <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-peach-accent" />
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-5">
          <Badge
            className="border-sage/40 bg-sage uppercase tracking-[0.24em] text-ink-primary"
            tone="neutral"
          >
            eNagarSeba
          </Badge>
          <h1 className="max-w-2xl text-4xl font-black leading-tight text-ink-primary md:text-6xl">
            One calm place for every municipal service.
          </h1>
          <p className="max-w-xl text-base leading-7 text-ink-secondary md:text-lg">
            Pin your municipalities, track applications, pay fees, and open service workspaces
            without losing context.
          </p>
          <p className="inline-flex rounded-full border border-warm-border bg-white/75 px-4 py-2 text-sm font-semibold text-ink-secondary shadow-sm">
            {status}
          </p>
        </div>
        {children}
      </div>
    </section>
  );
}

export function SplashStep({
  language,
  onContinue,
  status,
}: {
  language: AuthLanguage;
  onContinue: () => void;
  status: string;
}): JSX.Element {
  return (
    <CitizenAuthFrame status={status}>
      <Card className="border border-warm-border bg-surface p-7 shadow-lg" padding="none">
        <div className="rounded-[1.75rem] bg-mint-band p-6 text-forest">
          <p className="text-xs font-bold uppercase tracking-[0.24em]">Citizen Services Preview</p>
          <p className="mt-16 text-2xl font-black leading-tight">
            Services, applications, documents, payments, and timelines in one place.
          </p>
        </div>
        <Button className="mt-6 w-full" onClick={onContinue} size="lg">
          {t('action.continue', language)}
        </Button>
      </Card>
    </CitizenAuthFrame>
  );
}

export function LanguageStep({
  language,
  onContinue,
  onSelectLanguage,
  status,
}: {
  language: AuthLanguage;
  onContinue: () => void;
  onSelectLanguage: (language: AuthLanguage) => void;
  status: string;
}): JSX.Element {
  return (
    <CitizenAuthFrame status={status}>
      <Card className="border border-warm-border bg-surface p-7 shadow-lg" padding="none">
        <h2 className="text-2xl font-black text-ink-primary">{t('language.title', language)}</h2>
        <div className="mt-6 grid gap-3">
          {(['en', 'bn', 'hi'] as const).map((code) => (
            <button
              className={`rounded-3xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                language === code
                  ? 'border-brand bg-brand-muted text-brand shadow-sm'
                  : 'border-warm-border bg-white text-ink-primary hover:border-brand/40'
              }`}
              key={code}
              onClick={() => onSelectLanguage(code)}
              type="button"
            >
              <span className="block text-sm font-black uppercase tracking-[0.18em]">
                {code.toUpperCase()}
              </span>
              <span className="mt-1 block text-sm text-ink-secondary">
                {t('splash.title', code)}
              </span>
            </button>
          ))}
        </div>
        <Button className="mt-6 w-full" onClick={onContinue} size="lg">
          {t('language.continue', language)}
        </Button>
      </Card>
    </CitizenAuthFrame>
  );
}

export function LoginStep({
  language,
  mobile,
  onMobileChange,
  onSubmit,
  status,
}: {
  language: AuthLanguage;
  mobile: string;
  onMobileChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: string;
}): JSX.Element {
  return (
    <CitizenAuthFrame status={status}>
      <Card className="border border-warm-border bg-surface p-7 shadow-lg" padding="none">
        <form onSubmit={onSubmit}>
          <h2 className="text-2xl font-black text-ink-primary">{t('login.title', language)}</h2>
          <label className="mt-6 block text-sm font-semibold text-ink-secondary" htmlFor="mobile">
            {t('login.mobile', language)}
          </label>
          <input
            className="mt-2 w-full rounded-3xl border border-warm-border bg-white px-4 py-4 text-lg font-semibold tracking-[0.2em] text-ink-primary outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
            id="mobile"
            inputMode="numeric"
            maxLength={10}
            onChange={(event) => onMobileChange(event.target.value)}
            placeholder="9876543210"
            value={mobile}
          />
          <Button className="mt-6 w-full" size="lg" type="submit">
            {t('login.sendOtp', language)}
          </Button>
        </form>
      </Card>
    </CitizenAuthFrame>
  );
}

export function OtpStep({
  language,
  mobile,
  otp,
  onOtpChange,
  onSubmit,
  status,
}: {
  language: AuthLanguage;
  mobile: string;
  otp: string;
  onOtpChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: string;
}): JSX.Element {
  return (
    <CitizenAuthFrame status={status}>
      <Card className="border border-warm-border bg-surface p-7 shadow-lg" padding="none">
        <form onSubmit={onSubmit}>
          <Badge tone="brand">OTP sent to {mobile || 'your mobile'}</Badge>
          <h2 className="mt-4 text-2xl font-black text-ink-primary">{t('otp.title', language)}</h2>
          <input
            className="mt-6 w-full rounded-3xl border border-warm-border bg-white px-4 py-4 text-center text-3xl font-black tracking-[0.45em] text-ink-primary outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
            inputMode="numeric"
            maxLength={8}
            onChange={(event) => onOtpChange(event.target.value)}
            placeholder="12345"
            value={otp}
          />
          <p className="mt-3 text-xs font-medium text-ink-secondary">
            Dev smoke uses OTP 12345 when DEV_AUTH_ENABLED is active.
          </p>
          <Button className="mt-6 w-full" size="lg" type="submit">
            {t('otp.submit', language)}
          </Button>
        </form>
      </Card>
    </CitizenAuthFrame>
  );
}

export function PinMunicipalitiesStep({
  language,
  pinsDraftCodes,
  pinsSearch,
  tenants,
  tokenPresent,
  onContinue,
  onPinsSearchChange,
  onTogglePin,
  status,
}: {
  language: AuthLanguage;
  pinsDraftCodes: string[];
  pinsSearch: string;
  tenants: TenantOption[];
  tokenPresent: boolean;
  onContinue: () => void;
  onPinsSearchChange: (value: string) => void;
  onTogglePin: (code: string) => void;
  status: string;
}): JSX.Element {
  return (
    <CitizenAuthFrame status={status}>
      <Card
        className="flex max-h-[78vh] flex-col overflow-hidden border border-warm-border bg-surface p-7 shadow-lg"
        padding="none"
      >
        <header>
          <Badge tone="brand">First-time hub access</Badge>
          <h2 className="mt-3 text-3xl font-black text-ink-primary">Pin your municipalities</h2>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">
            Pick at least one operational ULB. Pins are shortcuts only; you can browse every
            municipality later.
          </p>
        </header>
        <label className="mt-5 block text-sm font-semibold text-ink-secondary">
          Search by code, name, or district
          <input
            className="mt-2 w-full rounded-3xl border border-warm-border px-4 py-3 outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
            onChange={(event) => onPinsSearchChange(event.target.value)}
            placeholder="Try KMC or Kolkata..."
            type="search"
            value={pinsSearch}
          />
        </label>
        <p className="mt-4 text-sm text-ink-secondary">
          Selected <strong>({pinsDraftCodes.length} / 15)</strong>
          {pinsDraftCodes.length ? `: ${pinsDraftCodes.join(', ')}` : ''}
        </p>
        <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-2">
          {tenants.map((tenant) => {
            const active = pinsDraftCodes.includes(tenant.code);
            const disabledPick = !active && pinsDraftCodes.length >= 15;
            return (
              <li key={tenant.code}>
                <button
                  className={`grid w-full grid-cols-[0.4rem_1fr_auto] items-center gap-3 rounded-3xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                    active
                      ? 'border-brand bg-brand-muted text-brand'
                      : 'border-warm-border bg-white text-ink-primary hover:border-brand/40'
                  } ${disabledPick ? 'cursor-not-allowed opacity-60' : ''}`}
                  disabled={disabledPick}
                  onClick={() => onTogglePin(tenant.code)}
                  type="button"
                >
                  <span
                    aria-hidden
                    className="h-full min-h-12 rounded-full"
                    style={{ backgroundColor: tenant.theme_color }}
                  />
                  <span>
                    <span className="block font-black">{tenant.code}</span>
                    <span className="mt-1 block text-sm text-ink-secondary">{tenant.name}</span>
                    <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-slate-400">
                      {tenant.district}
                    </span>
                  </span>
                  <span className="text-xs font-black">{active ? 'Pinned' : 'Pin'}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 shrink-0 border-t border-warm-border bg-surface pt-4">
          <Button
            className="w-full"
            disabled={pinsDraftCodes.length === 0 || !tokenPresent}
            onClick={onContinue}
            size="lg"
          >
            Continue to hub
          </Button>
          <p className="mt-3 text-center text-xs text-ink-secondary">
            {pinsDraftCodes.length
              ? `${pinsDraftCodes.length} pinned - continue to your citizen hub.`
              : t('language.continue', language)}
          </p>
        </div>
      </Card>
    </CitizenAuthFrame>
  );
}
