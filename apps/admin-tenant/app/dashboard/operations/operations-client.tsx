'use client';

import { putFileToUploadUrl } from '@enagar/forms/upload';
import { AlertBanner, Button, PageHeader } from '@enagar/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BookingsCalendarPanel } from '../../../components/bookings-calendar-panel';
import { GrievanceOperationsPanel } from '../../../components/grievance-operations-panel';
import { JsonFallbackPanel } from '../../../components/json-fallback-panel';
import { RecordListItem, RecordListPanel } from '../../../components/record-list-panel';
import { SectionNav } from '../../../components/section-nav';
import { SmartParkingOpsPanel } from '../../../components/smart-parking-ops-panel';
import { useTenantAdminSession } from '../../../components/tenant-admin-session';
import { clearStoredAuth } from '../../../lib/admin-auth';
import { addDaysYmd, istWindowToIso, ymdTodayIst } from '../../../lib/bookings-calendar.util';

import type { ReactNode } from 'react';

type OperationsSection =
  | 'banners'
  | 'settings'
  | 'templates'
  | 'kb'
  | 'branding'
  | 'bookings'
  | 'smart-parking'
  | 'staff'
  | 'grievances';

const OPERATIONS_SECTIONS: Array<{ id: OperationsSection; label: string }> = [
  { id: 'banners', label: 'Banners' },
  { id: 'settings', label: 'Branding & flags' },
  { id: 'templates', label: 'Templates' },
  { id: 'kb', label: 'Knowledge base' },
  { id: 'branding', label: 'Branding assets' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'smart-parking', label: 'Smart Parking' },
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
  rate_unit?: string;
  base_rate_paise?: number;
  security_deposit_paise?: number;
  slot_step_minutes?: number;
  rules?: Record<string, unknown> | null;
  location?: Record<string, unknown> | null;
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
  keycloak_user_id: string;
  username: string;
  display_name: string;
  email: string | null;
  mobile: string | null;
  status: string;
  roles: Array<{ code: string; name: string; ward_number: string | null }>;
};

type StaffImportResult = {
  dry_run: boolean;
  created: number;
  failed: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  previews: Array<{ row: number; username: string; display_name: string; role_codes: string[] }>;
  created_accounts: Array<{
    row: number;
    username: string;
    display_name: string;
    password_hint: string;
  }>;
};

