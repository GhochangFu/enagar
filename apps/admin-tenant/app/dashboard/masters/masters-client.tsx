'use client';

import { Button, PageHeader } from '@enagar/ui';
import { useCallback, useEffect, useState } from 'react';

import { GrievanceCataloguePanel } from '../../../components/grievance-catalogue-panel';
import { JsonFallbackPanel } from '../../../components/json-fallback-panel';
import { RecordListItem, RecordListPanel } from '../../../components/record-list-panel';
import { useTenantAdminSession } from '../../../components/tenant-admin-session';

import type { ReactNode } from 'react';

type MastersSection = 'revenue' | 'tariffs' | 'address' | 'catalogue' | 'grievances';

const MASTERS_SECTIONS: Array<{ id: MastersSection; label: string }> = [
  { id: 'revenue', label: 'Revenue heads' },
  { id: 'tariffs', label: 'Tariffs' },
  { id: 'address', label: 'Address master' },
  { id: 'catalogue', label: 'Catalogue' },
  { id: 'grievances', label: 'Grievance catalogue' },
];

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

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Untitled';
  }
  return 'Untitled';
}

function localeNames(name: unknown): { en: string; bn: string; hi: string } {
  if (name && typeof name === 'object' && !Array.isArray(name)) {
    const record = name as Record<string, unknown>;
    return {
      en: typeof record.en === 'string' ? record.en : '',
      bn: typeof record.bn === 'string' ? record.bn : '',
      hi: typeof record.hi === 'string' ? record.hi : '',
    };
  }
  return { en: '', bn: '', hi: '' };
}

function addressRowKey(row: AddressRow): string {
  return `${row.ward_number ?? ''}:${row.locality_name}:${row.pincode ?? ''}`;
}

const EMPTY_REVENUE_DRAFT = {
  code: '',
  name_en: '',
  name_bn: '',
  name_hi: '',
  accounting_code: '',
  is_active: true,
};

const EMPTY_TARIFF_DRAFT = {
  code: '',
  category: '',
  name_en: '',
  type: 'fixed',
  amount_rupees: '0',
  input_key: '',
};

const EMPTY_ADDRESS_DRAFT = {
  borough_code: '',
  borough_name: '',
  ward_number: '',
  ward_name: '',
  mouza: '',
  locality_name: '',
  pincode: '',
};

