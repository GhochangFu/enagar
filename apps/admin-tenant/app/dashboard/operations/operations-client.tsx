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

type KbArticleRow = {
  id: string;
  slug: string;
  title: unknown;
  tags: string[];
  status: string;
  published_at: string | null;
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

export default function OperationsClient(): JSX.Element {
  const router = useRouter();
  const fallbackApi = useMemo(() => publicEnv().apiBaseUrl, []);

  const [token, setToken] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState(fallbackApi);
  const [status, setStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [templates, setTemplates] = useState<NotificationTemplateRow[]>([]);
  const [kbArticles, setKbArticles] = useState<KbArticleRow[]>([]);
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

  const loadOperations = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const [settingsRes, templatesRes, kbRes, rolesRes, staffRes, mapsRes] = await Promise.all([
        fetch(`${apiBase}/admin/tenant/settings`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/notification-templates`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/kb-articles`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/roles`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/staff`, { headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/role-stage-maps`, { headers: authHeaders() }),
      ]);
      if (
        !settingsRes.ok ||
        !templatesRes.ok ||
        !kbRes.ok ||
        !rolesRes.ok ||
        !staffRes.ok ||
        !mapsRes.ok
      ) {
        setStatus(
          `Operations load failed (${settingsRes.status}/${templatesRes.status}/${kbRes.status}/${rolesRes.status}/${staffRes.status}/${mapsRes.status}).`,
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
      setTemplates((await templatesRes.json()) as NotificationTemplateRow[]);
      setKbArticles((await kbRes.json()) as KbArticleRow[]);
      setRoles((await rolesRes.json()) as RoleRow[]);
      setStaff((await staffRes.json()) as StaffRow[]);
      setRoleStageMaps((await mapsRes.json()) as RoleStageMapRow[]);
      setStatus(null);
    } catch {
      setStatus('Network error loading tenant operations.');
    }
  }, [apiBase, authHeaders, token]);

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

      <section className="grid gap-6 xl:grid-cols-2">
        <OperationsEditor
          title="Branding, languages, and feature flags"
          value={settingsText}
          onChange={setSettingsText}
          onSave={() => void upsert('settings', settingsText, 'Settings')}
        />
        <OperationsEditor
          title="Notification template"
          value={templateText}
          onChange={setTemplateText}
          onSave={() =>
            void upsert('notification-templates', templateText, 'Notification template')
          }
        />
        <OperationsEditor
          title="Knowledge-base article"
          value={kbText}
          onChange={setKbText}
          onSave={() => void upsert('kb-articles', kbText, 'KB article')}
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
                {article.status} · {article.tags.join(', ') || 'no tags'}
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
