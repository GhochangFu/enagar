'use client';

import { putFileToUploadUrl } from '@enagar/forms/upload';
import { Button, PageHeader } from '@enagar/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { GrievanceOperationsPanel } from '../../../components/grievance-operations-panel';
import { JsonFallbackPanel } from '../../../components/json-fallback-panel';
import { RecordListItem, RecordListPanel } from '../../../components/record-list-panel';
import { useTenantAdminSession } from '../../../components/tenant-admin-session';
import { clearStoredAuth } from '../../../lib/admin-auth';

import type { ReactNode } from 'react';

type OperationsSection =
  | 'banners'
  | 'settings'
  | 'templates'
  | 'kb'
  | 'branding'
  | 'bookings'
  | 'staff'
  | 'grievances';

const OPERATIONS_SECTIONS: Array<{ id: OperationsSection; label: string }> = [
  { id: 'banners', label: 'Banners' },
  { id: 'settings', label: 'Branding & flags' },
  { id: 'templates', label: 'Templates' },
  { id: 'kb', label: 'Knowledge base' },
  { id: 'branding', label: 'Branding assets' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'staff', label: 'Staff & roles' },
  { id: 'grievances', label: 'Grievance SLA & routing' },
];

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

type StaffInviteRow = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  mobile: string | null;
  role_codes: string[];
  ward_number: string | null;
  status: string;
  provisioning_mode: string;
  keycloak_user_id: string | null;
  failure_reason: string | null;
  metadata: unknown;
};

