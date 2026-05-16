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

type RevenueHeadRow = {
  code: string;
  name: unknown;
  accounting_code: string;
  is_active: boolean;
};

type AddressRow = {
  borough_code: string | null;
  borough_name: string | null;
  ward_number: string | null;
  ward_name: string | null;
  mouza: string | null;
  locality_name: string;
  pincode: string | null;
};

type TariffRow = {
  code: string;
  category: string;
  name: unknown;
  rate_config: unknown;
  preview_paise: number | null;
  is_active: boolean;
};

type CatalogueRow = {
  code: string;
  source: 'global' | 'tenant_override' | 'tenant_only' | 'forked';
  global_code: string | null;
  tenant_service_id: string | null;
  category_code: string;
  name: unknown;
  description: unknown;
  is_active: boolean;
  has_local_override: boolean;
  updated_at: string | null;
};

type AddressImportResult = {
  dry_run: boolean;
  inserted: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; field: string; message: string }>;
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
  return 'Untitled';
}

export default function MastersClient(): JSX.Element {
  const router = useRouter();
  const fallbackApi = useMemo(() => publicEnv().apiBaseUrl, []);

  const [token, setToken] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState(fallbackApi);
  const [status, setStatus] = useState<string | null>(null);
  const [revenueHeads, setRevenueHeads] = useState<RevenueHeadRow[]>([]);
  const [addressRows, setAddressRows] = useState<AddressRow[]>([]);
  const [tariffs, setTariffs] = useState<TariffRow[]>([]);
  const [catalogueRows, setCatalogueRows] = useState<CatalogueRow[]>([]);
  const [revenueDraft, setRevenueDraft] = useState({
    code: 'cert-fee',
    name_en: 'Certificate Fees',
    name_bn: 'Certificate Fees',
    name_hi: 'Certificate Fees',
    accounting_code: 'RH-CERT',
    is_active: true,
  });
  const [tariffDraft, setTariffDraft] = useState({
    code: 'water-domestic-v1',
    category: 'water',
    name_en: 'Domestic Water Tariff',
    type: 'slab',
    amount_rupees: '60',
    input_key: 'monthly_kl',
  });
  const [addressCsv, setAddressCsv] = useState(
    'borough_code,borough_name,ward_number,ward_name,mouza,locality_name,pincode\nborough-vii,Borough VII,64,Ward 64,Kasba,Ballygunge Place,700019',
  );
  const [addressImportResult, setAddressImportResult] = useState<AddressImportResult | null>(null);
  const [revenueText, setRevenueText] = useState(
    JSON.stringify(
      {
        code: 'cert-fee',
        name: { en: 'Certificate Fees', bn: 'Certificate Fees', hi: 'Certificate Fees' },
        accounting_code: 'RH-CERT',
        is_active: true,
      },
      null,
      2,
    ),
  );
  const [addressText, setAddressText] = useState(
    JSON.stringify(
      {
        borough_code: 'borough-vii',
        borough_name: 'Borough VII',
        ward_number: '64',
        ward_name: 'Ward 64',
        mouza: 'Kasba',
        locality_name: 'Ballygunge Place',
        pincode: '700019',
      },
      null,
      2,
    ),
  );
  const [tariffText, setTariffText] = useState(
    JSON.stringify(
      {
        code: 'water-domestic-v1',
        category: 'water',
        name: {
          en: 'Domestic Water Tariff',
          bn: 'Domestic Water Tariff',
          hi: 'Domestic Water Tariff',
        },
        rate_config: {
          type: 'slab',
          input_key: 'monthly_kl',
          slabs: [
            { upto: 10, amount_paise: 0 },
            { upto: null, amount_paise: 6000 },
          ],
        },
        is_active: true,
      },
      null,
      2,
    ),
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

  const loadMasters = useCallback(async () => {
    if (!token) {
      return;
    }
    const [revenueRes, addressRes, tariffRes, catalogueRes] = await Promise.all([
      fetch(`${apiBase}/admin/tenant/revenue-heads`, { headers: authHeaders() }),
      fetch(`${apiBase}/admin/tenant/address-master`, { headers: authHeaders() }),
      fetch(`${apiBase}/admin/tenant/tariffs`, { headers: authHeaders() }),
      fetch(`${apiBase}/admin/tenant/catalogue/inherited`, { headers: authHeaders() }),
    ]);
    if (!revenueRes.ok || !addressRes.ok || !tariffRes.ok || !catalogueRes.ok) {
      setStatus(
        `Master load failed (${revenueRes.status}/${addressRes.status}/${tariffRes.status}/${catalogueRes.status}).`,
      );
      return;
    }
    setRevenueHeads((await revenueRes.json()) as RevenueHeadRow[]);
    setAddressRows((await addressRes.json()) as AddressRow[]);
    setTariffs((await tariffRes.json()) as TariffRow[]);
    setCatalogueRows((await catalogueRes.json()) as CatalogueRow[]);
    setStatus(null);
  }, [apiBase, authHeaders, token]);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters]);

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
      setStatus(`${label} save failed (${res.status}). ${text.slice(0, 180)}`);
      return;
    }
    setStatus(`${label} saved.`);
    await loadMasters();
  }

  async function importAddressCsv(dryRun: boolean): Promise<void> {
    if (!token) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/address-master/import-csv`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ csv: addressCsv, dry_run: dryRun }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      setStatus(
        `Address CSV ${dryRun ? 'dry-run' : 'import'} failed (${res.status}). ${text.slice(0, 180)}`,
      );
      return;
    }
    const result = (await res.json()) as AddressImportResult;
    setAddressImportResult(result);
    setStatus(
      `Address CSV ${dryRun ? 'dry-run' : 'import'} complete: ${result.inserted} insert, ${result.updated} update, ${result.failed} failed.`,
    );
    if (!dryRun) {
      await loadMasters();
    }
  }

  async function saveGuidedRevenue(): Promise<void> {
    const payload = {
      code: revenueDraft.code,
      name: { en: revenueDraft.name_en, bn: revenueDraft.name_bn, hi: revenueDraft.name_hi },
      accounting_code: revenueDraft.accounting_code,
      is_active: revenueDraft.is_active,
    };
    await upsert('revenue-heads', JSON.stringify(payload), 'Revenue head');
  }

  async function saveGuidedTariff(): Promise<void> {
    const amountPaise = Math.round(Number(tariffDraft.amount_rupees || '0') * 100);
    const rateConfig =
      tariffDraft.type === 'fixed'
        ? { type: 'fixed', amount_paise: amountPaise }
        : tariffDraft.type === 'slab'
          ? {
              type: 'slab',
              input_key: tariffDraft.input_key,
              slabs: [
                { upto: 10, amount_paise: 0 },
                { upto: null, amount_paise: amountPaise },
              ],
            }
          : { type: 'external', reference: tariffDraft.input_key || tariffDraft.code };
    const payload = {
      code: tariffDraft.code,
      category: tariffDraft.category,
      name: { en: tariffDraft.name_en, bn: tariffDraft.name_en, hi: tariffDraft.name_en },
      rate_config: rateConfig,
      is_active: true,
    };
    setTariffText(JSON.stringify(payload, null, 2));
    await upsert('tariffs', JSON.stringify(payload), 'Tariff');
  }

  async function catalogueAction(
    code: string,
    action: 'adopt' | 'fork' | 'deactivate',
  ): Promise<void> {
    if (!token) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/catalogue/${code}/${action}`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      setStatus(`Catalogue ${action} failed (${res.status}). ${text.slice(0, 180)}`);
      return;
    }
    setStatus(`Catalogue ${action} complete for ${code}.`);
    await loadMasters();
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
            Sprint 6.3 · Tenant masters
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-900">
            Revenue, address, and tariff masters
          </h1>
        </div>
        {status ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {status}
          </p>
        ) : null}
      </div>

      <section className="mb-8 grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Sprint 6.10 · Guided masters
              </p>
              <h2 className="text-lg font-semibold text-slate-900">Revenue head form</h2>
            </div>
            <button
              type="button"
              onClick={() => void saveGuidedRevenue()}
              className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white"
            >
              Save revenue
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ['code', 'Code'],
                ['accounting_code', 'Accounting code'],
                ['name_en', 'Name EN'],
                ['name_bn', 'Name BN'],
                ['name_hi', 'Name HI'],
              ] as Array<[keyof Omit<typeof revenueDraft, 'is_active'>, string]>
            ).map(([key, label]) => (
              <label
                key={key}
                className="text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                {label}
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
                  value={String(revenueDraft[key as keyof typeof revenueDraft])}
                  onChange={(event) =>
                    setRevenueDraft((draft) => ({ ...draft, [key]: event.target.value }))
                  }
                />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={revenueDraft.is_active}
                onChange={(event) =>
                  setRevenueDraft((draft) => ({ ...draft, is_active: event.target.checked }))
                }
              />
              Active
            </label>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Sprint 6.10 · Guided tariffs
              </p>
              <h2 className="text-lg font-semibold text-slate-900">Tariff form</h2>
            </div>
            <button
              type="button"
              onClick={() => void saveGuidedTariff()}
              className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white"
            >
              Save tariff
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Type
              <select
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
                value={tariffDraft.type}
                onChange={(event) =>
                  setTariffDraft((draft) => ({ ...draft, type: event.target.value }))
                }
              >
                <option value="fixed">Fixed</option>
                <option value="slab">Slab</option>
                <option value="external">External</option>
              </select>
            </label>
            {(
              [
                ['code', 'Code'],
                ['category', 'Category'],
                ['name_en', 'Name EN'],
                ['amount_rupees', 'Amount rupees'],
                ['input_key', 'Input key / external ref'],
              ] as Array<[keyof typeof tariffDraft, string]>
            ).map(([key, label]) => (
              <label
                key={key}
                className="text-xs font-medium uppercase tracking-wide text-slate-500"
              >
                {label}
                <input
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
                  value={String(tariffDraft[key as keyof typeof tariffDraft])}
                  onChange={(event) =>
                    setTariffDraft((draft) => ({ ...draft, [key]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <MasterEditor
          title="Revenue head + GL"
          value={revenueText}
          onChange={setRevenueText}
          onSave={() => void upsert('revenue-heads', revenueText, 'Revenue head')}
        />
        <MasterEditor
          title="Address master row"
          value={addressText}
          onChange={setAddressText}
          onSave={() => void upsert('address-master', addressText, 'Address master')}
        />
        <MasterEditor
          title="Tax / tariff row"
          value={tariffText}
          onChange={setTariffText}
          onSave={() => void upsert('tariffs', tariffText, 'Tariff')}
        />
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Sprint 6.9 · Bulk address import
            </p>
            <h2 className="text-lg font-semibold text-slate-900">Address master CSV</h2>
            <p className="mt-1 text-sm text-slate-600">
              Paste CSV rows, dry-run validation, then import valid borough/ward/locality records.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void importAddressCsv(true)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            >
              Dry-run
            </button>
            <button
              type="button"
              onClick={() => void importAddressCsv(false)}
              className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white"
            >
              Import CSV
            </button>
          </div>
        </div>
        <textarea
          className="mt-4 h-40 w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-50"
          value={addressCsv}
          onChange={(event) => setAddressCsv(event.target.value)}
          spellCheck={false}
        />
        {addressImportResult ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">
              {addressImportResult.dry_run ? 'Dry-run' : 'Import'} result: insert{' '}
              {addressImportResult.inserted}, update {addressImportResult.updated}, failed{' '}
              {addressImportResult.failed}
            </p>
            {addressImportResult.errors.length ? (
              <ul className="mt-2 space-y-1 text-xs text-red-700">
                {addressImportResult.errors.map((error) => (
                  <li key={`${error.row}-${error.field}-${error.message}`}>
                    Row {error.row} / {error.field}: {error.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <ListCard title="Revenue heads">
          {revenueHeads.map((head) => (
            <li key={head.code} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">{head.code}</p>
              <p className="font-medium text-slate-900">{pickLabel(head.name)}</p>
              <p className="text-xs text-slate-500">{head.accounting_code}</p>
            </li>
          ))}
        </ListCard>
        <ListCard title="Address rows">
          {addressRows.map((row) => (
            <li
              key={`${row.ward_number}:${row.locality_name}:${row.pincode}`}
              className="rounded border border-slate-200 p-3"
            >
              <p className="font-medium text-slate-900">{row.locality_name}</p>
              <p className="text-xs text-slate-500">
                Ward {row.ward_number ?? '-'} · {row.borough_name ?? 'No borough'}
              </p>
              <p className="text-xs text-slate-500">
                {row.mouza ?? 'No mouza'} · {row.pincode ?? 'No PIN'}
              </p>
            </li>
          ))}
        </ListCard>
        <ListCard title="Tariffs">
          {tariffs.map((tariff) => (
            <li key={tariff.code} className="rounded border border-slate-200 p-3">
              <p className="font-mono text-xs">{tariff.code}</p>
              <p className="font-medium text-slate-900">{pickLabel(tariff.name)}</p>
              <p className="text-xs text-slate-500">
                {tariff.category} ·{' '}
                {tariff.preview_paise === null
                  ? 'external'
                  : `preview ₹${(tariff.preview_paise / 100).toFixed(2)}`}
              </p>
            </li>
          ))}
        </ListCard>
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sprint 6.10 · Catalogue governance
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Inherited, forked, and tenant-only services
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Adopt global templates, fork local copies, or deactivate this tenant&apos;s view without
            changing global catalogue rows.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {catalogueRows.map((row) => (
            <article
              key={`${row.source}:${row.code}`}
              className="rounded-lg border border-slate-200 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{pickLabel(row.name)}</p>
                  <p className="font-mono text-xs text-slate-500">
                    {row.code} · {row.category_code} · {row.source}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Global: {row.global_code ?? 'none'} · {row.is_active ? 'active' : 'inactive'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.global_code ? (
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                      onClick={() => void catalogueAction(row.global_code ?? row.code, 'adopt')}
                    >
                      Adopt
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-2 py-1 text-xs"
                    onClick={() => void catalogueAction(row.global_code ?? row.code, 'fork')}
                  >
                    Fork
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                    onClick={() => void catalogueAction(row.code, 'deactivate')}
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function MasterEditor({
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onSave}
          className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          Save
        </button>
      </div>
      <textarea
        className="h-72 w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-50"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </article>
  );
}

function ListCard({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
      <ul className="space-y-3 text-sm">{children}</ul>
    </article>
  );
}