export default function MastersClient(): JSX.Element {
  const { token, apiBase, me } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [section, setSection] = useState<MastersSection>('revenue');
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
  const [selectedRevenueCode, setSelectedRevenueCode] = useState<string | null>(null);
  const [selectedTariffCode, setSelectedTariffCode] = useState<string | null>(null);
  const [selectedAddressKey, setSelectedAddressKey] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState(EMPTY_ADDRESS_DRAFT);
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
    try {
      const [revenueRes, addressRes, tariffRes, catalogueRes] = await Promise.all([
        fetch(`${apiBase}/admin/tenant/revenue-heads`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
        fetch(`${apiBase}/admin/tenant/address-master`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
        fetch(`${apiBase}/admin/tenant/tariffs`, { cache: 'no-store', headers: authHeaders() }),
        fetch(`${apiBase}/admin/tenant/catalogue/inherited`, {
          cache: 'no-store',
          headers: authHeaders(),
        }),
      ]);
      if (
        revenueRes.status === 403 ||
        addressRes.status === 403 ||
        tariffRes.status === 403 ||
        catalogueRes.status === 403
      ) {
        setStatus('Administrator access required for Masters.');
        return;
      }
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
    } catch {
      setStatus(`Could not reach the API at ${apiBase}.`);
    }
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

  function selectRevenueHead(head: RevenueHeadRow): void {
    const names = localeNames(head.name);
    const payload = {
      code: head.code,
      name: { en: names.en, bn: names.bn, hi: names.hi },
      accounting_code: head.accounting_code,
      is_active: head.is_active,
    };
    setSelectedRevenueCode(head.code);
    setRevenueDraft({
      code: head.code,
      name_en: names.en,
      name_bn: names.bn,
      name_hi: names.hi,
      accounting_code: head.accounting_code,
      is_active: head.is_active,
    });
    setRevenueText(JSON.stringify(payload, null, 2));
  }

  function newRevenueHead(): void {
    setSelectedRevenueCode(null);
    setRevenueDraft(EMPTY_REVENUE_DRAFT);
    setRevenueText(
      JSON.stringify(
        {
          code: '',
          name: { en: '', bn: '', hi: '' },
          accounting_code: '',
          is_active: true,
        },
        null,
        2,
      ),
    );
  }

  function selectTariff(tariff: TariffRow): void {
    const names = localeNames(tariff.name);
    const rate = tariff.rate_config as Record<string, unknown> | null;
    const type = rate && typeof rate.type === 'string' ? rate.type : 'fixed';
    let amountRupees = '0';
    let inputKey = '';
    if (rate?.type === 'fixed' && typeof rate.amount_paise === 'number') {
      amountRupees = String(rate.amount_paise / 100);
    } else if (rate?.type === 'slab') {
      inputKey = typeof rate.input_key === 'string' ? rate.input_key : '';
      const slabs = Array.isArray(rate.slabs) ? rate.slabs : [];
      const last = slabs[slabs.length - 1] as { amount_paise?: number } | undefined;
      if (last && typeof last.amount_paise === 'number') {
        amountRupees = String(last.amount_paise / 100);
      }
    } else if (rate?.type === 'external' && typeof rate.reference === 'string') {
      inputKey = rate.reference;
    }
    setSelectedTariffCode(tariff.code);
    setTariffDraft({
      code: tariff.code,
      category: tariff.category,
      name_en: names.en,
      type,
      amount_rupees: amountRupees,
      input_key: inputKey,
    });
    setTariffText(
      JSON.stringify(
        {
          code: tariff.code,
          category: tariff.category,
          name: { en: names.en, bn: names.bn, hi: names.hi },
          rate_config: tariff.rate_config,
          is_active: tariff.is_active,
        },
        null,
        2,
      ),
    );
  }

  function newTariff(): void {
    setSelectedTariffCode(null);
    setTariffDraft(EMPTY_TARIFF_DRAFT);
    setTariffText(
      JSON.stringify(
        {
          code: '',
          category: '',
          name: { en: '', bn: '', hi: '' },
          rate_config: { type: 'fixed', amount_paise: 0 },
          is_active: true,
        },
        null,
        2,
      ),
    );
  }

  function selectAddressRow(row: AddressRow): void {
    const key = addressRowKey(row);
    const payload = {
      borough_code: row.borough_code,
      borough_name: row.borough_name,
      ward_number: row.ward_number,
      ward_name: row.ward_name,
      mouza: row.mouza,
      locality_name: row.locality_name,
      pincode: row.pincode,
    };
    setSelectedAddressKey(key);
    setAddressDraft({
      borough_code: row.borough_code ?? '',
      borough_name: row.borough_name ?? '',
      ward_number: row.ward_number ?? '',
      ward_name: row.ward_name ?? '',
      mouza: row.mouza ?? '',
      locality_name: row.locality_name,
      pincode: row.pincode ?? '',
    });
    setAddressText(JSON.stringify(payload, null, 2));
  }

  function newAddressRow(): void {
    setSelectedAddressKey(null);
    setAddressDraft(EMPTY_ADDRESS_DRAFT);
    setAddressText(JSON.stringify(EMPTY_ADDRESS_DRAFT, null, 2));
  }

  async function saveGuidedAddress(): Promise<void> {
    const payload = {
      borough_code: addressDraft.borough_code || null,
      borough_name: addressDraft.borough_name || null,
      ward_number: addressDraft.ward_number || null,
      ward_name: addressDraft.ward_name || null,
      mouza: addressDraft.mouza || null,
      locality_name: addressDraft.locality_name,
      pincode: addressDraft.pincode || null,
    };
    setAddressText(JSON.stringify(payload, null, 2));
    await upsert('address-master', JSON.stringify(payload), 'Address master');
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

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Masters"
        subtitle={
          me?.tenant_code
            ? `Revenue, tariffs, address, and catalogue for ${me.tenant_code}`
            : 'Revenue heads, tariffs, address master, and catalogue governance'
        }
        actions={
          <Button type="button" variant="secondary" onClick={() => void loadMasters()}>
            Refresh
          </Button>
        }
      />

      {status ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {status}
        </p>
      ) : null}

      <nav className="flex flex-wrap gap-2" aria-label="Masters sections">
        {MASTERS_SECTIONS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={section === item.id ? 'primary' : 'secondary'}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>

      {section === 'revenue' ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <GuidedMasterCard
              eyebrow="Sprint 6.10 · Guided masters"
              title={
                selectedRevenueCode
                  ? `Edit revenue head · ${selectedRevenueCode}`
                  : 'New revenue head'
              }
              saveLabel="Save revenue"
              onSave={() => void saveGuidedRevenue()}
            >
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
                  <MasterField
                    key={key}
                    label={label}
                    value={String(revenueDraft[key as keyof typeof revenueDraft])}
                    onChange={(value) => setRevenueDraft((draft) => ({ ...draft, [key]: value }))}
                  />
                ))}
                <label className="flex items-center gap-2 text-sm text-ink-primary">
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
            </GuidedMasterCard>
            <JsonFallbackPanel
              value={revenueText}
              onChange={setRevenueText}
              onSave={() => void upsert('revenue-heads', revenueText, 'Revenue head')}
              saveLabel="Save revenue JSON"
            />
          </div>
          <RecordListPanel
            title="Revenue heads"
            selectedKey={selectedRevenueCode}
            onNew={newRevenueHead}
            newLabel="New head"
            emptyLabel="No revenue heads loaded."
          >
            {revenueHeads.map((head) => (
              <RecordListItem
                key={head.code}
                itemKey={head.code}
                selected={selectedRevenueCode === head.code}
                title={pickLabel(head.name)}
                meta={head.accounting_code}
                onSelect={() => selectRevenueHead(head)}
              />
            ))}
          </RecordListPanel>
        </section>
      ) : null}

      {section === 'tariffs' ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <GuidedMasterCard
              eyebrow="Guided tariff"
              title={selectedTariffCode ? `Edit tariff · ${selectedTariffCode}` : 'New tariff'}
              saveLabel="Save tariff"
              onSave={() => void saveGuidedTariff()}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
                  Type
                  <select
                    className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
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
                  <MasterField
                    key={key}
                    label={label}
                    value={String(tariffDraft[key as keyof typeof tariffDraft])}
                    onChange={(value) => setTariffDraft((draft) => ({ ...draft, [key]: value }))}
                  />
                ))}
              </div>
            </GuidedMasterCard>
            <JsonFallbackPanel
              value={tariffText}
              onChange={setTariffText}
              onSave={() => void upsert('tariffs', tariffText, 'Tariff')}
              saveLabel="Save tariff JSON"
            />
          </div>
          <RecordListPanel
            title="Tariffs"
            selectedKey={selectedTariffCode}
            onNew={newTariff}
            newLabel="New tariff"
            emptyLabel="No tariffs loaded."
          >
            {tariffs.map((tariff) => (
              <RecordListItem
                key={tariff.code}
                itemKey={tariff.code}
                selected={selectedTariffCode === tariff.code}
                title={pickLabel(tariff.name)}
                subtitle={tariff.category}
                meta={
                  tariff.preview_paise === null
                    ? 'external'
                    : `preview ₹${(tariff.preview_paise / 100).toFixed(2)}`
                }
                onSelect={() => selectTariff(tariff)}
              />
            ))}
          </RecordListPanel>
        </section>
      ) : null}

      {section === 'address' ? (
        <section className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <GuidedMasterCard
                eyebrow="Guided address row"
                title={selectedAddressKey ? 'Edit address locality' : 'New address locality'}
                saveLabel="Save address"
                onSave={() => void saveGuidedAddress()}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {(
                    [
                      ['borough_code', 'Borough code'],
                      ['borough_name', 'Borough name'],
                      ['ward_number', 'Ward number'],
                      ['ward_name', 'Ward name'],
                      ['mouza', 'Mouza'],
                      ['locality_name', 'Locality name'],
                      ['pincode', 'PIN code'],
                    ] as Array<[keyof typeof addressDraft, string]>
                  ).map(([key, label]) => (
                    <MasterField
                      key={key}
                      label={label}
                      value={addressDraft[key]}
                      onChange={(value) => setAddressDraft((draft) => ({ ...draft, [key]: value }))}
                    />
                  ))}
                </div>
              </GuidedMasterCard>
              <JsonFallbackPanel
                value={addressText}
                onChange={setAddressText}
                onSave={() => void upsert('address-master', addressText, 'Address master')}
                saveLabel="Save address JSON"
              />
            </div>
            <RecordListPanel
              title="Address rows"
              selectedKey={selectedAddressKey}
              onNew={newAddressRow}
              newLabel="New row"
              emptyLabel="No address rows loaded."
            >
              {addressRows.map((row) => {
                const key = addressRowKey(row);
                return (
                  <RecordListItem
                    key={key}
                    itemKey={key}
                    selected={selectedAddressKey === key}
                    title={row.locality_name}
                    subtitle={`Ward ${row.ward_number ?? '-'} · ${row.borough_name ?? 'No borough'}`}
                    meta={`${row.mouza ?? 'No mouza'} · ${row.pincode ?? 'No PIN'}`}
                    onSelect={() => selectAddressRow(row)}
                  />
                );
              })}
            </RecordListPanel>
          </section>

          <section className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Sprint 6.9 · Bulk address import
                </p>
                <h2 className="text-lg font-semibold text-slate-900">Address master CSV</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Paste CSV rows, dry-run validation, then import valid borough/ward/locality
                  records.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void importAddressCsv(true)}
                >
                  Dry-run
                </Button>
                <Button type="button" size="sm" onClick={() => void importAddressCsv(false)}>
                  Import CSV
                </Button>
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
        </section>
      ) : null}

      {section === 'grievances' ? (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-forest">
              Sprint 6.22 · Grievance taxonomy
            </p>
            <h2 className="text-lg font-semibold text-ink-primary">Grievance catalogue</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Categories and sub-types citizens see when filing. Changes apply on next catalogue
              fetch; PWA/mobile hardcoded lists update in Sprint 6.23.
            </p>
          </div>
          <GrievanceCataloguePanel />
        </section>
      ) : null}

      {section === 'catalogue' ? (
        <section className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-forest">
              Sprint 6.10 · Catalogue governance
            </p>
            <h2 className="text-lg font-semibold text-ink-primary">
              Inherited, forked, and tenant-only services
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Adopt global templates, fork local copies, or deactivate this tenant&apos;s view
              without changing global catalogue rows.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {catalogueRows.map((row) => (
              <CatalogueServiceCard
                key={`${row.source}:${row.code}`}
                row={row}
                onAdopt={
                  row.global_code
                    ? () => void catalogueAction(row.global_code ?? row.code, 'adopt')
                    : undefined
                }
                onFork={() => void catalogueAction(row.global_code ?? row.code, 'fork')}
                onDeactivate={() => void catalogueAction(row.code, 'deactivate')}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function catalogueSourceLabel(source: CatalogueRow['source']): string {
  switch (source) {
    case 'global':
      return 'Global template';
    case 'tenant_override':
      return 'Tenant override';
    case 'tenant_only':
      return 'Tenant only';
    case 'forked':
      return 'Forked copy';
    default:
      return source;
  }
}

function CatalogueSourceBadge({ source }: { source: CatalogueRow['source'] }): JSX.Element {
  const styles: Record<CatalogueRow['source'], string> = {
    global: 'border-forest/30 bg-mint-band text-forest',
    tenant_override: 'border-brand/30 bg-brand-muted/40 text-brand',
    tenant_only: 'border-amber-300/60 bg-amber-50 text-amber-950',
    forked: 'border-warm-border bg-canvas text-ink-secondary',
  };
  return (
    <span
      className={[
        'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        styles[source],
      ].join(' ')}
    >
      {catalogueSourceLabel(source)}
    </span>
  );
}

function CatalogueServiceCard({
  row,
  onAdopt,
  onFork,
  onDeactivate,
}: {
  row: CatalogueRow;
  onAdopt?: () => void;
  onFork: () => void;
  onDeactivate: () => void;
}): JSX.Element {
  return (
    <article className="rounded-2xl border border-warm-border bg-canvas p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink-primary">{pickLabel(row.name)}</h3>
            <CatalogueSourceBadge source={row.source} />
            <span
              className={[
                'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                row.is_active
                  ? 'bg-mint-band text-forest'
                  : 'bg-canvas text-ink-secondary ring-1 ring-warm-border',
              ].join(' ')}
            >
              {row.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="font-mono text-xs text-ink-secondary">
            {row.code} · {row.category_code}
          </p>
          <p className="text-xs text-ink-secondary">
            Global template: {row.global_code ?? 'none'}
            {row.tenant_service_id ? ` · local id ${row.tenant_service_id}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onAdopt ? (
            <Button type="button" size="sm" variant="secondary" onClick={onAdopt}>
              Adopt
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="secondary" onClick={onFork}>
            Fork
          </Button>
          <Button type="button" size="sm" variant="danger" onClick={onDeactivate}>
            Deactivate
          </Button>
        </div>
      </div>
    </article>
  );
}

function GuidedMasterCard({
  eyebrow,
  title,
  saveLabel,
  onSave,
  children,
}: {
  eyebrow: string;
  title: string;
  saveLabel: string;
  onSave: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
            {eyebrow}
          </p>
          <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
        </div>
        <Button type="button" size="sm" onClick={onSave}>
          {saveLabel}
        </Button>
      </div>
      {children}
    </article>
  );
}

function MasterField({
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
