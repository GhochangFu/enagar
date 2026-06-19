'use client';

import { AlertBanner, Button } from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from './tenant-admin-session';

type HealthFleetAssetType = 'AMBULANCE' | 'HEARSE';

type BookableAssetRow = {
  code: string;
  asset_type: string;
  name: { en?: string; bn?: string; hi?: string };
  location?: { ward?: string; address?: { en?: string }; depot?: string };
  base_rate_paise: number;
  security_deposit_paise: number;
  slot_step_minutes: number;
  is_active: boolean;
  rules?: { bpl_subsidy_paise?: number };
};

function formatInr(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function assetLabel(name: BookableAssetRow['name']): string {
  return name.en?.trim() || name.bn?.trim() || name.hi?.trim() || 'Fleet unit';
}

export function HealthBookingOpsPanel(): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [units, setUnits] = useState<BookableAssetRow[]>([]);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const emptyDraft = {
    code: '',
    asset_type: 'AMBULANCE' as HealthFleetAssetType,
    name_en: '',
    base_rate_paise: '50000',
    bpl_subsidy_paise: '',
    is_active: true,
  };
  const [draft, setDraft] = useState(emptyDraft);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/admin/tenant/bookings`, { headers });
    if (!res.ok) {
      throw new Error(`Bookings load failed (${res.status})`);
    }
    const json = (await res.json()) as { assets: BookableAssetRow[] };
    setUnits(
      json.assets.filter(
        (row) => row.asset_type === 'AMBULANCE' || row.asset_type === 'HEARSE',
      ),
    );
  }, [apiBase, headers, token]);

  useEffect(() => {
    void load().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to load health fleet');
    });
  }, [load]);

  async function saveUnit(): Promise<void> {
    const code = draft.code.trim();
    const nameEn = draft.name_en.trim();
    if (!code || !nameEn) {
      setStatus('Fleet unit requires a code and English name.');
      return;
    }
    setStatus(null);
    const rules: Record<string, unknown> = {
      citizen_selectable: false,
      min_duration_minutes: 60,
      max_duration_minutes: 480,
      advance_booking_hours: 1,
    };
    if (draft.asset_type === 'HEARSE' && draft.bpl_subsidy_paise.trim()) {
      rules.bpl_subsidy_paise = Number(draft.bpl_subsidy_paise) || 0;
    }
    const res = await fetch(`${apiBase}/admin/tenant/bookings/assets`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        code,
        asset_type: draft.asset_type,
        name: { en: nameEn, bn: nameEn, hi: nameEn },
        location: {
          depot: 'KMC Central Fleet Depot',
          address: { en: 'Municipal Health Depot' },
        },
        rate_unit: 'HOUR',
        base_rate_paise: Number(draft.base_rate_paise) || 50_000,
        security_deposit_paise: 0,
        slot_step_minutes: 60,
        rules,
        is_active: draft.is_active,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      setStatus(`Save failed (${res.status}): ${text.slice(0, 200)}`);
      return;
    }
    setStatus(
      `Saved ${draft.asset_type === 'AMBULANCE' ? 'ambulance' : 'hearse'} ${code}. Citizens book the pooled service — link units under Services → ambulance/hearse → Bookable assets.`,
    );
    setEditingCode(code);
    await load();
  }

  function loadUnitIntoForm(unit: BookableAssetRow): void {
    setEditingCode(unit.code);
    setDraft({
      code: unit.code,
      asset_type: unit.asset_type as HealthFleetAssetType,
      name_en: assetLabel(unit.name),
      base_rate_paise: String(unit.base_rate_paise),
      bpl_subsidy_paise:
        unit.rules?.bpl_subsidy_paise != null ? String(unit.rules.bpl_subsidy_paise) : '',
      is_active: unit.is_active,
    });
  }

  const ambulances = units.filter((row) => row.asset_type === 'AMBULANCE');
  const hearses = units.filter((row) => row.asset_type === 'HEARSE');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Health fleet bookings</h3>
        <p className="mt-1 text-sm text-slate-600">
          Manage ambulance and hearse units. Citizens see pooled availability only — not individual
          vehicle names. Assign availability under Operations → Bookings calendar.
        </p>
      </div>

      {status ? <AlertBanner tone="info">{status}</AlertBanner> : null}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="font-medium text-slate-900">
          {editingCode ? `Edit ${editingCode}` : 'New fleet unit'}
        </h4>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Code</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              disabled={Boolean(editingCode)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Type</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={draft.asset_type}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  asset_type: e.target.value as HealthFleetAssetType,
                }))
              }
            >
              <option value="AMBULANCE">Ambulance</option>
              <option value="HEARSE">Hearse</option>
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="text-slate-600">English name (admin only)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={draft.name_en}
              onChange={(e) => setDraft((d) => ({ ...d, name_en: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Hourly rate (paise)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={draft.base_rate_paise}
              onChange={(e) => setDraft((d) => ({ ...d, base_rate_paise: e.target.value }))}
            />
          </label>
          {draft.asset_type === 'HEARSE' ? (
            <label className="block text-sm">
              <span className="text-slate-600">BPL subsidy (paise, optional)</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={draft.bpl_subsidy_paise}
                onChange={(e) => setDraft((d) => ({ ...d, bpl_subsidy_paise: e.target.value }))}
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
            />
            Active (included in citizen pool)
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void saveUnit()}>
            Save unit
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingCode(null);
              setDraft(emptyDraft);
            }}
          >
            New unit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="font-medium text-slate-900">Ambulances ({ambulances.length})</h4>
          <ul className="mt-2 space-y-2">
            {ambulances.map((unit) => (
              <li
                key={unit.code}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{assetLabel(unit.name)}</div>
                  <div className="text-slate-500">
                    {unit.code} · {formatInr(unit.base_rate_paise)}/hr
                    {!unit.is_active ? ' · inactive' : ''}
                  </div>
                </div>
                <Button type="button" variant="secondary" onClick={() => loadUnitIntoForm(unit)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-slate-900">Hearse vans ({hearses.length})</h4>
          <ul className="mt-2 space-y-2">
            {hearses.map((unit) => (
              <li
                key={unit.code}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{assetLabel(unit.name)}</div>
                  <div className="text-slate-500">
                    {unit.code} · {formatInr(unit.base_rate_paise)}/hr
                    {!unit.is_active ? ' · inactive' : ''}
                  </div>
                </div>
                <Button type="button" variant="secondary" onClick={() => loadUnitIntoForm(unit)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