type RoleStageMapRow = {
  id: string;
  workflow_code: string;
  stage_code: string;
  role_code: string;
  can_view: boolean;
  can_act: boolean;
};

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
  const { token, apiBase, me } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [opsSection, setOpsSection] = useState<OperationsSection>('banners');
  const [selectedBannerCode, setSelectedBannerCode] = useState<string | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [selectedKbSlug, setSelectedKbSlug] = useState<string | null>(null);
  const [selectedBrandingCode, setSelectedBrandingCode] = useState<string | null>(null);
  const [selectedBookableCode, setSelectedBookableCode] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [settingsDraft, setSettingsDraft] = useState({
    theme_color: '#0f766e',
    logo_url: '',
    hero_image_url: '',
    kb_cms: true,
    notification_templates: true,
    staff_roles: true,
    languages_enabled: 'en,bn,hi',
    default_language: 'en',
    contact_phone: '',
    contact_email: '',
  });
  const [brandingAssetDraft, setBrandingAssetDraft] = useState({
    code: 'kmc-logo',
    kind: 'logo',
    storage_key: '',
    public_url: '',
    mime_type: 'image/png',
    size_bytes: '120000',
    width: '512',
    height: '512',
  });
  const [bookingAssetDraft, setBookingAssetDraft] = useState({
    code: 'community-hall-main',
    name_en: 'Community Hall Main',
    ward: '001',
    address: 'Main municipal hall',
    capacity: '120',
    is_active: true,
  });
  const [bookingAvailabilityDraft, setBookingAvailabilityDraft] = useState({
    asset_code: 'community-hall-main',
    kind: 'available',
    starts_at: '',
    ends_at: '',
    note: 'General booking window',
  });
  const [bookingReservationDraft, setBookingReservationDraft] = useState({
    asset_code: 'community-hall-main',
    holder_name: 'Citizen booking smoke',
    holder_mobile: '',
    docket_no: '',
    starts_at: '',
    ends_at: '',
    status: 'hold',
    note: 'Smoke reservation',
  });
  const [staffInviteDraft, setStaffInviteDraft] = useState({
    username: 'kmc-tenant-clerk-demo',
    display_name: 'KMC Tenant Clerk Invite',
    email: 'kmc-clerk-demo@example.gov.in',
    mobile: '',
    role_codes: 'tenant_clerk',
    ward_number: '',
  });
  const [roleStageDraft, setRoleStageDraft] = useState({
    workflow_code: 'birth-cert-workflow-v1',
    stage_code: 'document-verification',
    role_code: 'tenant_clerk',
    can_view: true,
    can_act: true,
  });
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplateRow[]>([]);
  const [kbArticles, setKbArticles] = useState<KbArticleRow[]>([]);
  const [brandingAssets, setBrandingAssets] = useState<BrandingAssetRow[]>([]);
  const [brandingUploadBusy, setBrandingUploadBusy] = useState(false);
  const [brandingUploadError, setBrandingUploadError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingsPayload>({
    assets: [],
    availability: [],
    reservations: [],
  });
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffInvites, setStaffInvites] = useState<StaffInviteRow[]>([]);
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
      username: 'kmc-tenant-clerk-demo',
      display_name: 'KMC Tenant Clerk Invite',
      email: 'kmc-clerk-demo@example.gov.in',
      mobile: '',
      role_codes: ['tenant_clerk'],
      ward_number: '',
    }),
  );
  const [legacyStaffText, setLegacyStaffText] = useState(
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
    clearStoredAuth();
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
        staffInvitesRes,
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
        fetch(`${apiBase}/admin/tenant/staff-invites`, { headers: authHeaders() }),
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
          staffInvitesRes,
          mapsRes,
        ].some((res) => res.status === 401)
      ) {
        clearStoredAuth();
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
        !staffInvitesRes.ok ||
        !mapsRes.ok
      ) {
        setStatus(
          `Operations load failed (${settingsRes.status}/${bannersRes.status}/${templatesRes.status}/${kbRes.status}/${brandingAssetsRes.status}/${bookingsRes.status}/${rolesRes.status}/${staffRes.status}/${staffInvitesRes.status}/${mapsRes.status}).`,
        );
        return;
      }
      const settingsJson = (await settingsRes.json()) as SettingsRow;
      setSettings(settingsJson);
      const brandingRecord =
        settingsJson.branding && typeof settingsJson.branding === 'object'
          ? (settingsJson.branding as Record<string, unknown>)
          : {};
      const flagsRecord =
        settingsJson.feature_flags && typeof settingsJson.feature_flags === 'object'
          ? (settingsJson.feature_flags as Record<string, unknown>)
          : {};
      setSettingsDraft({
        theme_color:
          typeof brandingRecord.theme_color === 'string' ? brandingRecord.theme_color : '#0f766e',
        logo_url: typeof brandingRecord.logo_url === 'string' ? brandingRecord.logo_url : '',
        hero_image_url:
          typeof brandingRecord.hero_image_url === 'string' ? brandingRecord.hero_image_url : '',
        kb_cms: flagsRecord.kb_cms !== false,
        notification_templates: flagsRecord.notification_templates !== false,
        staff_roles: flagsRecord.staff_roles !== false,
        languages_enabled: settingsJson.languages_enabled.join(','),
        default_language: settingsJson.default_language,
        contact_phone: settingsJson.contact_phone ?? '',
        contact_email: settingsJson.contact_email ?? '',
      });
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
      setStaffInvites((await staffInvitesRes.json()) as StaffInviteRow[]);
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

  async function updateStaffInvite(inviteId: string, action: string): Promise<void> {
    await saveJsonEndpoint(
      'staff-invites',
      pretty({ invite_id: inviteId, action }),
      'PATCH',
      `Staff invite ${action}`,
    );
  }

  function selectBanner(banner: BannerRow): void {
    setSelectedBannerCode(banner.code);
    setBannerDraft({
      code: banner.code,
      severity: banner.severity,
      title: pickLabel(banner.title),
      body: pickLabel(banner.body),
      link_url: banner.link_url ?? '',
      starts_at: banner.starts_at ?? '',
      ends_at: banner.ends_at ?? '',
      is_active: banner.is_active,
    });
  }

  function newBanner(): void {
    setSelectedBannerCode(null);
    setBannerDraft({
      code: '',
      severity: 'info',
      title: '',
      body: '',
      link_url: '',
      starts_at: '',
      ends_at: '',
      is_active: true,
    });
  }

  function selectTemplate(template: NotificationTemplateRow): void {
    const key = `${template.code}:${template.channel}:${template.locale}`;
    setSelectedTemplateKey(key);
    setTemplateDraft({
      code: template.code,
      channel: template.channel,
      locale: template.locale,
      trigger: template.trigger,
      subject: template.subject ?? '',
      body: template.body,
      variables: Array.isArray(template.variables) ? (template.variables as string[]) : [],
      sampleValues: {},
      is_active: template.is_active,
    });
    setTemplateText(pretty(template));
  }

  function selectKbArticle(article: KbArticleRow): void {
    setSelectedKbSlug(article.slug);
    setKbDraft({
      slug: article.slug,
      title_en: pickLabel(article.title),
      body_en: pickLabel(article.body),
      tags: article.tags.join(','),
      status: article.status,
    });
    setKbText(
      pretty({
        slug: article.slug,
        title: article.title,
        body: article.body,
        tags: article.tags,
        status: article.status,
      }),
    );
  }

  function selectBrandingAsset(asset: BrandingAssetRow): void {
    setSelectedBrandingCode(asset.code);
    setBrandingAssetDraft({
      code: asset.code,
      kind: asset.kind,
      storage_key: '',
      public_url: asset.public_url,
      mime_type: asset.mime_type,
      size_bytes: String(asset.size_bytes),
      width: asset.width === null ? '' : String(asset.width),
      height: asset.height === null ? '' : String(asset.height),
    });
    setBrandingAssetText(
      pretty({ code: asset.code, kind: asset.kind, public_url: asset.public_url }),
    );
  }

  function selectBookableAsset(asset: BookableAssetRow): void {
    setSelectedBookableCode(asset.code);
    setBookingAssetDraft({
      code: asset.code,
      name_en: pickLabel(asset.name),
      ward: '',
      address: '',
      capacity: asset.capacity === null ? '' : String(asset.capacity),
      is_active: asset.is_active,
    });
  }

  async function saveGuidedSettings(): Promise<void> {
    const payload = {
      branding: {
        theme_color: settingsDraft.theme_color,
        logo_url: settingsDraft.logo_url,
        hero_image_url: settingsDraft.hero_image_url,
      },
      feature_flags: {
        kb_cms: settingsDraft.kb_cms,
        notification_templates: settingsDraft.notification_templates,
        staff_roles: settingsDraft.staff_roles,
      },
      languages_enabled: settingsDraft.languages_enabled
        .split(',')
        .map((lang) => lang.trim())
        .filter(Boolean),
      default_language: settingsDraft.default_language,
      contact_phone: settingsDraft.contact_phone || null,
      contact_email: settingsDraft.contact_email || null,
    };
    setSettingsText(pretty(payload));
    await upsert('settings', JSON.stringify(payload), 'Settings');
  }

  async function pickAndUploadBrandingFile(file: File): Promise<void> {
    if (!token) {
      return;
    }
    setBrandingUploadBusy(true);
    setBrandingUploadError(null);
    try {
      const intentRes = await fetch(`${apiBase}/admin/tenant/branding-assets/upload-intent`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          code: brandingAssetDraft.code,
          kind: brandingAssetDraft.kind,
          mime_type: file.type || brandingAssetDraft.mime_type,
          size_bytes: String(file.size),
          original_name: file.name,
        }),
      });
      if (!intentRes.ok) {
        throw new Error(await intentRes.text());
      }
      const intent = (await intentRes.json()) as {
        storage_key: string;
        upload_url: string;
        public_url: string;
        mime_type: string;
      };
      await putFileToUploadUrl(intent.upload_url, file, intent.mime_type);
      setBrandingAssetDraft((draft) => ({
        ...draft,
        storage_key: intent.storage_key,
        public_url: intent.public_url,
        mime_type: intent.mime_type,
        size_bytes: String(file.size),
      }));
      setBrandingAssetText(
        pretty({
          code: brandingAssetDraft.code,
          kind: brandingAssetDraft.kind,
          storage_key: intent.storage_key,
          public_url: intent.public_url,
        }),
      );
    } catch (err: unknown) {
      setBrandingUploadError(err instanceof Error ? err.message : 'Branding upload failed');
    } finally {
      setBrandingUploadBusy(false);
    }
  }

  async function saveGuidedBrandingAsset(): Promise<void> {
    if (!brandingAssetDraft.storage_key.trim()) {
      setBrandingUploadError('Upload a file first (or enter storage_key manually).');
      return;
    }
    const payload = {
      code: brandingAssetDraft.code,
      kind: brandingAssetDraft.kind,
      storage_key: brandingAssetDraft.storage_key,
      public_url: brandingAssetDraft.public_url,
      mime_type: brandingAssetDraft.mime_type,
      size_bytes: Number(brandingAssetDraft.size_bytes || '0'),
      width: brandingAssetDraft.width ? Number(brandingAssetDraft.width) : null,
      height: brandingAssetDraft.height ? Number(brandingAssetDraft.height) : null,
      metadata: {},
    };
    setBrandingAssetText(pretty(payload));
    await saveJsonEndpoint('branding-assets', pretty(payload), 'PATCH', 'Branding asset');
  }

  async function saveGuidedBookableAsset(): Promise<void> {
    const payload = {
      code: bookingAssetDraft.code,
      name: asLocaleMap(bookingAssetDraft.name_en),
      location: { ward: bookingAssetDraft.ward, address: bookingAssetDraft.address },
      capacity: bookingAssetDraft.capacity ? Number(bookingAssetDraft.capacity) : null,
      is_active: bookingAssetDraft.is_active,
      metadata: {},
    };
    setBookingAssetText(pretty(payload));
    await saveJsonEndpoint('bookings/assets', pretty(payload), 'PATCH', 'Bookable asset');
  }

  async function saveGuidedAvailability(): Promise<void> {
    const payload = {
      asset_code: bookingAvailabilityDraft.asset_code,
      kind: bookingAvailabilityDraft.kind,
      starts_at: bookingAvailabilityDraft.starts_at || new Date().toISOString(),
      ends_at: bookingAvailabilityDraft.ends_at || new Date(Date.now() + 3600000).toISOString(),
      note: bookingAvailabilityDraft.note,
    };
    setBookingAvailabilityText(pretty(payload));
    await saveJsonEndpoint('bookings/availability', pretty(payload), 'POST', 'Availability');
  }

  async function saveGuidedReservation(): Promise<void> {
    const payload = {
      asset_code: bookingReservationDraft.asset_code,
      holder_name: bookingReservationDraft.holder_name,
      holder_mobile: bookingReservationDraft.holder_mobile,
      docket_no: bookingReservationDraft.docket_no || null,
      starts_at: bookingReservationDraft.starts_at || new Date().toISOString(),
      ends_at: bookingReservationDraft.ends_at || new Date(Date.now() + 3600000).toISOString(),
      status: bookingReservationDraft.status,
      note: bookingReservationDraft.note,
    };
    setBookingReservationText(pretty(payload));
    await saveJsonEndpoint('bookings/reservations', pretty(payload), 'POST', 'Reservation');
  }

  async function saveGuidedStaffInvite(): Promise<void> {
    const payload = {
      username: staffInviteDraft.username,
      display_name: staffInviteDraft.display_name,
      email: staffInviteDraft.email,
      mobile: staffInviteDraft.mobile,
      role_codes: staffInviteDraft.role_codes
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean),
      ward_number: staffInviteDraft.ward_number || null,
    };
    setStaffText(pretty(payload));
    await saveJsonEndpoint('staff-invites', pretty(payload), 'POST', 'Staff invite');
  }

  async function saveGuidedRoleStageMap(): Promise<void> {
    const payload = {
      workflow_code: roleStageDraft.workflow_code,
      stage_code: roleStageDraft.stage_code,
      role_code: roleStageDraft.role_code,
      can_view: roleStageDraft.can_view,
      can_act: roleStageDraft.can_act,
    };
    setRoleStageText(pretty(payload));
    await upsert('role-stage-maps', pretty(payload), 'Role-stage map');
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Operations"
        subtitle={
          (settings?.tenant_code ?? me?.tenant_code)
            ? `Templates, branding, KB, and staff for ${settings?.tenant_code ?? me?.tenant_code}`
            : 'Templates, KB, branding, flags, and staff'
        }
        actions={
          <Button type="button" variant="secondary" onClick={() => void loadOperations()}>
            Refresh
          </Button>
        }
      />

      {status ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {status}
        </p>
      ) : null}

      <nav className="flex flex-wrap gap-2" aria-label="Operations sections">
        {OPERATIONS_SECTIONS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={opsSection === item.id ? 'primary' : 'secondary'}
            onClick={() => setOpsSection(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {opsSection === 'banners' ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <BannerEditor
            draft={bannerDraft}
            onChange={setBannerDraft}
            onSave={() => void saveBanner()}
          />
          <RecordListPanel
            title="Maintenance banners"
            selectedKey={selectedBannerCode}
            onNew={newBanner}
            newLabel="New banner"
            emptyLabel="No banners yet."
          >
            {banners.map((banner) => (
              <RecordListItem
                key={banner.id}
                itemKey={banner.code}
                selected={selectedBannerCode === banner.code}
                title={pickLabel(banner.title)}
                subtitle={`${banner.severity} · ${banner.is_active ? 'active' : 'inactive'}`}
                meta={`${banner.starts_at ?? 'now'} → ${banner.ends_at ?? 'open-ended'}`}
                onSelect={() => selectBanner(banner)}
              />
            ))}
          </RecordListPanel>
        </section>
      ) : null}

      {opsSection === 'settings' ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <GuidedOpsCard
              title="Branding, languages, and feature flags"
              saveLabel="Save settings"
              onSave={() => void saveGuidedSettings()}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <OpsField
                  label="Theme color"
                  value={settingsDraft.theme_color}
                  onChange={(value) => setSettingsDraft((d) => ({ ...d, theme_color: value }))}
                />
                <OpsField
                  label="Logo URL"
                  value={settingsDraft.logo_url}
                  onChange={(value) => setSettingsDraft((d) => ({ ...d, logo_url: value }))}
                />
                <OpsField
                  label="Hero image URL"
                  value={settingsDraft.hero_image_url}
                  onChange={(value) => setSettingsDraft((d) => ({ ...d, hero_image_url: value }))}
                />
                <OpsField
                  label="Languages (comma-separated)"
                  value={settingsDraft.languages_enabled}
                  onChange={(value) =>
                    setSettingsDraft((d) => ({ ...d, languages_enabled: value }))
                  }
                />
                <OpsField
                  label="Default language"
                  value={settingsDraft.default_language}
                  onChange={(value) => setSettingsDraft((d) => ({ ...d, default_language: value }))}
                />
                <OpsField
                  label="Contact phone"
                  value={settingsDraft.contact_phone}
                  onChange={(value) => setSettingsDraft((d) => ({ ...d, contact_phone: value }))}
                />
                <OpsField
                  label="Contact email"
                  value={settingsDraft.contact_email}
                  onChange={(value) => setSettingsDraft((d) => ({ ...d, contact_email: value }))}
                />
                {(
                  [
                    ['kb_cms', 'KB CMS enabled'],
                    ['notification_templates', 'Notification templates enabled'],
                    ['staff_roles', 'Staff roles enabled'],
                  ] as Array<
                    [
                      keyof Pick<
                        typeof settingsDraft,
                        'kb_cms' | 'notification_templates' | 'staff_roles'
                      >,
                      string,
                    ]
                  >
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-ink-primary">
                    <input
                      type="checkbox"
                      checked={settingsDraft[key]}
                      onChange={(event) =>
                        setSettingsDraft((d) => ({ ...d, [key]: event.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </GuidedOpsCard>
            <JsonFallbackPanel
              value={settingsText}
              onChange={setSettingsText}
              onSave={() => void upsert('settings', settingsText, 'Settings')}
              saveLabel="Save settings JSON"
            />
          </div>
          <RecordListPanel title="Tenant settings" emptyLabel="Settings load on refresh.">
            <RecordListItem
              itemKey={settings?.tenant_code ?? 'tenant'}
              selected
              title="Current tenant configuration"
              subtitle="Branding, languages, and feature flags"
              meta={settingsDraft.default_language}
              onSelect={() => undefined}
            />
          </RecordListPanel>
        </section>
      ) : null}

      {opsSection === 'templates' ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
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
          <RecordListPanel
            title="Notification templates"
            selectedKey={selectedTemplateKey}
            emptyLabel="No templates yet."
          >
            {templates.map((template) => {
              const key = `${template.code}:${template.channel}:${template.locale}`;
              return (
                <RecordListItem
                  key={template.id}
                  itemKey={key}
                  selected={selectedTemplateKey === key}
                  title={template.trigger}
                  subtitle={`${template.code} · ${template.channel} · ${template.locale}`}
                  meta={template.body.slice(0, 80)}
                  onSelect={() => selectTemplate(template)}
                />
              );
            })}
          </RecordListPanel>
        </section>
      ) : null}

      {opsSection === 'kb' ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <GuidedOpsCard
              title={selectedKbSlug ? `Edit KB · ${selectedKbSlug}` : 'New KB article'}
              saveLabel="Save KB"
              onSave={() => void saveKbDraft()}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <OpsField
                  label="Slug"
                  value={kbDraft.slug}
                  onChange={(value) => setKbDraft((d) => ({ ...d, slug: value }))}
                />
                <OpsField
                  label="Title EN"
                  value={kbDraft.title_en}
                  onChange={(value) => setKbDraft((d) => ({ ...d, title_en: value }))}
                />
                <OpsField
                  label="Tags (comma-separated)"
                  value={kbDraft.tags}
                  onChange={(value) => setKbDraft((d) => ({ ...d, tags: value }))}
                />
                <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
                  Status
                  <select
                    className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case"
                    value={kbDraft.status}
                    onChange={(event) => setKbDraft((d) => ({ ...d, status: event.target.value }))}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ink-secondary">
                Body markdown
                <textarea
                  className="mt-1 h-28 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case"
                  value={kbDraft.body_en}
                  onChange={(event) => setKbDraft((d) => ({ ...d, body_en: event.target.value }))}
                />
              </label>
            </GuidedOpsCard>
            <JsonFallbackPanel
              value={kbText}
              onChange={setKbText}
              onSave={() => void upsert('kb-articles', kbText, 'KB article')}
              saveLabel="Save KB JSON"
            />
          </div>
          <RecordListPanel
            title="KB articles"
            selectedKey={selectedKbSlug}
            emptyLabel="No KB articles yet."
          >
            {kbArticles.map((article) => (
              <RecordListItem
                key={article.id}
                itemKey={article.slug}
                selected={selectedKbSlug === article.slug}
                title={pickLabel(article.title)}
                subtitle={`${article.status} · ${article.tags.join(', ') || 'no tags'}`}
                meta={`index ${article.index_status ?? 'not queued'}`}
                onSelect={() => selectKbArticle(article)}
              />
            ))}
          </RecordListPanel>
          {selectedKbSlug &&
          kbArticles.some((a) => a.slug === selectedKbSlug && a.status === 'published') ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void requeueKb(selectedKbSlug)}
            >
              Requeue RAG index
            </Button>
          ) : null}
        </section>
      ) : null}

      {opsSection === 'branding' ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <GuidedOpsCard
              title={
                selectedBrandingCode
                  ? `Edit branding asset · ${selectedBrandingCode}`
                  : 'Register branding asset'
              }
              saveLabel="Save asset"
              onSave={() => void saveGuidedBrandingAsset()}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {(
                  [
                    ['code', 'Code'],
                    ['kind', 'Kind'],
                    ['storage_key', 'Storage key'],
                    ['public_url', 'Public URL'],
                    ['mime_type', 'MIME type'],
                    ['size_bytes', 'Size bytes'],
                    ['width', 'Width'],
                    ['height', 'Height'],
                  ] as Array<[keyof typeof brandingAssetDraft, string]>
                ).map(([key, label]) => (
                  <OpsField
                    key={key}
                    label={label}
                    value={brandingAssetDraft[key]}
                    onChange={(value) => setBrandingAssetDraft((d) => ({ ...d, [key]: value }))}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                    disabled={brandingUploadBusy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void pickAndUploadBrandingFile(file);
                      }
                      event.target.value = '';
                    }}
                  />
                  <span className="inline-flex rounded-lg border border-warm-border bg-surface px-3 py-2 text-sm font-medium text-ink-primary">
                    {brandingUploadBusy ? 'Uploading…' : 'Upload file to MinIO'}
                  </span>
                </label>
                {brandingAssetDraft.public_url.startsWith('http') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandingAssetDraft.public_url}
                    alt="Branding preview"
                    className="h-12 max-w-[160px] rounded border border-warm-border object-contain"
                  />
                ) : null}
              </div>
              {brandingUploadError ? (
                <p className="text-sm text-red-700">{brandingUploadError}</p>
              ) : null}
            </GuidedOpsCard>
            <JsonFallbackPanel
              value={brandingAssetText}
              onChange={setBrandingAssetText}
              onSave={() =>
                void saveJsonEndpoint(
                  'branding-assets',
                  brandingAssetText,
                  'PATCH',
                  'Branding asset',
                )
              }
              saveLabel="Save asset JSON"
            />
          </div>
          <RecordListPanel
            title="Branding assets"
            selectedKey={selectedBrandingCode}
            emptyLabel="No branding assets yet."
          >
            {brandingAssets.map((asset) => (
              <RecordListItem
                key={asset.id}
                itemKey={asset.code}
                selected={selectedBrandingCode === asset.code}
                title={asset.kind}
                subtitle={`${(asset.size_bytes / 1024).toFixed(0)} KB`}
                meta={asset.public_url}
                onSelect={() => selectBrandingAsset(asset)}
              />
            ))}
          </RecordListPanel>
        </section>
      ) : null}

      {opsSection === 'bookings' ? (
        <section className="space-y-8">
          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <GuidedOpsCard
                title={
                  selectedBookableCode
                    ? `Edit bookable asset · ${selectedBookableCode}`
                    : 'Bookable asset'
                }
                saveLabel="Save asset"
                onSave={() => void saveGuidedBookableAsset()}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <OpsField
                    label="Code"
                    value={bookingAssetDraft.code}
                    onChange={(value) => setBookingAssetDraft((d) => ({ ...d, code: value }))}
                  />
                  <OpsField
                    label="Name EN"
                    value={bookingAssetDraft.name_en}
                    onChange={(value) => setBookingAssetDraft((d) => ({ ...d, name_en: value }))}
                  />
                  <OpsField
                    label="Ward"
                    value={bookingAssetDraft.ward}
                    onChange={(value) => setBookingAssetDraft((d) => ({ ...d, ward: value }))}
                  />
                  <OpsField
                    label="Address"
                    value={bookingAssetDraft.address}
                    onChange={(value) => setBookingAssetDraft((d) => ({ ...d, address: value }))}
                  />
                  <OpsField
                    label="Capacity"
                    value={bookingAssetDraft.capacity}
                    onChange={(value) => setBookingAssetDraft((d) => ({ ...d, capacity: value }))}
                  />
                  <label className="flex items-center gap-2 text-sm text-ink-primary">
                    <input
                      type="checkbox"
                      checked={bookingAssetDraft.is_active}
                      onChange={(event) =>
                        setBookingAssetDraft((d) => ({ ...d, is_active: event.target.checked }))
                      }
                    />
                    Active
                  </label>
                </div>
              </GuidedOpsCard>
              <JsonFallbackPanel
                value={bookingAssetText}
                onChange={setBookingAssetText}
                onSave={() =>
                  void saveJsonEndpoint(
                    'bookings/assets',
                    bookingAssetText,
                    'PATCH',
                    'Bookable asset',
                  )
                }
                saveLabel="Save bookable asset JSON"
              />
            </div>
            <RecordListPanel
              title="Bookable assets"
              selectedKey={selectedBookableCode}
              emptyLabel="No bookable assets yet."
            >
              {bookings.assets.map((asset) => (
                <RecordListItem
                  key={asset.id}
                  itemKey={asset.code}
                  selected={selectedBookableCode === asset.code}
                  title={pickLabel(asset.name)}
                  subtitle={asset.is_active ? 'active' : 'inactive'}
                  meta={`Capacity ${asset.capacity ?? 'not set'}`}
                  onSelect={() => selectBookableAsset(asset)}
                />
              ))}
            </RecordListPanel>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              <GuidedOpsCard
                title="Availability / blackout window"
                saveLabel="Save availability"
                onSave={() => void saveGuidedAvailability()}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <OpsField
                    label="Asset code"
                    value={bookingAvailabilityDraft.asset_code}
                    onChange={(value) =>
                      setBookingAvailabilityDraft((d) => ({ ...d, asset_code: value }))
                    }
                  />
                  <OpsField
                    label="Kind"
                    value={bookingAvailabilityDraft.kind}
                    onChange={(value) =>
                      setBookingAvailabilityDraft((d) => ({ ...d, kind: value }))
                    }
                  />
                  <OpsField
                    label="Starts at (ISO)"
                    value={bookingAvailabilityDraft.starts_at}
                    onChange={(value) =>
                      setBookingAvailabilityDraft((d) => ({ ...d, starts_at: value }))
                    }
                  />
                  <OpsField
                    label="Ends at (ISO)"
                    value={bookingAvailabilityDraft.ends_at}
                    onChange={(value) =>
                      setBookingAvailabilityDraft((d) => ({ ...d, ends_at: value }))
                    }
                  />
                  <OpsField
                    label="Note"
                    value={bookingAvailabilityDraft.note}
                    onChange={(value) =>
                      setBookingAvailabilityDraft((d) => ({ ...d, note: value }))
                    }
                  />
                </div>
              </GuidedOpsCard>
              <JsonFallbackPanel
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
                saveLabel="Save availability JSON"
              />
            </div>
            <div className="space-y-4">
              <GuidedOpsCard
                title="Booking reservation"
                saveLabel="Save reservation"
                onSave={() => void saveGuidedReservation()}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {(
                    [
                      ['asset_code', 'Asset code'],
                      ['holder_name', 'Holder name'],
                      ['holder_mobile', 'Holder mobile'],
                      ['docket_no', 'Docket no'],
                      ['starts_at', 'Starts at (ISO)'],
                      ['ends_at', 'Ends at (ISO)'],
                      ['status', 'Status'],
                      ['note', 'Note'],
                    ] as Array<[keyof typeof bookingReservationDraft, string]>
                  ).map(([key, label]) => (
                    <OpsField
                      key={key}
                      label={label}
                      value={bookingReservationDraft[key]}
                      onChange={(value) =>
                        setBookingReservationDraft((d) => ({ ...d, [key]: value }))
                      }
                    />
                  ))}
                </div>
              </GuidedOpsCard>
              <JsonFallbackPanel
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
                saveLabel="Save reservation JSON"
              />
            </div>
          </section>

          <RecordListPanel title="Booking calendar" emptyLabel="No availability or reservations.">
            {bookings.availability.map((row) => (
              <RecordListItem
                key={row.id}
                itemKey={row.id}
                selected={false}
                title={`${row.asset_code} · ${row.kind}`}
                subtitle={new Date(row.starts_at).toLocaleString()}
                meta={new Date(row.ends_at).toLocaleString()}
                onSelect={() => {
                  setBookingAvailabilityDraft({
                    asset_code: row.asset_code,
                    kind: row.kind,
                    starts_at: row.starts_at,
                    ends_at: row.ends_at,
                    note: row.note ?? '',
                  });
                }}
              />
            ))}
            {bookings.reservations.map((row) => (
              <RecordListItem
                key={row.id}
                itemKey={row.id}
                selected={false}
                title={`${row.asset_code} · ${row.status}`}
                subtitle={row.holder_name}
                meta={`${new Date(row.starts_at).toLocaleString()} → ${new Date(row.ends_at).toLocaleString()}`}
                onSelect={() => {
                  setBookingReservationDraft({
                    asset_code: row.asset_code,
                    holder_name: row.holder_name,
                    holder_mobile: '',
                    docket_no: row.docket_no ?? '',
                    starts_at: row.starts_at,
                    ends_at: row.ends_at,
                    status: row.status,
                    note: '',
                  });
                }}
              />
            ))}
          </RecordListPanel>
        </section>
      ) : null}

      {opsSection === 'staff' ? (
        <section className="space-y-8">
          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <GuidedOpsCard
                title="Staff invite / provisioning"
                saveLabel="Send invite"
                onSave={() => void saveGuidedStaffInvite()}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {(
                    [
                      ['username', 'Username'],
                      ['display_name', 'Display name'],
                      ['email', 'Email'],
                      ['mobile', 'Mobile'],
                      ['role_codes', 'Role codes (comma-separated)'],
                      ['ward_number', 'Ward number'],
                    ] as Array<[keyof typeof staffInviteDraft, string]>
                  ).map(([key, label]) => (
                    <OpsField
                      key={key}
                      label={label}
                      value={staffInviteDraft[key]}
                      onChange={(value) => setStaffInviteDraft((d) => ({ ...d, [key]: value }))}
                    />
                  ))}
                </div>
              </GuidedOpsCard>
              <JsonFallbackPanel
                value={staffText}
                onChange={setStaffText}
                onSave={() =>
                  void saveJsonEndpoint('staff-invites', staffText, 'POST', 'Staff invite')
                }
                saveLabel="Save invite JSON"
              />
              <GuidedOpsCard
                title="Workflow role-stage mapping"
                saveLabel="Save mapping"
                onSave={() => void saveGuidedRoleStageMap()}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <OpsField
                    label="Workflow code"
                    value={roleStageDraft.workflow_code}
                    onChange={(value) => setRoleStageDraft((d) => ({ ...d, workflow_code: value }))}
                  />
                  <OpsField
                    label="Stage code"
                    value={roleStageDraft.stage_code}
                    onChange={(value) => setRoleStageDraft((d) => ({ ...d, stage_code: value }))}
                  />
                  <OpsField
                    label="Role code"
                    value={roleStageDraft.role_code}
                    onChange={(value) => setRoleStageDraft((d) => ({ ...d, role_code: value }))}
                  />
                  <label className="flex items-center gap-2 text-sm text-ink-primary">
                    <input
                      type="checkbox"
                      checked={roleStageDraft.can_view}
                      onChange={(event) =>
                        setRoleStageDraft((d) => ({ ...d, can_view: event.target.checked }))
                      }
                    />
                    Can view
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-primary">
                    <input
                      type="checkbox"
                      checked={roleStageDraft.can_act}
                      onChange={(event) =>
                        setRoleStageDraft((d) => ({ ...d, can_act: event.target.checked }))
                      }
                    />
                    Can act
                  </label>
                </div>
              </GuidedOpsCard>
              <JsonFallbackPanel
                value={roleStageText}
                onChange={setRoleStageText}
                onSave={() => void upsert('role-stage-maps', roleStageText, 'Role-stage map')}
                saveLabel="Save role-stage JSON"
              />
              <JsonFallbackPanel
                title="Legacy staff assignment JSON"
                value={legacyStaffText}
                onChange={setLegacyStaffText}
                onSave={() => void upsert('staff', legacyStaffText, 'Staff')}
                saveLabel="Save staff JSON"
              />
            </div>
            <div className="space-y-6">
              <RecordListPanel title="Staff invites" emptyLabel="No invites.">
                {staffInvites.map((invite) => (
                  <RecordListItem
                    key={invite.id}
                    itemKey={invite.username}
                    selected={false}
                    title={invite.display_name}
                    subtitle={`${invite.status} · ${invite.role_codes.join(', ')}`}
                    meta={invite.failure_reason ?? invite.provisioning_mode}
                    onSelect={() => {
                      setStaffInviteDraft({
                        username: invite.username,
                        display_name: invite.display_name,
                        email: invite.email ?? '',
                        mobile: invite.mobile ?? '',
                        role_codes: invite.role_codes.join(','),
                        ward_number: invite.ward_number ?? '',
                      });
                    }}
                  />
                ))}
              </RecordListPanel>
              {staffInvites.length ? (
                <div className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-warm-border p-3">
                  <p className="w-full text-xs text-ink-secondary">
                    Provisioning actions (select invite above, then):
                  </p>
                  {(['retry', 'mark_provisioned', 'disable'] as const).map((action) => (
                    <Button
                      key={action}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const invite = staffInvites.find(
                          (row) => row.username === staffInviteDraft.username,
                        );
                        if (invite) void updateStaffInvite(invite.id, action);
                      }}
                    >
                      {action.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              ) : null}
              <RecordListPanel title="Staff" emptyLabel="No staff loaded.">
                {staff.map((member) => (
                  <RecordListItem
                    key={member.id}
                    itemKey={member.username}
                    selected={false}
                    title={member.display_name}
                    subtitle={member.status}
                    meta={member.roles.map((role) => role.code).join(', ')}
                    onSelect={() => undefined}
                  />
                ))}
              </RecordListPanel>
              <RecordListPanel title="Roles" emptyLabel="No roles.">
                {roles.map((role) => (
                  <RecordListItem
                    key={role.code}
                    itemKey={role.code}
                    selected={false}
                    title={role.name}
                    onSelect={() => undefined}
                  />
                ))}
              </RecordListPanel>
              <RecordListPanel title="Role-stage maps" emptyLabel="No maps.">
                {roleStageMaps.map((map) => (
                  <RecordListItem
                    key={map.id}
                    itemKey={map.id}
                    selected={false}
                    title={map.role_code}
                    subtitle={`${map.workflow_code} / ${map.stage_code}`}
                    meta={`view ${String(map.can_view)} · act ${String(map.can_act)}`}
                    onSelect={() => {
                      setRoleStageDraft({
                        workflow_code: map.workflow_code,
                        stage_code: map.stage_code,
                        role_code: map.role_code,
                        can_view: map.can_view,
                        can_act: map.can_act,
                      });
                    }}
                  />
                ))}
              </RecordListPanel>
            </div>
          </section>
        </section>
      ) : null}

      {opsSection === 'grievances' ? <GrievanceOperationsPanel /> : null}
    </div>
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
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary">Maintenance banner</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Tenant-scoped notice shown to citizens during outages, maintenance, or urgent
            advisories.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onSave}>
          Save banner
        </Button>
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
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-forest">
            Sprint 6.8D · Channel matrix + variable preview
          </p>
          <h2 className="text-lg font-semibold text-ink-primary">Notification template</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Author trusted copy without sending provider messages; outbound worker integration
            remains deferred.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onSave}>
          Save template
        </Button>
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
          <Button type="button" size="sm" variant="secondary" onClick={onJsonSave}>
            Save JSON
          </Button>
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

function GuidedOpsCard({
  title,
  saveLabel,
  onSave,
  children,
}: {
  title: string;
  saveLabel: string;
  onSave: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
        <Button type="button" size="sm" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
      {children}
    </article>
  );
}

function OpsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
      {label}
      <input
        className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
