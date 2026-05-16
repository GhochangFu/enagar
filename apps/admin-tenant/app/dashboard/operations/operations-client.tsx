'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { publicEnv } from '../../../lib/env/public-env';
import {
  ADMIN_OAUTH_STORAGE_KEY,
  type AdminOAuthBundle,
} from '../../../lib/oauth/session-storage-keys';

import type { ReactNode } from 'react';

type SettingsRow = {
  tenant_code?: string;
  branding: unknown;
  feature_flags: unknown;
  languages_enabled: string[];
  default_language: string;
  contact_phone: string | null;
  contact_email: string | null;
};

type NotificationTemplateRow = {
  id: string;
  code: string;
  channel: string;
  locale: string;
  trigger: string;
  subject: string | null;
  body: string;
  variables: unknown;
  is_active: boolean;
};

type BannerRow = {
  id: string;
  code: string;
  severity: 'info' | 'warning' | 'critical' | string;
  title: unknown;
  body: unknown;
  link_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  updated_at: string;
};

type TemplateDraft = {
  code: string;
  channel: string;
  locale: string;
  trigger: string;
  subject: string;
  body: string;
  variables: string[];
  sampleValues: Record<string, string>;
  is_active: boolean;
};

type KbArticleRow = {
  id: string;
  slug: string;
  title: unknown;
  body: unknown;
  tags: string[];
  status: string;
  published_at: string | null;
  index_status: string | null;
  index_updated_at: string | null;
};

type BrandingAssetRow = {
  id: string;
  code: string;
  kind: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  contrast_warnings: string[];
};

type BookingsPayload = {
  assets: BookableAssetRow[];
  availability: AvailabilityRow[];
  reservations: ReservationRow[];
};

type BookableAssetRow = {
  id: string;
  code: string;
  name: unknown;
  capacity: number | null;
  is_active: boolean;
};

type AvailabilityRow = {
  id: string;
  asset_code: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
};

type ReservationRow = {
  id: string;
  asset_code: string;
  docket_no: string | null;
  holder_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

type RoleRow = {
  code: string;
  name: string;
};

type StaffRow = {
  id: string;
  username: string;
  display_name: string;
  status: string;
  roles: Array<{ code: string; ward_number: string | null }>;
};

type RoleStageMapRow = {
  id: string;
  workflow_code: string;
  stage_code: string;
  role_code: string;
  can_view: boolean;
  can_act: boolean;
};

function readStoredAuth(): AdminOAuthBundle | null {
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

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Untitled';
  }
  return typeof json === 'string' ? json : 'Untitled';
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function asLocaleMap(en: string): Record<'en' | 'bn' | 'hi', string> {
  return { en, bn: en, hi: en };
}

function extractTemplateVariables(subject: string, body: string): string[] {
  return [
    ...new Set(
      [...`${subject}\n${body}`.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g)]
        .map((match) => match[1])
        .filter((value): value is string => typeof value === 'string'),
    ),
  ];
}

function renderTemplatePreview(template: string, samples: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g, (_, key: string) => {
    return samples[key] || `[${key}]`;
  });
}