const STAFF_CSV_TEMPLATE = `username,display_name,role_codes,email,mobile,ward_number,password,designation_codes
pilot-clerk-1,Pilot Clerk One,tenant_clerk,,,,,
pilot-engineer-1,Pilot Engineer,pwd_junior_engineer,,,,,pwd_junior_engineer`;

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
    rate_unit: 'HOUR',
    base_rate_paise: '50000',
    security_deposit_paise: '500000',
    slot_step_minutes: '60',
    open_time: '09:00',
    close_time: '21:00',
    min_duration_hours: '1',
    max_duration_hours: '8',
  });
  const [bookingCalendarAssetFilter, setBookingCalendarAssetFilter] = useState('');
  const [bookingAvailabilityDraft, setBookingAvailabilityDraft] = useState({
    asset_code: 'community-hall-main',
    kind: 'available',
    avail_date: '',
    start_time: '09:00',
    end_time: '21:00',
    starts_at: '',
    ends_at: '',
    note: 'General booking window',
  });
  const [bookingBulkAvailDraft, setBookingBulkAvailDraft] = useState(() => {
    const from = addDaysYmd(ymdTodayIst(), 1);
    return {
      asset_code: '',
      kind: 'available' as 'available' | 'blackout',
      from_date: from,
      to_date: addDaysYmd(from, 55),
      start_time: '09:00',
      end_time: '21:00',
      weekdays: [1, 2, 3, 4, 5] as number[],
      note: 'Weekday booking hours (bulk generated)',
    };
  });
  const [bulkAvailBusy, setBulkAvailBusy] = useState(false);
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
    username: '',
    display_name: '',
    email: '',
    mobile: '',
    role_codes: 'tenant_clerk',
    ward_number: '',
    password: '',
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
  const [selectedStaffUsername, setSelectedStaffUsername] = useState<string | null>(null);
  const [editingStaffKeycloakId, setEditingStaffKeycloakId] = useState<string | null>(null);
  const [staffCsv, setStaffCsv] = useState(STAFF_CSV_TEMPLATE);
  const [staffImportResult, setStaffImportResult] = useState<StaffImportResult | null>(null);
  const staffFormRef = useRef<HTMLDivElement | null>(null);
  const [_staffInvites, setStaffInvites] = useState<StaffInviteRow[]>([]);
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
      setStatus('Sign in again — your session token is missing.');
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      setStatus(`${label} JSON is invalid.`);
      return;
    }
    let res: Response;
    try {
      res = await fetch(`${apiBase}/admin/tenant/${path}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
    } catch (err) {
      const hint = err instanceof Error ? err.message : 'Network error';
      setStatus(
        `${label}: cannot reach API at ${apiBase}. Start the API (pnpm dev:portals). (${hint})`,
      );
      return;
    }
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
    if (!token) {
      setStatus('Sign in again — your session token is missing.');
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      setStatus(`${label} JSON is invalid.`);
      return;
    }
    let res: Response;
    try {
      res = await fetch(`${apiBase}/admin/tenant/${path}`, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
    } catch (err) {
      const hint = err instanceof Error ? err.message : 'Network error';
      setStatus(
        `${label}: cannot reach API at ${apiBase}. Start the API (e.g. pnpm dev:portals) and confirm NEXT_PUBLIC_API_BASE_URL ends with /api. (${hint})`,
      );
      return;
    }
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) return;
      const text = await res.text().catch(() => '');
      setStatus(`${label} save failed (${res.status}). ${text.slice(0, 220)}`);
      return;
    }
    setStatus(`${label} saved.`);
    await loadOperations();
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
    const location = asset.location as { ward?: string; address?: string } | null;
    const rules = asset.rules ?? {};
    const openTime = typeof rules.open_time === 'string' ? rules.open_time : '09:00';
    const closeTime = typeof rules.close_time === 'string' ? rules.close_time : '21:00';
    setBookingAvailabilityDraft((draft) => ({
      ...draft,
      asset_code: asset.code,
      start_time: openTime,
      end_time: closeTime,
    }));
    setBookingBulkAvailDraft((draft) => ({
      ...draft,
      asset_code: asset.code,
      start_time: openTime,
      end_time: closeTime,
    }));
    setBookingCalendarAssetFilter(asset.code);
    const minH =
      typeof rules.min_duration_minutes === 'number'
        ? String(Math.max(1, Math.round(rules.min_duration_minutes / 60)))
        : '1';
    const maxH =
      typeof rules.max_duration_minutes === 'number'
        ? String(Math.max(1, Math.round(rules.max_duration_minutes / 60)))
        : '8';
    setBookingAssetDraft({
      code: asset.code,
      name_en: pickLabel(asset.name),
      ward: location?.ward ?? '',
      address: typeof location?.address === 'string' ? location.address : '',
      capacity: asset.capacity === null ? '' : String(asset.capacity),
      is_active: asset.is_active,
      rate_unit: asset.rate_unit ?? 'HOUR',
      base_rate_paise: asset.base_rate_paise != null ? String(asset.base_rate_paise) : '0',
      security_deposit_paise:
        asset.security_deposit_paise != null ? String(asset.security_deposit_paise) : '0',
      slot_step_minutes: asset.slot_step_minutes != null ? String(asset.slot_step_minutes) : '60',
      open_time: openTime,
      close_time: closeTime,
      min_duration_hours: minH,
      max_duration_hours: maxH,
    });
  }

  function toggleBulkWeekday(day: number): void {
    setBookingBulkAvailDraft((draft) => {
      const has = draft.weekdays.includes(day);
      const weekdays = has
        ? draft.weekdays.filter((value) => value !== day)
        : [...draft.weekdays, day].sort((a, b) => a - b);
      return { ...draft, weekdays };
    });
  }

  async function saveBulkAvailability(): Promise<void> {
    if (!token) {
      setStatus('Sign in again — your session token is missing.');
      return;
    }
    const assetCode = bookingBulkAvailDraft.asset_code.trim();
    if (!assetCode) {
      setStatus('Bulk availability: choose an asset.');
      return;
    }
    if (bookingBulkAvailDraft.weekdays.length === 0) {
      setStatus('Bulk availability: select at least one weekday.');
      return;
    }
    setBulkAvailBusy(true);
    const payload = {
      asset_code: assetCode,
      kind: bookingBulkAvailDraft.kind,
      from_date: bookingBulkAvailDraft.from_date.trim(),
      to_date: bookingBulkAvailDraft.to_date.trim(),
      start_time: bookingBulkAvailDraft.start_time.trim(),
      end_time: bookingBulkAvailDraft.end_time.trim(),
      weekdays: bookingBulkAvailDraft.weekdays,
      note: bookingBulkAvailDraft.note.trim() || undefined,
      skip_existing: true,
    };
    try {
      const res = await fetch(`${apiBase}/admin/tenant/bookings/availability/bulk`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        if (redirectIfUnauthorized(res)) {
          return;
        }
        const text = await res.text().catch(() => '');
        setStatus(`Bulk availability failed (${res.status}). ${text.slice(0, 220)}`);
        return;
      }
      const result = (await res.json()) as {
        created: number;
        skipped: number;
        days_matched: number;
      };
      setStatus(
        `Bulk availability for ${assetCode}: created ${result.created}, skipped ${result.skipped} (${result.days_matched} matching days).`,
      );
      await loadOperations();
    } catch (err) {
      const hint = err instanceof Error ? err.message : 'Network error';
      setStatus(`Bulk availability: cannot reach API at ${apiBase}. (${hint})`);
    } finally {
      setBulkAvailBusy(false);
    }
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

  function newBookableAsset(): void {
    setSelectedBookableCode(null);
    setBookingAssetDraft({
      code: '',
      name_en: '',
      ward: '',
      address: '',
      capacity: '',
      is_active: true,
      rate_unit: 'HOUR',
      base_rate_paise: '50000',
      security_deposit_paise: '500000',
      slot_step_minutes: '60',
      open_time: '09:00',
      close_time: '21:00',
      min_duration_hours: '1',
      max_duration_hours: '8',
    });
    setBookingAssetText(
      pretty({
        code: '',
        asset_type: 'HALL',
        name: { en: '', bn: '', hi: '' },
        location: { ward: '', address: '' },
        rate_unit: 'HOUR',
        base_rate_paise: '50000',
        security_deposit_paise: '500000',
        slot_step_minutes: '60',
        rules: { min_duration_minutes: 60, max_duration_minutes: 480 },
        is_active: true,
        metadata: {},
      }),
    );
  }

  async function saveGuidedBookableAsset(): Promise<void> {
    const code = bookingAssetDraft.code.trim();
    const nameEn = bookingAssetDraft.name_en.trim();
    if (!code || !nameEn) {
      setStatus('Bookable asset requires a code and name (EN).');
      return;
    }
    const minMinutes = Math.max(1, Number(bookingAssetDraft.min_duration_hours || '1')) * 60;
    const maxMinutes =
      Math.max(minMinutes, Number(bookingAssetDraft.max_duration_hours || '8')) * 60;
    const payload = {
      code,
      asset_type: 'HALL',
      name: asLocaleMap(nameEn),
      location: { ward: bookingAssetDraft.ward, address: bookingAssetDraft.address },
      capacity: bookingAssetDraft.capacity.trim() || undefined,
      rate_unit: bookingAssetDraft.rate_unit || 'HOUR',
      base_rate_paise: bookingAssetDraft.base_rate_paise || '0',
      security_deposit_paise: bookingAssetDraft.security_deposit_paise || '0',
      slot_step_minutes: bookingAssetDraft.slot_step_minutes || '60',
      rules: {
        min_duration_minutes: minMinutes,
        max_duration_minutes: maxMinutes,
        open_time: bookingAssetDraft.open_time,
        close_time: bookingAssetDraft.close_time,
      },
      is_active: bookingAssetDraft.is_active,
      metadata: {},
    };
    setBookingAssetText(pretty(payload));
    await saveJsonEndpoint('bookings/assets', pretty(payload), 'PATCH', 'Bookable asset');
  }

  async function saveGuidedAvailability(): Promise<void> {
    const date =
      bookingAvailabilityDraft.avail_date ||
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const window = istWindowToIso(
      date,
      bookingAvailabilityDraft.start_time || '09:00',
      bookingAvailabilityDraft.end_time || '21:00',
    );
    const payload = {
      asset_code: bookingAvailabilityDraft.asset_code,
      kind: bookingAvailabilityDraft.kind,
      starts_at: bookingAvailabilityDraft.starts_at || window.starts_at,
      ends_at: bookingAvailabilityDraft.ends_at || window.ends_at,
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

  function clearStaffForm(): void {
    setSelectedStaffUsername(null);
    setEditingStaffKeycloakId(null);
    setStaffInviteDraft({
      username: '',
      display_name: '',
      email: '',
      mobile: '',
      role_codes: 'tenant_clerk',
      ward_number: '',
      password: '',
    });
  }

  function loadStaffIntoForm(member: StaffRow): void {
    setSelectedStaffUsername(member.username);
    setEditingStaffKeycloakId(member.keycloak_user_id);
    setStaffInviteDraft({
      username: member.username,
      display_name: member.display_name,
      email: member.email ?? '',
      mobile: member.mobile ?? '',
      role_codes: member.roles.map((role) => role.code).join(', '),
      ward_number: member.roles.find((role) => role.ward_number)?.ward_number ?? '',
      password: '',
    });
    staffFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveUpdateStaff(): Promise<void> {
    if (!editingStaffKeycloakId) {
      return;
    }
    const payload = {
      keycloak_user_id: editingStaffKeycloakId,
      username: staffInviteDraft.username.trim(),
      display_name: staffInviteDraft.display_name.trim(),
      email: staffInviteDraft.email.trim() || undefined,
      mobile: staffInviteDraft.mobile.trim() || undefined,
      status: 'active',
      role_codes: staffInviteDraft.role_codes
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean),
      ward_number: staffInviteDraft.ward_number.trim() || undefined,
    };
    const res = await fetch(`${apiBase}/admin/tenant/staff`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) return;
      const text = await res.text().catch(() => '');
      setStatus(`Staff update failed (${res.status}). ${text.slice(0, 220)}`);
      return;
    }
    setStatus(`Staff updated: ${payload.display_name} (${payload.username}).`);
    await loadOperations();
  }

  async function saveCreateStaff(): Promise<void> {
    const payload = {
      username: staffInviteDraft.username.trim(),
      display_name: staffInviteDraft.display_name.trim(),
      email: staffInviteDraft.email.trim() || undefined,
      mobile: staffInviteDraft.mobile.trim() || undefined,
      role_codes: staffInviteDraft.role_codes
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean),
      ward_number: staffInviteDraft.ward_number.trim() || undefined,
      password: staffInviteDraft.password.trim() || undefined,
    };
    if (!payload.username || !payload.display_name || !payload.role_codes.length) {
      setStatus('Username, display name, and at least one role are required.');
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/staff/create`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) return;
      const text = await res.text().catch(() => '');
      setStatus(`Staff create failed (${res.status}). ${text.slice(0, 220)}`);
      return;
    }
    const created = (await res.json()) as {
      login_username: string;
      password_hint: string;
      staff: { username: string; display_name: string };
    };
    setStatus(
      `Staff created: ${created.staff.display_name} (${created.login_username}). Default password: ${created.password_hint}`,
    );
    clearStaffForm();
    await loadOperations();
  }

  async function saveStaffForm(): Promise<void> {
    if (editingStaffKeycloakId) {
      await saveUpdateStaff();
      return;
    }
    await saveCreateStaff();
  }

  async function importStaffCsv(dryRun: boolean): Promise<void> {
    const res = await fetch(`${apiBase}/admin/tenant/staff/import-csv`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ csv: staffCsv, dry_run: dryRun }),
    });
    if (!res.ok) {
      if (redirectIfUnauthorized(res)) return;
      const text = await res.text().catch(() => '');
      setStatus(
        `Staff CSV ${dryRun ? 'dry-run' : 'import'} failed (${res.status}). ${text.slice(0, 220)}`,
      );
      return;
    }
    const result = (await res.json()) as StaffImportResult;
    setStaffImportResult(result);
    const passwordSummary =
      !dryRun && result.created_accounts.length
        ? ` Passwords: ${result.created_accounts
            .slice(0, 3)
            .map((row) => `${row.username}=${row.password_hint}`)
            .join('; ')}${result.created_accounts.length > 3 ? '…' : ''}.`
        : '';
    setStatus(
      `Staff CSV ${dryRun ? 'dry-run' : 'import'}: ${result.created} ok, ${result.failed} failed.${passwordSummary}`,
    );
    if (!dryRun) {
      await loadOperations();
    }
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

      {status ? <AlertBanner tone="warning">{status}</AlertBanner> : null}

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <SectionNav
          aria-label="Operations sections"
          items={OPERATIONS_SECTIONS}
          active={opsSection}
          onSelect={setOpsSection}
        />
        <div className="min-w-0 space-y-6">
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
                      onChange={(value) =>
                        setSettingsDraft((d) => ({ ...d, hero_image_url: value }))
                      }
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
                      onChange={(value) =>
                        setSettingsDraft((d) => ({ ...d, default_language: value }))
                      }
                    />
                    <OpsField
                      label="Contact phone"
                      value={settingsDraft.contact_phone}
                      onChange={(value) =>
                        setSettingsDraft((d) => ({ ...d, contact_phone: value }))
                      }
                    />
                    <OpsField
                      label="Contact email"
                      value={settingsDraft.contact_email}
                      onChange={(value) =>
                        setSettingsDraft((d) => ({ ...d, contact_email: value }))
                      }
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
                        onChange={(event) =>
                          setKbDraft((d) => ({ ...d, status: event.target.value }))
                        }
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
                      onChange={(event) =>
                        setKbDraft((d) => ({ ...d, body_en: event.target.value }))
                      }
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
                        : 'New bookable asset'
                    }
                    saveLabel="Save asset"
                    saveTestId="ops-save-bookable-asset"
                    newLabel="New asset"
                    newTestId="ops-new-bookable-asset"
                    onNew={newBookableAsset}
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
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, name_en: value }))
                        }
                      />
                      <OpsField
                        label="Ward"
                        value={bookingAssetDraft.ward}
                        onChange={(value) => setBookingAssetDraft((d) => ({ ...d, ward: value }))}
                      />
                      <OpsField
                        label="Address"
                        value={bookingAssetDraft.address}
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, address: value }))
                        }
                      />
                      <OpsField
                        label="Capacity"
                        value={bookingAssetDraft.capacity}
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, capacity: value }))
                        }
                      />
                      <OpsField
                        label="Rate unit"
                        value={bookingAssetDraft.rate_unit}
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, rate_unit: value }))
                        }
                      />
                      <OpsField
                        label="Base rate (paise / hour)"
                        value={bookingAssetDraft.base_rate_paise}
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, base_rate_paise: value }))
                        }
                      />
                      <OpsField
                        label="Security deposit (paise)"
                        value={bookingAssetDraft.security_deposit_paise}
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, security_deposit_paise: value }))
                        }
                      />
                      <OpsField
                        label="Slot step (minutes)"
                        value={bookingAssetDraft.slot_step_minutes}
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, slot_step_minutes: value }))
                        }
                      />
                      <OpsField
                        label="Open time (IST)"
                        value={bookingAssetDraft.open_time}
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, open_time: value }))
                        }
                      />
                      <OpsField
                        label="Close time (IST)"
                        value={bookingAssetDraft.close_time}
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, close_time: value }))
                        }
                      />
                      <OpsField
                        label="Min duration (hours)"
                        value={bookingAssetDraft.min_duration_hours}
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, min_duration_hours: value }))
                        }
                      />
                      <OpsField
                        label="Max duration (hours)"
                        value={bookingAssetDraft.max_duration_hours}
                        onChange={(value) =>
                          setBookingAssetDraft((d) => ({ ...d, max_duration_hours: value }))
                        }
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
                    title="Bulk generate availability (IST)"
                    saveLabel={bulkAvailBusy ? 'Generating…' : 'Generate windows'}
                    onSave={() => void saveBulkAvailability()}
                  >
                    <p className="text-sm text-ink-secondary">
                      Creates one window per matching weekday between the dates, using the daily
                      open/close times below. Skips slots that already exist. Use this after adding
                      a new hall (e.g. Rabindra Bhawan).
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-sm">
                        <span className="font-semibold text-ink-primary">Asset</span>
                        <select
                          className="mt-1 w-full rounded-xl border border-warm-border px-3 py-2"
                          onChange={(event) =>
                            setBookingBulkAvailDraft((draft) => ({
                              ...draft,
                              asset_code: event.target.value,
                            }))
                          }
                          value={bookingBulkAvailDraft.asset_code}
                        >
                          <option value="">Select asset…</option>
                          {bookings.assets.map((asset) => (
                            <option key={asset.code} value={asset.code}>
                              {pickLabel(asset.name)} ({asset.code})
                            </option>
                          ))}
                        </select>
                      </label>
                      <OpsField
                        label="Kind"
                        value={bookingBulkAvailDraft.kind}
                        onChange={(value) =>
                          setBookingBulkAvailDraft((draft) => ({
                            ...draft,
                            kind: value === 'blackout' ? 'blackout' : 'available',
                          }))
                        }
                      />
                      <OpsField
                        label="From date (IST)"
                        value={bookingBulkAvailDraft.from_date}
                        onChange={(value) =>
                          setBookingBulkAvailDraft((draft) => ({ ...draft, from_date: value }))
                        }
                      />
                      <OpsField
                        label="To date (IST)"
                        value={bookingBulkAvailDraft.to_date}
                        onChange={(value) =>
                          setBookingBulkAvailDraft((draft) => ({ ...draft, to_date: value }))
                        }
                      />
                      <OpsField
                        label="Daily start (IST)"
                        value={bookingBulkAvailDraft.start_time}
                        onChange={(value) =>
                          setBookingBulkAvailDraft((draft) => ({ ...draft, start_time: value }))
                        }
                      />
                      <OpsField
                        label="Daily end (IST)"
                        value={bookingBulkAvailDraft.end_time}
                        onChange={(value) =>
                          setBookingBulkAvailDraft((draft) => ({ ...draft, end_time: value }))
                        }
                      />
                      <OpsField
                        label="Note"
                        value={bookingBulkAvailDraft.note}
                        onChange={(value) =>
                          setBookingBulkAvailDraft((draft) => ({ ...draft, note: value }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(
                        [
                          [0, 'Sun'],
                          [1, 'Mon'],
                          [2, 'Tue'],
                          [3, 'Wed'],
                          [4, 'Thu'],
                          [5, 'Fri'],
                          [6, 'Sat'],
                        ] as const
                      ).map(([day, label]) => (
                        <label
                          className="inline-flex items-center gap-1.5 rounded-full border border-warm-border px-3 py-1 text-sm"
                          key={day}
                        >
                          <input
                            checked={bookingBulkAvailDraft.weekdays.includes(day)}
                            onChange={() => toggleBulkWeekday(day)}
                            type="checkbox"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </GuidedOpsCard>

                  <GuidedOpsCard
                    title="Single day availability / blackout"
                    saveLabel="Save one day"
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
                        label="Date (IST, YYYY-MM-DD)"
                        value={bookingAvailabilityDraft.avail_date}
                        onChange={(value) =>
                          setBookingAvailabilityDraft((d) => ({ ...d, avail_date: value }))
                        }
                      />
                      <OpsField
                        label="Start time (IST)"
                        value={bookingAvailabilityDraft.start_time}
                        onChange={(value) =>
                          setBookingAvailabilityDraft((d) => ({ ...d, start_time: value }))
                        }
                      />
                      <OpsField
                        label="End time (IST)"
                        value={bookingAvailabilityDraft.end_time}
                        onChange={(value) =>
                          setBookingAvailabilityDraft((d) => ({ ...d, end_time: value }))
                        }
                      />
                      <OpsField
                        label="Starts at (ISO override)"
                        value={bookingAvailabilityDraft.starts_at}
                        onChange={(value) =>
                          setBookingAvailabilityDraft((d) => ({ ...d, starts_at: value }))
                        }
                      />
                      <OpsField
                        label="Ends at (ISO override)"
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

              <BookingsCalendarPanel
                assetFilter={bookingCalendarAssetFilter}
                assets={bookings.assets}
                availability={bookings.availability}
                onAssetFilterChange={setBookingCalendarAssetFilter}
                onSelectEvent={(event) => {
                  if (event.kind === 'reservation') {
                    setBookingReservationDraft({
                      asset_code: event.asset_code,
                      holder_name: event.title.split(' (')[0] ?? event.title,
                      holder_mobile: '',
                      docket_no: '',
                      starts_at: event.starts_at,
                      ends_at: event.ends_at,
                      status: event.status ?? 'hold',
                      note: '',
                    });
                    return;
                  }
                  setBookingAvailabilityDraft({
                    asset_code: event.asset_code,
                    kind: event.kind === 'blackout' ? 'blackout' : 'available',
                    avail_date: '',
                    start_time: '09:00',
                    end_time: '21:00',
                    starts_at: event.starts_at,
                    ends_at: event.ends_at,
                    note: event.status ?? '',
                  });
                }}
                pickLabel={pickLabel}
                reservations={bookings.reservations}
              />
            </section>
          ) : null}

          {opsSection === 'staff' ? (
            <section className="space-y-8">
              <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-6">
                  <p className="text-sm text-ink-secondary">
                    Select a staff member to edit roles and profile. Assign workflow designations
                    under <strong>Masters → Organisation → Staff</strong>.
                  </p>
                  <RecordListPanel title="Staff" emptyLabel="No staff loaded.">
                    {staff.map((member) => (
                      <RecordListItem
                        key={member.id}
                        itemKey={member.username}
                        selected={selectedStaffUsername === member.username}
                        title={member.display_name}
                        subtitle={`${member.username} · ${member.status}`}
                        meta={member.roles.map((role) => role.code).join(', ')}
                        onSelect={() => loadStaffIntoForm(member)}
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
                <div className="space-y-4" ref={staffFormRef}>
                  <GuidedOpsCard
                    title={editingStaffKeycloakId ? 'Edit staff account' : 'Create staff account'}
                    saveLabel={editingStaffKeycloakId ? 'Update staff' : 'Create staff'}
                    onSave={() => void saveStaffForm()}
                  >
                    <p className="text-sm text-ink-secondary">
                      {editingStaffKeycloakId
                        ? 'Updates the eNagar staff record and role assignments. Username is fixed; reset password in Keycloak if needed.'
                        : 'Creates the Keycloak login and eNagar staff record immediately. Share the default password with the operator.'}
                    </p>
                    {editingStaffKeycloakId ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={clearStaffForm}
                        >
                          New staff instead
                        </Button>
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {(
                        [
                          ['username', 'Username'],
                          ['display_name', 'Display name'],
                          ['email', 'Email (optional)'],
                          ['mobile', 'Mobile (optional)'],
                          ['role_codes', 'Role codes (comma-separated)'],
                          ['ward_number', 'Ward number (optional)'],
                          ...(!editingStaffKeycloakId
                            ? ([
                                ['password', 'Password (optional — platform default if blank)'],
                              ] as const)
                            : []),
                        ] as Array<[keyof typeof staffInviteDraft, string]>
                      ).map(([key, label]) => (
                        <OpsField
                          key={key}
                          label={label}
                          value={staffInviteDraft[key]}
                          onChange={(value) => setStaffInviteDraft((d) => ({ ...d, [key]: value }))}
                          readOnly={key === 'username' && Boolean(editingStaffKeycloakId)}
                        />
                      ))}
                    </div>
                  </GuidedOpsCard>
                  <GuidedOpsCard
                    title="Bulk staff import (CSV)"
                    saveLabel="Import CSV"
                    onSave={() => void importStaffCsv(false)}
                  >
                    <p className="text-sm text-ink-secondary">
                      Required columns: <code>username</code>, <code>display_name</code>,{' '}
                      <code>role_codes</code>. Use <code>|</code> for multiple roles or
                      designations. Optional: <code>email</code>, <code>mobile</code>,{' '}
                      <code>ward_number</code>, <code>password</code>,{' '}
                      <code>designation_codes</code>. Max 100 rows.
                    </p>
                    <textarea
                      className="mt-3 min-h-40 w-full rounded-xl border border-warm-border bg-white px-3 py-2 font-mono text-xs text-ink-primary"
                      onChange={(event) => setStaffCsv(event.target.value)}
                      value={staffCsv}
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void importStaffCsv(true)}
                      >
                        Dry-run validate
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setStaffCsv(STAFF_CSV_TEMPLATE)}
                      >
                        Reset template
                      </Button>
                    </div>
                    {staffImportResult ? (
                      <div className="mt-3 rounded-xl bg-canvas p-3 text-sm text-ink-primary">
                        <p>
                          {staffImportResult.dry_run ? 'Dry-run' : 'Import'}:{' '}
                          {staffImportResult.created} ok, {staffImportResult.failed} failed
                        </p>
                        {staffImportResult.errors.slice(0, 5).map((error) => (
                          <p key={`${error.row}-${error.field ?? 'row'}`} className="text-red-700">
                            Row {error.row}
                            {error.field ? ` (${error.field})` : ''}: {error.message}
                          </p>
                        ))}
                        {!staffImportResult.dry_run &&
                          staffImportResult.created_accounts.slice(0, 5).map((row) => (
                            <p key={row.username}>
                              {row.username}: password {row.password_hint}
                            </p>
                          ))}
                      </div>
                    ) : null}
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
                        onChange={(value) =>
                          setRoleStageDraft((d) => ({ ...d, workflow_code: value }))
                        }
                      />
                      <OpsField
                        label="Stage code"
                        value={roleStageDraft.stage_code}
                        onChange={(value) =>
                          setRoleStageDraft((d) => ({ ...d, stage_code: value }))
                        }
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
                    description="Use only when linking an existing Keycloak user id manually."
                    value={legacyStaffText}
                    onChange={setLegacyStaffText}
                    onSave={() => void upsert('staff', legacyStaffText, 'Staff')}
                    saveLabel="Save staff JSON"
                  />
                </div>
              </section>
            </section>
          ) : null}

          {opsSection === 'grievances' ? <GrievanceOperationsPanel /> : null}

          {opsSection === 'smart-parking' ? <SmartParkingOpsPanel /> : null}
        </div>
      </div>
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
        <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          Code
          <input
            className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.code}
            onChange={(event) => onChange({ ...draft, code: event.target.value })}
          />
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          Severity
          <select
            className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.severity}
            onChange={(event) => onChange({ ...draft, severity: event.target.value })}
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          Starts at
          <input
            type="datetime-local"
            className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.starts_at}
            onChange={(event) => onChange({ ...draft, starts_at: event.target.value })}
          />
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          Ends at
          <input
            type="datetime-local"
            className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.ends_at}
            onChange={(event) => onChange({ ...draft, ends_at: event.target.value })}
          />
        </label>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          Title
          <input
            className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
          />
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          Link URL
          <input
            className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.link_url}
            onChange={(event) => onChange({ ...draft, link_url: event.target.value })}
          />
        </label>
      </div>
      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-ink-secondary">
        Body
        <textarea
          className="mt-1 h-24 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
          value={draft.body}
          onChange={(event) => onChange({ ...draft, body: event.target.value })}
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-ink-primary">
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
        <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          Channel
          <select
            className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
            value={draft.channel}
            onChange={(event) => onDraftChange({ ...draft, channel: event.target.value })}
          >
            <option value="sms">SMS</option>
            <option value="push">Push</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          Locale
          <select
            className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
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
          <label className="block text-xs font-medium uppercase tracking-wide text-ink-secondary">
            Body
            <textarea
              className="mt-1 h-36 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
              value={draft.body}
              onChange={(event) => onDraftChange({ ...draft, body: event.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-primary">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(event) => onDraftChange({ ...draft, is_active: event.target.checked })}
            />
            Active
          </label>
        </div>
        <div className="rounded-lg border border-warm-border bg-canvas p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
            Live preview
          </p>
          <div className="mt-3 rounded-lg bg-white p-3 text-sm text-ink-primary">
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
              <span key={variable} className="rounded-full bg-mint-band px-2 py-1 text-xs">
                {variable}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-4 rounded-lg border border-warm-border bg-canvas p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink-primary">
          JSON fallback
        </summary>
        <div className="mt-3 flex justify-end">
          <Button type="button" size="sm" variant="secondary" onClick={onJsonSave}>
            Save JSON
          </Button>
        </div>
        <textarea
          className="mt-3 h-64 w-full rounded-lg border border-warm-border bg-sidebar p-3 font-mono text-xs text-ink-onDark"
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
    <label className="block text-xs font-medium uppercase tracking-wide text-ink-secondary">
      {label}
      <input
        className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function GuidedOpsCard({
  title,
  saveLabel,
  saveTestId,
  onNew,
  newLabel = 'New',
  newTestId,
  onSave,
  children,
}: {
  title: string;
  saveLabel: string;
  saveTestId?: string;
  onNew?: () => void;
  newLabel?: string;
  newTestId?: string;
  onSave: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {onNew ? (
            <Button
              data-testid={newTestId}
              icon="file-plus"
              type="button"
              size="sm"
              variant="secondary"
              onClick={onNew}
            >
              {newLabel}
            </Button>
          ) : null}
          <Button data-testid={saveTestId} type="button" size="sm" onClick={onSave}>
            {saveLabel}
          </Button>
        </div>
      </div>
      {children}
    </article>
  );
}

function OpsField({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}): JSX.Element {
  return (
    <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
      {label}
      <input
        className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal disabled:bg-canvas disabled:text-ink-secondary"
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
