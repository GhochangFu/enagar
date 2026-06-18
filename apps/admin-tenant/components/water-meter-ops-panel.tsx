'use client';

import { AlertBanner, Button } from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from './tenant-admin-session';

type WaterMeterAccountRow = {
  id: string;
  meter_id: string;
  consumer_name: string;
  consumer_phone: string | null;
  balance_paise: number;
  last_reading_litres: number | null;
  last_reading_at: string | null;
  is_active: boolean;
  updated_at: string;
};

type WaterMeterRechargeRow = {
  id: string;
  meter_id: string;
  citizen_subject: string;
  amount_paise: number;
  status: string;
  payment_id: string | null;
  balance_after_paise: number | null;
  created_at: string;
  credited_at: string | null;
};

const CSV_TEMPLATE = `meter_id,consumer_name,consumer_phone,balance_paise,last_reading_litres
WM-004,Demo Water Consumer,9876543210,10000,42000`;

function formatInr(paise: number | null): string {
  if (paise == null) return '—';
  return `₹${(paise / 100).toFixed(2)}`;
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function parseCsvRows(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [headerLine, ...rows] = lines;
  if (!headerLine) return [];
  const headers = headerLine.split(',').map((header) => header.trim());
  return rows.map((row) => {
    const cells = row.split(',').map((cell) => cell.trim());
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

export function WaterMeterOpsPanel(): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<WaterMeterAccountRow[]>([]);
  const [recharges, setRecharges] = useState<WaterMeterRechargeRow[]>([]);
  const [csvText, setCsvText] = useState(CSV_TEMPLATE);
  const [draft, setDraft] = useState({
    meter_id: 'WM-TEST-01',
    consumer_name: 'Test Water Consumer',
    consumer_phone: '9876543210',
    balance_paise: '10000',
    last_reading_litres: '50000',
    is_active: true,
  });

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/admin/tenant/iot-water`, { headers });
    if (!res.ok) {
      throw new Error(`Water meter load failed (${res.status})`);
    }
    const json = (await res.json()) as {
      accounts: WaterMeterAccountRow[];
      recharges: WaterMeterRechargeRow[];
    };
    setAccounts(json.accounts);
    setRecharges(json.recharges);
  }, [apiBase, headers, token]);

  useEffect(() => {
    void load().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to load water meters');
    });
  }, [load]);

  async function saveAccount(): Promise<void> {
    setStatus(null);
    const balancePaise = Number(draft.balance_paise);
    const lastReading = Number(draft.last_reading_litres);
    if (!draft.meter_id.trim() || !draft.consumer_name.trim()) {
      setStatus('Meter ID and consumer name are required.');
      return;
    }
    if (!Number.isInteger(balancePaise) || balancePaise < 0) {
      setStatus('Opening balance must be a non-negative paise amount.');
      return;
    }

    const payload = {
      meter_id: draft.meter_id.trim().toUpperCase(),
      consumer_name: draft.consumer_name.trim(),
      consumer_phone: draft.consumer_phone.trim(),
      balance_paise: balancePaise,
      last_reading_litres: Number.isFinite(lastReading) ? Math.max(0, Math.round(lastReading)) : 0,
      is_active: draft.is_active,
    };

    const res = await fetch(`${apiBase}/admin/tenant/iot-water/accounts`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setStatus(`Water meter save failed (${res.status})`);
      return;
    }
    setStatus(`Meter ${payload.meter_id} saved.`);
    await load();
  }

  async function importCsv(): Promise<void> {
    setStatus(null);
    const accountsPayload = parseCsvRows(csvText).map((row) => ({
      meter_id: row.meter_id,
      consumer_name: row.consumer_name,
      consumer_phone: row.consumer_phone,
      balance_paise: Number(row.balance_paise || 0),
      last_reading_litres: Number(row.last_reading_litres || 0),
      is_active: true,
    }));
    if (accountsPayload.length === 0) {
      setStatus('Paste at least one CSV row to import.');
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/iot-water/accounts/import`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ accounts: accountsPayload }),
    });
    if (!res.ok) {
      setStatus(`CSV import failed (${res.status})`);
      return;
    }
    const json = (await res.json()) as { imported: number };
    setStatus(`Imported ${json.imported} meter account(s).`);
    await load();
  }

  function loadAccountIntoForm(account: WaterMeterAccountRow): void {
    setDraft({
      meter_id: account.meter_id,
      consumer_name: account.consumer_name,
      consumer_phone: account.consumer_phone ?? '',
      balance_paise: String(account.balance_paise),
      last_reading_litres: String(account.last_reading_litres ?? 0),
      is_active: account.is_active,
    });
  }

  return (
    <section className="space-y-6">
      {status ? <AlertBanner tone="info">{status}</AlertBanner> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-primary">Water meter account</h2>
            <Button type="button" size="sm" onClick={() => void saveAccount()}>
              Save meter
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Meter ID"
              value={draft.meter_id}
              onChange={(value) => setDraft((current) => ({ ...current, meter_id: value }))}
            />
            <Field
              label="Consumer name"
              value={draft.consumer_name}
              onChange={(value) => setDraft((current) => ({ ...current, consumer_name: value }))}
            />
            <Field
              label="Consumer phone"
              value={draft.consumer_phone}
              onChange={(value) => setDraft((current) => ({ ...current, consumer_phone: value }))}
            />
            <Field
              label="Balance (paise)"
              value={draft.balance_paise}
              onChange={(value) => setDraft((current) => ({ ...current, balance_paise: value }))}
            />
            <Field
              label="Last reading (litres)"
              value={draft.last_reading_litres}
              onChange={(value) =>
                setDraft((current) => ({ ...current, last_reading_litres: value }))
              }
            />
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, is_active: event.target.checked }))
                }
              />
              Active
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-ink-primary">CSV import</h2>
          <textarea
            className="min-h-36 w-full rounded border border-warm-border p-3 font-mono text-xs"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
          />
          <div className="mt-3">
            <Button type="button" size="sm" onClick={() => void importCsv()}>
              Import CSV rows
            </Button>
          </div>
        </article>
      </div>

      <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Meters</h2>
        <ul className="space-y-2 text-sm">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center justify-between gap-3 rounded border border-warm-border px-3 py-2"
            >
              <div>
                <div className="font-medium text-ink-primary">{account.meter_id}</div>
                <div className="text-ink-secondary">{account.consumer_name}</div>
                <div className="text-xs text-ink-secondary">
                  {account.consumer_phone ?? 'no phone'} · {formatInr(account.balance_paise)} ·{' '}
                  {account.is_active ? 'active' : 'inactive'}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => loadAccountIntoForm(account)}
              >
                Edit
              </Button>
            </li>
          ))}
          {accounts.length === 0 ? (
            <li className="text-ink-secondary">No water meters registered yet.</li>
          ) : null}
        </ul>
      </article>

      <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-primary">Recharge ledger</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-warm-border text-xs uppercase tracking-wide text-ink-secondary">
                <th className="py-2 pr-3">Meter</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Balance after</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Credited</th>
                <th className="py-2">Recharge</th>
              </tr>
            </thead>
            <tbody>
              {recharges.map((recharge) => (
                <tr key={recharge.id} className="border-b border-warm-border/60">
                  <td className="py-2 pr-3">{recharge.meter_id}</td>
                  <td className="py-2 pr-3">{formatInr(recharge.amount_paise)}</td>
                  <td className="py-2 pr-3">{recharge.status}</td>
                  <td className="py-2 pr-3">{formatInr(recharge.balance_after_paise)}</td>
                  <td className="py-2 pr-3">{formatWhen(recharge.created_at)}</td>
                  <td className="py-2 pr-3">{formatWhen(recharge.credited_at)}</td>
                  <td className="py-2 font-mono text-xs">{recharge.id.slice(0, 8)}…</td>
                </tr>
              ))}
              {recharges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-ink-secondary">
                    No recharges yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function Field({
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