export default function OperationsClient(): JSX.Element {
  const router = useRouter();
  const fallbackApi = useMemo(() => publicEnv().apiBaseUrl, []);

  const [token, setToken] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState(fallbackApi);
  const [status, setStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplateRow[]>([]);
  const [kbArticles, setKbArticles] = useState<KbArticleRow[]>([]);
  const [brandingAssets, setBrandingAssets] = useState<BrandingAssetRow[]>([]);
  const [bookings, setBookings] = useState<BookingsPayload>({
    assets: [],
    availability: [],
    reservations: [],
  });
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [roleStageMaps, setRoleStageMaps] = useState<RoleStageMapRow[]>([]);

  const [settingsText, setSettingsText] = useState(
    pretty({
      branding: {
        theme_color: '#0f766e',
        logo_url: '',
        hero_image_url: '',
      },
      feature_flags: {
        kb_cms: true,
        notification_templates: true,
        staff_roles: true,
      },
      languages_enabled: ['en', 'bn', 'hi'],
      default_language: 'en',
      contact_phone: '',
      contact_email: '',
    }),
  );
  const [bannerDraft, setBannerDraft] = useState({
    code: 'maintenance-notice',
    severity: 'warning',
    title: 'Scheduled maintenance',
    body: 'Some services may be briefly unavailable tonight.',
    link_url: '',
    starts_at: '',
    ends_at: '',
    is_active: true,
  });
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>({
    code: 'application-submitted',
    channel: 'sms',
    locale: 'en',
    trigger: 'application-submitted',
    subject: '',
    body: 'Your {{service_name}} application {{docket_no}} has been submitted.',
    variables: ['service_name', 'docket_no'],
    sampleValues: {
      service_name: 'Birth Certificate',
      docket_no: 'WBM/KMC/birth-cert/2026/00001',
    },
    is_active: true,
  });
  const [templateText, setTemplateText] = useState(
    pretty({
      code: 'application-submitted',
      channel: 'sms',
      locale: 'en',
      trigger: 'application-submitted',
      subject: null,
      body: 'Your {{service_name}} application {{docket_no}} has been submitted.',
      variables: ['service_name', 'docket_no'],
      is_active: true,
    }),
  );
  const [kbText, setKbText] = useState(
    pretty({
      slug: 'birth-certificate-help',
      title: {
        en: 'Birth certificate help',
        bn: 'Birth certificate help',
        hi: 'Birth certificate help',
      },
      body: {
        en: 'Explain documents, fees, and SLA for birth certificate applications.',
        bn: 'Explain documents, fees, and SLA for birth certificate applications.',
        hi: 'Explain documents, fees, and SLA for birth certificate applications.',
      },
      tags: ['certificates', 'birth'],
      status: 'published',
    }),
  );
  const [kbDraft, setKbDraft] = useState({
    slug: 'birth-certificate-help',
    title_en: 'Birth certificate help',
    body_en: 'Explain documents, fees, and SLA for birth certificate applications.',
    tags: 'certificates,birth',
    status: 'published',
  });
  const [brandingAssetText, setBrandingAssetText] = useState(
    pretty({
      code: 'kmc-logo',
      kind: 'logo',
      storage_key: 'KMC/branding/kmc-logo.png',
      public_url: 'https://assets.example.local/KMC/branding/kmc-logo.png',
      mime_type: 'image/png',
      size_bytes: '120000',
      width: '512',
      height: '512',
      metadata: {},
    }),
  );
  const [bookingAssetText, setBookingAssetText] = useState(
    pretty({
      code: 'community-hall-main',
      name: asLocaleMap('Community Hall Main'),
      location: { ward: '001', address: 'Main municipal hall' },
      capacity: '120',
      is_active: true,
      metadata: {},
    }),
  );
  const [bookingAvailabilityText, setBookingAvailabilityText] = useState(
    pretty({
      asset_code: 'community-hall-main',
      kind: 'available',
      starts_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString(),
      note: 'General booking window',
    }),
  );
  const [bookingReservationText, setBookingReservationText] = useState(
    pretty({
      asset_code: 'community-hall-main',
      holder_name: 'Citizen booking smoke',
      holder_mobile: '',
      docket_no: '',
      starts_at: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString(),
      status: 'hold',
      note: 'Smoke reservation',
    }),
  );
  const [staffText, setStaffText] = useState(
    pretty({
      keycloak_user_id: '10000000-0000-4000-8000-000000000201',
      username: 'kmc-tenant-clerk-demo',
      display_name: 'KMC Tenant Clerk Demo',
      email: '',
      mobile: '',
      status: 'active',
      role_codes: ['tenant_clerk'],
    }),
  );
  const [roleStageText, setRoleStageText] = useState(
    pretty({
      workflow_code: 'birth-cert-workflow-v1',
      stage_code: 'document-verification',
      role_code: 'tenant_clerk',
      can_view: true,
      can_act: true,
    }),
  );

  useEffect(() => {
    const auth = readStoredAuth();
    if (!auth) {
      router.replace('/login');
      return;
    }
    if (auth.expires_at < Math.floor(Date.now() / 1000)) {
      sessionStorage.removeItem(ADMIN_OAUTH_STORAGE_KEY);
      router.replace('/login?error=session_expired');
      return;
    }
    setToken(auth.access_token);
    setApiBase(auth.api_base_url ?? fallbackApi);
  }, [fallbackApi, router]);

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  function redirectIfUnauthorized(res: Response): boolean {
    if (res.status !== 401) {
      return false;
    }
    sessionStorage.removeItem(ADMIN_OAUTH_STORAGE_KEY);
    router.replace('/login?error=session_expired');
    return true;
  }

  const loadOperations = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const [
        settingsRes,
        bannersRes,
        templatesRes,
        kbRes,
        brandingAssetsRes,
        bookingsRes,
        rolesRes,
        staffRes,
        mapsRes,
      ] = await Promise.all([
        fetch(`${apiBase}/admin/tenant/settings`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/banners`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/notification-templates`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/kb-articles`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/branding-assets`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/bookings`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/roles`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/staff`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/role-stage-maps`, { headers: authHeaders() }),
      ]);
      if (
        [
          settingsRes,
          bannersRes,
          templatesRes,
          kbRes,
          brandingAssetsRes,
          bookingsRes,
          rolesRes,
          staffRes,
          mapsRes,
        ].some((res) => res.status === 401)
      ) {
        sessionStorage.removeItem(ADMIN_OAUTH_STORAGE_KEY);
        router.replace('/login?error=session_expired');
        return;
      }
      if (
        !settingsRes.ok ||
        !bannersRes.ok ||
        !templatesRes.ok ||
        !kbRes.ok ||
        !brandingAssetsRes.ok ||
        !bookingsRes.ok ||
        !rolesRes.ok ||
        !staffRes.ok ||
        !mapsRes.ok
      ) {
        setStatus(
          `Operations load failed (${settingsRes.status}/${bannersRes.status}/${templatesRes.status}/${kbRes.status}/${brandingAssetsRes.status}/${bookingsRes.status}/${rolesRes.status}/${staffRes.status}/${mapsRes.status}).`,
        );
        return;
      }
      const settingsJson = (await settingsRes.json()) as SettingsRow;
      setSettings(settingsJson);
      setSettingsText(
        pretty({
          branding: settingsJson.branding,
          feature_flags: settingsJson.feature_flags,
          languages_enabled: settingsJson.languages_enabled,
          default_language: settingsJson.default_language,
          contact_phone: settingsJson.contact_phone ?? '',
          contact_email: settingsJson.contact_email ?? '',
        }),
      );
      setBanners((await bannersRes.json()) as BannerRow[]);
      setTemplates((await templatesRes.json()) as NotificationTemplateRow[]);
      setKbArticles((await kbRes.json()) as KbArticleRow[]);
      setBrandingAssets((await brandingAssetsRes.json()) as BrandingAssetRow[]);
      setBookings((await bookingsRes.json()) as BookingsPayload);
      setRoles((await rolesRes.json()) as RoleRow[]);
      setStaff((await staffRes.json()) as StaffRow[]);
      setRoleStageMaps((await mapsRes.json()) as RoleStageMapRow[]);
      setStatus(null);
    } catch {
      setStatus('Network error loading tenant operations.');
    }
  }, [apiBase, authHeaders, router, token]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  async function upsert(path: string, bodyText: string, label: string): Promise<void> {
    if (!token) {
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      setStatus(`${label} JSON is invalid.`);
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/${path}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) {
        return;
      }
      const text = await res.text().catch(() => '');
      setStatus(`${label} save failed (${res.status}). ${text.slice(0, 220)}`);
      return;
    }
    setStatus(`${label} saved.`);
    await loadOperations();
  }

  async function saveBanner(): Promise<void> {
    if (!token) {
      return;
    }
    const payload = {
      code: bannerDraft.code,
      severity: bannerDraft.severity,
      title: asLocaleMap(bannerDraft.title),
      body: asLocaleMap(bannerDraft.body),
      link_url: bannerDraft.link_url,
      starts_at: bannerDraft.starts_at,
      ends_at: bannerDraft.ends_at,
      is_active: bannerDraft.is_active,
    };
    const res = await fetch(`${apiBase}/admin/tenant/banners`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) {
        return;
      }
      const text = await res.text().catch(() => '');
      setStatus(`Banner save failed (${res.status}). ${text.slice(0, 220)}`);
      return;
    }
    setStatus('Maintenance banner saved.');
    await loadOperations();
  }

  async function saveTemplateDraft(): Promise<void> {
    if (!token) {
      return;
    }
    const variables = extractTemplateVariables(templateDraft.subject, templateDraft.body);
    const payload = {
      code: templateDraft.code,
      channel: templateDraft.channel,
      locale: templateDraft.locale,
      trigger: templateDraft.trigger,
      subject: templateDraft.subject || null,
      body: templateDraft.body,
      variables,
      is_active: templateDraft.is_active,
    };
    const res = await fetch(`${apiBase}/admin/tenant/notification-templates`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) {
        return;
      }
      const text = await res.text().catch(() => '');
      setStatus(`Notification template save failed (${res.status}). ${text.slice(0, 220)}`);
      return;
    }
    setTemplateDraft((prev) => ({ ...prev, variables }));
    setTemplateText(pretty(payload));
    setStatus('Notification template saved.');
    await loadOperations();
  }

  async function saveKbDraft(): Promise<void> {
    const payload = {
      slug: kbDraft.slug,
      title: asLocaleMap(kbDraft.title_en),
      body: asLocaleMap(kbDraft.body_en),
      tags: kbDraft.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      status: kbDraft.status,
    };
    const res = await fetch(`${apiBase}/admin/tenant/kb-articles`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) return;
      const text = await res.text().catch(() => '');
      setStatus(`KB article save failed (${res.status}). ${text.slice(0, 220)}`);
      return;
    }
    setKbText(pretty(payload));
    setStatus('KB article saved.');
    await loadOperations();
  }

  async function requeueKb(slug: string): Promise<void> {
    const res = await fetch(`${apiBase}/admin/tenant/kb-articles/requeue-index`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) return;
      const text = await res.text().catch(() => '');
      setStatus(`KB index requeue failed (${res.status}). ${text.slice(0, 220)}`);
      return;
    }
    setStatus(`KB article ${slug} queued for indexing.`);
    await loadOperations();
  }

  async function saveJsonEndpoint(
    path: string,
    bodyText: string,
    method: 'PATCH' | 'POST',
    label: string,
  ): Promise<void> {
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      setStatus(`${label} JSON is invalid.`);
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/${path}`, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) return;
      const text = await res.text().catch(() => '');
      setStatus(`${label} save failed (${res.status}). ${text.slice(0, 220)}`);
      return;
    }
    setStatus(`${label} saved.`);
    await loadOperations();
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-slate-600">Checking session...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm text-slate-500 underline">
            Back to dashboard
          </Link>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
            Sprint 6.4 · Tenant operations
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            Templates, KB, branding, flags, and staff
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {settings?.tenant_code ? (
              <>
                Municipality <span className="font-mono">{settings.tenant_code}</span>
              </>
            ) : (
              'Tenant-scoped configuration'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/masters"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Masters
          </Link>
          <button
            type="button"
            onClick={() => void loadOperations()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {status ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {status}
        </p>
      ) : null}

      <section className="mb-6">
        <BannerEditor
          draft={bannerDraft}
          onChange={setBannerDraft}
          onSave={() => void saveBanner()}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <OperationsEditor
          title="Branding, languages, and feature flags"
          value={settingsText}
          onChange={setSettingsText}
          onSave={() => void upsert('settings', settingsText, 'Settings')}
        />
        <TemplatePreviewEditor
          draft={templateDraft}
          jsonValue={templateText}
          onDraftChange={setTemplateDraft}
          onJsonChange={setTemplateText}
          onJsonSave={() =>
            void upsert('notification-templates', templateText, 'Notification template')
          }
          onSave={() => void saveTemplateDraft()}
        />
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Sprint 6.11 · Rich KB authoring
              </p>
              <h2 className="text-lg font-semibold text-slate-900">Guided KB article</h2>
              <p className="mt-1 text-sm text-slate-600">
                Markdown-safe fields with preview; JSON fallback remains below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void saveKbDraft()}
              className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white"
            >
              Save KB
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(
              [
                ['slug', 'Slug'],
                ['title_en', 'Title EN'],
                ['tags', 'Tags comma-separated'],
              ] as Array<[keyof Pick<typeof kbDraft, 'slug' | 'title_en' | 'tags'>, string]>
            ).map(([key, label]) => (
              <label
                key={key}
                className="text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                {label}
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
                  value={String(kbDraft[key as keyof typeof kbDraft])}
                  onChange={(event) =>
                    setKbDraft((draft) => ({ ...draft, [key]: event.target.value }))
                  }
                />
              </label>
            ))}
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Status
              <select
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
                value={kbDraft.status}
                onChange={(event) =>
                  setKbDraft((draft) => ({ ...draft, status: event.target.value }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Body markdown
            <textarea
              className="mt-1 h-28 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
              value={kbDraft.body_en}
              onChange={(event) =>
                setKbDraft((draft) => ({ ...draft, body_en: event.target.value }))
              }
            />
          </label>
          <div className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold">{kbDraft.title_en}</p>
            <p className="mt-1 whitespace-pre-wrap">{kbDraft.body_en}</p>
          </div>
        </article>
        <OperationsEditor
          title="Knowledge-base article JSON fallback"
          value={kbText}
          onChange={setKbText}
          onSave={() => void upsert('kb-articles', kbText, 'KB article')}
        />
        <OperationsEditor
          title="Branding asset registration"
          value={brandingAssetText}
          onChange={setBrandingAssetText}
          onSave={() =>
            void saveJsonEndpoint('branding-assets', brandingAssetText, 'PATCH', 'Branding asset')
          }
        />
        <OperationsEditor
          title="Bookable asset"
          value={bookingAssetText}
          onChange={setBookingAssetText}
          onSave={() =>
            void saveJsonEndpoint('bookings/assets', bookingAssetText, 'PATCH', 'Bookable asset')
          }
        />
        <OperationsEditor
          title="Asset availability / blackout"
          value={bookingAvailabilityText}
          onChange={setBookingAvailabilityText}
          onSave={() =>
            void saveJsonEndpoint(
              'bookings/availability',
              bookingAvailabilityText,
              'POST',
              'Availability',
            )
          }
        />
        <OperationsEditor
          title="Booking reservation"
          value={bookingReservationText}
          onChange={setBookingReservationText}
          onSave={() =>
            void saveJsonEndpoint(
              'bookings/reservations',
              bookingReservationText,
              'POST',
              'Reservation',
            )
          }
        />
        <OperationsEditor
          title="Staff role assignment"
          value={staffText}
          onChange={setStaffText}
          onSave={() => void upsert('staff', staffText, 'Staff')}
        />
        <OperationsEditor
          title="Workflow role-stage mapping"
          value={roleStageText}
          onChange={setRoleStageText}
          onSave={() => void upsert('role-stage-maps', roleStageText, 'Role-stage map')}
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <ListCard title="Maintenance banners">
          {banners.map((banner) => (
            <li key={banner.id} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">
                {banner.code} · {banner.severity} · {banner.is_active ? 'active' : 'inactive'}
              </p>
              <p className="font-medium text-slate-900">{pickLabel(banner.title)}</p>
              <p className="mt-1 text-xs text-slate-500">{pickLabel(banner.body)}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {banner.starts_at ?? 'now'} → {banner.ends_at ?? 'open-ended'}
              </p>
            </li>
          ))}
        </ListCard>
        <ListCard title="Notification templates">
          {templates.map((template) => (
            <li key={template.id} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">
                {template.code} · {template.channel} · {template.locale}
              </p>
              <p className="mt-1 text-sm text-slate-700">{template.trigger}</p>
              <p className="mt-1 text-xs text-slate-500">{template.body.slice(0, 120)}</p>
            </li>
          ))}
        </ListCard>
        <ListCard title="KB articles">
          {kbArticles.map((article) => (
            <li key={article.id} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">{article.slug}</p>
              <p className="font-medium text-slate-900">{pickLabel(article.title)}</p>
              <p className="text-xs text-slate-500">
                {article.status} · {article.tags.join(', ') || 'no tags'} · index{' '}
                {article.index_status ?? 'not queued'}
              </p>
              {article.status === 'published' ? (
                <button
                  type="button"
                  onClick={() => void requeueKb(article.slug)}
                  className="mt-2 text-xs font-medium text-slate-900 underline"
                >
                  Requeue RAG index
                </button>
              ) : null}
            </li>
          ))}
        </ListCard>
        <ListCard title="Branding assets">
          {brandingAssets.map((asset) => (
            <li key={asset.id} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">
                {asset.code} · {asset.kind} · {(asset.size_bytes / 1024).toFixed(0)} KB
              </p>
              <p className="truncate text-xs text-slate-500">{asset.public_url}</p>
              {asset.contrast_warnings.length ? (
                <p className="mt-1 text-xs text-amber-700">{asset.contrast_warnings.join('; ')}</p>
              ) : (
                <p className="mt-1 text-xs text-emerald-700">Contrast check passed.</p>
              )}
            </li>
          ))}
        </ListCard>
        <ListCard title="Bookable assets">
          {bookings.assets.map((asset) => (
            <li key={asset.id} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">
                {asset.code} · {asset.is_active ? 'active' : 'inactive'}
              </p>
              <p className="font-medium text-slate-900">{pickLabel(asset.name)}</p>
              <p className="text-xs text-slate-500">Capacity {asset.capacity ?? 'not set'}</p>
            </li>
          ))}
        </ListCard>
        <ListCard title="Booking calendar">
          {bookings.availability.map((row) => (
            <li key={row.id} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">
                {row.asset_code} · {row.kind}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(row.starts_at).toLocaleString()} →{' '}
                {new Date(row.ends_at).toLocaleString()}
              </p>
            </li>
          ))}
          {bookings.reservations.map((row) => (
            <li key={row.id} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">
                {row.asset_code} · {row.status}
              </p>
              <p className="font-medium text-slate-900">{row.holder_name}</p>
              <p className="text-xs text-slate-500">
                {new Date(row.starts_at).toLocaleString()} →{' '}
                {new Date(row.ends_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ListCard>
        <ListCard title="Staff">
          {staff.map((member) => (
            <li key={member.id} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">{member.username}</p>
              <p className="font-medium text-slate-900">{member.display_name}</p>
              <p className="text-xs text-slate-500">
                {member.status} · {member.roles.map((role) => role.code).join(', ')}
              </p>
            </li>
          ))}
        </ListCard>
        <ListCard title="Roles">
          {roles.map((role) => (
            <li key={role.code} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">{role.code}</p>
              <p className="font-medium text-slate-900">{role.name}</p>
            </li>
          ))}
        </ListCard>
        <ListCard title="Role-stage maps">
          {roleStageMaps.map((map) => (
            <li key={map.id} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">
                {map.workflow_code} / {map.stage_code}
              </p>
              <p className="font-medium text-slate-900">{map.role_code}</p>
              <p className="text-xs text-slate-500">
                view: {String(map.can_view)} · act: {String(map.can_act)}
              </p>
            </li>
          ))}
        </ListCard>
      </section>
    </main>
  );
}

function BannerEditor({
  draft,
  onChange,
  onSave,
}: {
  draft: {
    code: string;
    severity: string;
    title: string;
    body: string;
    link_url: string;
    starts_at: string;
    ends_at: string;
    is_active: boolean;
  };
  onChange: (draft: {
    code: string;
    severity: string;
    title: string;
    body: string;
    link_url: string;
    starts_at: string;
    ends_at: string;
    is_active: boolean;
  }) => void;
  onSave: () => void;
}): JSX.Element {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Maintenance banner</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tenant-scoped notice shown to citizens during outages, maintenance, or urgent
            advisories.
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Save banner
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Code
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.code}
            onChange={(event) => onChange({ ...draft, code: event.target.value })}
          />
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Severity
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.severity}
            onChange={(event) => onChange({ ...draft, severity: event.target.value })}
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Starts at
          <input
            type="datetime-local"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.starts_at}
            onChange={(event) => onChange({ ...draft, starts_at: event.target.value })}
          />
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Ends at
          <input
            type="datetime-local"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.ends_at}
            onChange={(event) => onChange({ ...draft, ends_at: event.target.value })}
          />
        </label>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Title
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
          />
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Link URL
          <input
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.link_url}
            onChange={(event) => onChange({ ...draft, link_url: event.target.value })}
          />
        </label>
      </div>
      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-slate-500">
        Body
        <textarea
          className="mt-1 h-24 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
          value={draft.body}
          onChange={(event) => onChange({ ...draft, body: event.target.value })}
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={(event) => onChange({ ...draft, is_active: event.target.checked })}
        />
        Active
      </label>
    </article>
  );
}

function TemplatePreviewEditor({
  draft,
  jsonValue,
  onDraftChange,
  onJsonChange,
  onJsonSave,
  onSave,
}: {
  draft: TemplateDraft;
  jsonValue: string;
  onDraftChange: (draft: TemplateDraft) => void;
  onJsonChange: (value: string) => void;
  onJsonSave: () => void;
  onSave: () => void;
}): JSX.Element {
  const variables = extractTemplateVariables(draft.subject, draft.body);
  const sampleValues = { ...draft.sampleValues };
  for (const variable of variables) {
    sampleValues[variable] ??= variable;
  }

  function updateSample(variable: string, value: string): void {
    onDraftChange({
      ...draft,
      sampleValues: { ...draft.sampleValues, [variable]: value },
    });
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sprint 6.8D · Channel matrix + variable preview
          </p>
          <h2 className="text-lg font-semibold text-slate-900">Notification template</h2>
          <p className="mt-1 text-sm text-slate-600">
            Author trusted copy without sending provider messages; outbound worker integration
            remains deferred.
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Save template
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TemplateTextInput
          label="Code"
          value={draft.code}
          onChange={(code) => onDraftChange({ ...draft, code })}
        />
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Channel
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.channel}
            onChange={(event) => onDraftChange({ ...draft, channel: event.target.value })}
          >
            <option value="sms">SMS</option>
            <option value="push">Push</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Locale
          <select
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.locale}
            onChange={(event) => onDraftChange({ ...draft, locale: event.target.value })}
          >
            <option value="en">English</option>
            <option value="bn">Bengali</option>
            <option value="hi">Hindi</option>
          </select>
        </label>
        <TemplateTextInput
          label="Trigger"
          value={draft.trigger}
          onChange={(trigger) => onDraftChange({ ...draft, trigger })}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <TemplateTextInput
            label="Subject"
            value={draft.subject}
            onChange={(subject) => onDraftChange({ ...draft, subject })}
          />
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Body
            <textarea
              className="mt-1 h-36 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
              value={draft.body}
              onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(event) => onDraftChange({ ...draft, is_active: event.target.checked })}
            />
            Active
          </label>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Live preview
          </p>
          <div className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-800">
            {draft.subject ? (
              <p className="font-semibold">{renderTemplatePreview(draft.subject, sampleValues)}</p>
            ) : null}
            <p className="mt-1 whitespace-pre-wrap">
              {renderTemplatePreview(draft.body, sampleValues)}
            </p>
          </div>
          <div className="mt-4 space-y-2">
            {variables.map((variable) => (
              <TemplateTextInput
                key={variable}
                label={`Sample ${variable}`}
                value={sampleValues[variable] ?? ''}
                onChange={(value) => updateSample(variable, value)}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {variables.map((variable) => (
              <span key={variable} className="rounded-full bg-slate-200 px-2 py-1 text-xs">
                {variable}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          JSON fallback
        </summary>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onJsonSave}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
          >
            Save JSON
          </button>
        </div>
        <textarea
          className="mt-3 h-64 w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-50"
          value={jsonValue}
          onChange={(event) => onJsonChange(event.target.value)}
          spellCheck={false}
        />
      </details>
    </article>
  );
}

function TemplateTextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
      {label}
      <input
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function OperationsEditor({
  title,
  value,
  onChange,
  onSave,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}): JSX.Element {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Save
        </button>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 h-80 w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-50 shadow-inner outline-none focus:border-teal-400"
        spellCheck={false}
      />
    </article>
  );
}

function ListCard({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <ul className="mt-4 space-y-3">{children}</ul>
    </article>
  );
}
