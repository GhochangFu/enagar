'use client';

import { AlertBanner, Button } from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from './tenant-admin-session';

type EvChargerRow = {
  id: string;
  code: string;
  name: unknown;
  location: unknown;
  connector_type: string;
  max_kw: string;
  rate_paise_per_kwh: number;
  is_active: boolean;
  updated_at: string;
};

type EvSessionRow = {
  id: string;
  charger_code: string;
  citizen_id: string;
  vehicle_number: string | null;
  status: string;
  hold_expires_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  kwh_consumed: number | null;
  amount_paise: number | null;
  payment_id: string | null;
  created_at: string;
  updated_at: string;
};

const CONNECTOR_TYPES = ['TYPE2', 'CCS2', 'CHADEMO'] as const;

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Untitled';
  }
  return 'Untitled';
}

function pickLocation(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    const address = record.address;
    if (address && typeof address === 'object' && !Array.isArray(address)) {
      const addressRecord = address as Record<string, unknown>;
      if (typeof addressRecord.en === 'string') {
        return addressRecord.en;
      }
    }
  }
  return '';
}

function asLocaleMap(en: string): Record<string, string> {
  const trimmed = en.trim();
  return { en: trimmed, bn: trimmed, hi: trimmed };
}

function formatInr(paise: number | null): string {
  if (paise == null) return '—';
  return `₹${(paise / 100).toFixed(2)}`;
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function EvChargingOpsPanel(): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [chargers, setChargers] = useState<EvChargerRow[]>([]);
  const [sessions, setSessions] = useState<EvSessionRow[]>([]);

  const [chargerDraft, setChargerDraft] = useState({
    code: 'CHG-TEST-01',
    name_en: 'Test EV Charger',
    location_en: '',
    connector_type: 'TYPE2' as (typeof CONNECTOR_TYPES)[number],
    max_kw: '22',
    rate_paise_per_kwh: '1500',
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
    const res = await fetch(`${apiBase}/admin/tenant/ev-charging`, { headers });
    if (!res.ok) {
      throw new Error(`EV charging load failed (${res.status})`);
    }
    const json = (await res.json()) as {
      chargers: EvChargerRow[];
      sessions: EvSessionRow[];
    };
    setChargers(json.chargers);
    setSessions(json.sessions);
  }, [apiBase, headers, token]);

  useEffect(() => {
    void load().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to load EV charging data');
    });
  }, [load]);

  async function saveCharger(): Promise<void> {
    setStatus(null);
    const ratePaise = Number(chargerDraft.rate_paise_per_kwh);
    const maxKw = Number(chargerDraft.max_kw);
    if (!chargerDraft.code.trim() || !chargerDraft.name_en.trim()) {
      setStatus('Code and English name are required.');
      return;
    }
    if (!Number.isFinite(ratePaise) || ratePaise < 1) {
      setStatus('Rate must be at least 1 paise/kWh.');
      return;
    }
    if (!Number.isFinite(maxKw) || maxKw <= 0) {
      setStatus('Max kW must be greater than zero.');
      return;
    }

    const location = chargerDraft.location_en.trim()
      ? { address: asLocaleMap(chargerDraft.location_en) }
      : {};

    const payload = {
      code: chargerDraft.code.trim(),
      name: asLocaleMap(chargerDraft.name_en),
      location,
      connector_type: chargerDraft.connector_type,
      max_kw: maxKw,
      rate_paise_per_kwh: Math.round(ratePaise),
      is_active: chargerDraft.is_active,
    };

    const res = await fetch(`${apiBase}/admin/tenant/ev-charging/chargers`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setStatus(`Charger save failed (${res.status})`);
      return;
    }
    setStatus(`Charger ${payload.code} saved.`);
    await load();
  }

  function loadChargerIntoForm(charger: EvChargerRow): void {
    setChargerDraft({
      code: charger.code,
      name_en: pickLabel(charger.name),
      location_en: pickLocation(charger.location),
      connector_type: CONNECTOR_TYPES.find((value) => value === charger.connector_type) ?? 'TYPE2',
      max_kw: charger.max_kw,
      rate_paise_per_kwh: String(charger.rate_paise_per_kwh),
      is_active: charger.is_active,
    });
  }

  return (
    <section className="space-y-6">
      {status ? <AlertBanner tone="info">{status}</AlertBanner> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-primary">EV charger</h2>
            <Button type="button" size="sm" onClick={() => void saveCharger()}>
              Save charger
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Code"
              value={chargerDraft.code}
              onChange={(value) => setChargerDraft((draft) => ({ ...draft, code: value }))}
            />
            <Field
              label="Name EN"
              value={chargerDraft.name_en}
              onChange={(value) => setChargerDraft((draft) => ({ ...draft, name_en: value }))}
            />
            <Field
              label="Location EN"
              value={chargerDraft.location_en}
              onChange={(value) => setChargerDraft((draft) => ({ ...draft, location_en: value }))}
            />
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-secondary">
              Connector
              <select
                className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
                value={chargerDraft.connector_type}
                onChange={(event) =>
                  setChargerDraft((draft) => ({
                    ...draft,
                    connector_type: event.target.value as (typeof CONNECTOR_TYPES)[number],
                  }))
                }
              >
                {CONNECTOR_TYPES.map((connector) => (
                  <option key={connector} value={connector}>
                    {connector}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Max kW"
              value={chargerDraft.max_kw}
              onChange={(value) => setChargerDraft((draft) => ({ ...draft, max_kw: value }))}
            />
            <Field
              label="Rate (paise/kWh)"
              value={chargerDraft.rate_paise_per_kwh}
              onChange={(value) =>
                setChargerDraft((draft) => ({ ...draft, rate_paise_per_kwh: value }))
              }
            />
            <label className="flex items-center gap-2 text-sm text-ink-secondary md:col-span-2">
              <input
                type="checkbox"
                checked={chargerDraft.is_active}
                onChange={(event) =>
                  setChargerDraft((draft) => ({ ...draft, is_active: event.target.checked }))
                }
              />
              Active (inactive chargers are hidden from citizens)
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-ink-primary">Chargers</h2>
          <ul className="space-y-2 text-sm">
            {chargers.map((charger) => (
              <li
                key={charger.id}
                className="flex items-center justify-between gap-3 rounded border border-warm-border px-3 py-2"
              >
                <div>
                  <div className="font-medium text-ink-primary">{charger.code}</div>
                  <div className="text-ink-secondary">{pickLabel(charger.name)}</div>
                  <div className="text-xs text-ink-secondary">
                    {charger.connector_type} · {charger.max_kw} kW ·{' '}
                    {formatInr(charger.rate_paise_per_kwh)}/kWh ·{' '}
                    {charger.is_active ? 'active' : 'inactive'}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => loadChargerIntoForm(charger)}
                >
                  Edit
                </Button>
              </li>
            ))}
            {chargers.length === 0 ? (
              <li className="text-ink-secondary">No chargers registered yet.</li>
            ) : null}
          </ul>
        </article>
      </div>

      <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-primary">Recent sessions</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-warm-border text-xs uppercase tracking-wide text-ink-secondary">
                <th className="py-2 pr-3">Charger</th>
                <th className="py-2 pr-3">Vehicle</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">kWh</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Started</th>
                <th className="py-2 pr-3">Ended</th>
                <th className="py-2">Session</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-b border-warm-border/60">
                  <td className="py-2 pr-3">{session.charger_code}</td>
                  <td className="py-2 pr-3">{session.vehicle_number ?? '—'}</td>
                  <td className="py-2 pr-3">{session.status}</td>
                  <td className="py-2 pr-3">
                    {session.kwh_consumed != null ? session.kwh_consumed.toFixed(3) : '—'}
                  </td>
                  <td className="py-2 pr-3">{formatInr(session.amount_paise)}</td>
                  <td className="py-2 pr-3">{formatWhen(session.started_at)}</td>
                  <td className="py-2 pr-3">{formatWhen(session.ended_at)}</td>
                  <td className="py-2 font-mono text-xs">{session.id.slice(0, 8)}…</td>
                </tr>
              ))}
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-3 text-ink-secondary">
                    No sessions yet.
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
