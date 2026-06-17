'use client';

import { AlertBanner, Button } from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from './tenant-admin-session';

type SmartZoneRow = {
  id: string;
  code: string;
  name: unknown;
  ward_number: string | null;
  capacity_bays: number;
  is_active: boolean;
  bay_count: number;
};

type ParkingBayRow = {
  id: string;
  zone_code: string;
  bay_code: string;
  status: string;
};

type OccupancyBay = {
  code: string;
  status: string;
};

type EffectiveOccupancyBay = {
  code: string;
  status: string;
};

type EffectiveOccupancy = {
  zone_code: string;
  free_count: number;
  total_count: number;
  bays: EffectiveOccupancyBay[];
  polled_at: string;
};

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Untitled';
  }
  return 'Untitled';
}

function asLocaleMap(en: string): Record<string, string> {
  const trimmed = en.trim();
  return { en: trimmed, bn: trimmed, hi: trimmed };
}

export function SmartParkingOpsPanel(): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [zones, setZones] = useState<SmartZoneRow[]>([]);
  const [bays, setBays] = useState<ParkingBayRow[]>([]);
  const [occupancy, setOccupancy] = useState<OccupancyBay[]>([]);
  const [occupancyScenario, setOccupancyScenario] = useState<string | null>(null);
  const [effectiveOccupancy, setEffectiveOccupancy] = useState<EffectiveOccupancy | null>(null);
  const [effectiveZoneCode, setEffectiveZoneCode] = useState('ZONE-A');

  const [zoneDraft, setZoneDraft] = useState({
    code: 'ZONE-A',
    name_en: 'Central Market Parking — Zone A',
    ward_number: '',
    capacity_bays: '20',
    is_active: true,
  });

  const [bayDraft, setBayDraft] = useState({
    zone_code: 'ZONE-A',
    bay_code: 'B01',
    status: 'FREE',
  });

  const [bulkDraft, setBulkDraft] = useState({
    zone_code: 'ZONE-A',
    count: '20',
    prefix: 'B',
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
    const res = await fetch(`${apiBase}/admin/tenant/smart-parking`, { headers });
    if (!res.ok) {
      throw new Error(`Smart parking load failed (${res.status})`);
    }
    const json = (await res.json()) as { zones: SmartZoneRow[]; bays: ParkingBayRow[] };
    setZones(json.zones);
    setBays(json.bays);
  }, [apiBase, headers, token]);

  useEffect(() => {
    void load().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to load smart parking data');
    });
  }, [load]);

  async function saveZone(): Promise<void> {
    setStatus(null);
    const payload = {
      code: zoneDraft.code.trim(),
      name: asLocaleMap(zoneDraft.name_en),
      ward_number: zoneDraft.ward_number.trim() || undefined,
      capacity_bays: Number(zoneDraft.capacity_bays),
      is_active: zoneDraft.is_active,
      geo: {},
    };
    const res = await fetch(`${apiBase}/admin/tenant/smart-parking/zones`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setStatus(`Zone save failed (${res.status})`);
      return;
    }
    setStatus('Smart zone saved.');
    await load();
  }

  async function saveBay(): Promise<void> {
    setStatus(null);
    const payload = {
      zone_code: bayDraft.zone_code.trim(),
      bay_code: bayDraft.bay_code.trim(),
      status: bayDraft.status,
    };
    const res = await fetch(`${apiBase}/admin/tenant/smart-parking/bays`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setStatus(`Bay save failed (${res.status})`);
      return;
    }
    setStatus('Parking bay saved.');
    await load();
  }

  async function bulkCreateBays(): Promise<void> {
    setStatus(null);
    const payload = {
      zone_code: bulkDraft.zone_code.trim(),
      count: Number(bulkDraft.count),
      prefix: bulkDraft.prefix.trim() || 'B',
    };
    const res = await fetch(`${apiBase}/admin/tenant/smart-parking/bays/bulk`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setStatus(`Bulk bay create failed (${res.status})`);
      return;
    }
    setStatus(`Created ${payload.count} bays for ${payload.zone_code}.`);
    await load();
  }

  async function refreshEffectiveOccupancy(zoneCode: string): Promise<void> {
    setStatus(null);
    const res = await fetch(
      `${apiBase}/admin/tenant/smart-parking/zones/${encodeURIComponent(zoneCode)}/bays/effective`,
      { headers },
    );
    if (!res.ok) {
      setStatus(`Effective occupancy load failed (${res.status})`);
      return;
    }
    const json = (await res.json()) as EffectiveOccupancy;
    setEffectiveOccupancy(json);
    setEffectiveZoneCode(zoneCode);
    setStatus(
      `${zoneCode}: ${json.free_count}/${json.total_count} free (merged DB + sensor) · ${new Date(json.polled_at).toLocaleString()}`,
    );
  }

  useEffect(() => {
    if (!token || zones.length === 0) return;
    const code = zones[0]?.code ?? 'ZONE-A';
    void refreshEffectiveOccupancy(code).catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to load effective occupancy');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when zones arrive
  }, [token, zones.length]);

  async function refreshOccupancy(zoneCode: string): Promise<void> {
    setStatus(null);
    const res = await fetch(`${apiBase}/admin/tenant/smart-parking/zones/${zoneCode}/occupancy`, {
      headers,
    });
    if (!res.ok) {
      setStatus(`Occupancy poll failed (${res.status})`);
      return;
    }
    const json = (await res.json()) as {
      bays: OccupancyBay[];
      scenario: string;
      polledAt: string;
    };
    setOccupancy(json.bays);
    setOccupancyScenario(`${json.scenario} · ${new Date(json.polledAt).toLocaleString()}`);
    setStatus(`Stub sensor polled for ${zoneCode}.`);
  }

  function loadZoneIntoForm(zone: SmartZoneRow): void {
    setZoneDraft({
      code: zone.code,
      name_en: pickLabel(zone.name),
      ward_number: zone.ward_number ?? '',
      capacity_bays: String(zone.capacity_bays),
      is_active: zone.is_active,
    });
  }

  return (
    <section className="space-y-6">
      {status ? <AlertBanner tone="info">{status}</AlertBanner> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-primary">Smart zone</h2>
            <Button type="button" size="sm" onClick={() => void saveZone()}>
              Save zone
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Code"
              value={zoneDraft.code}
              onChange={(v) => setZoneDraft((d) => ({ ...d, code: v }))}
            />
            <Field
              label="Name EN"
              value={zoneDraft.name_en}
              onChange={(v) => setZoneDraft((d) => ({ ...d, name_en: v }))}
            />
            <Field
              label="Ward number"
              value={zoneDraft.ward_number}
              onChange={(v) => setZoneDraft((d) => ({ ...d, ward_number: v }))}
            />
            <Field
              label="Capacity (bays)"
              value={zoneDraft.capacity_bays}
              onChange={(v) => setZoneDraft((d) => ({ ...d, capacity_bays: v }))}
            />
            <label className="flex items-center gap-2 text-sm text-ink-secondary md:col-span-2">
              <input
                type="checkbox"
                checked={zoneDraft.is_active}
                onChange={(event) =>
                  setZoneDraft((d) => ({ ...d, is_active: event.target.checked }))
                }
              />
              Active
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-ink-primary">Zones</h2>
          <ul className="space-y-2 text-sm">
            {zones.map((zone) => (
              <li
                key={zone.id}
                className="flex items-center justify-between gap-3 rounded border border-warm-border px-3 py-2"
              >
                <div>
                  <div className="font-medium text-ink-primary">{zone.code}</div>
                  <div className="text-ink-secondary">{pickLabel(zone.name)}</div>
                  <div className="text-xs text-ink-secondary">
                    {zone.bay_count}/{zone.capacity_bays} bays ·{' '}
                    {zone.is_active ? 'active' : 'inactive'}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => loadZoneIntoForm(zone)}
                >
                  Edit
                </Button>
              </li>
            ))}
            {zones.length === 0 ? <li className="text-ink-secondary">No zones yet.</li> : null}
          </ul>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-primary">Parking bay</h2>
            <Button type="button" size="sm" onClick={() => void saveBay()}>
              Save bay
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Zone code"
              value={bayDraft.zone_code}
              onChange={(v) => setBayDraft((d) => ({ ...d, zone_code: v }))}
            />
            <Field
              label="Bay code"
              value={bayDraft.bay_code}
              onChange={(v) => setBayDraft((d) => ({ ...d, bay_code: v }))}
            />
            <label className="block text-xs font-medium uppercase tracking-wide text-ink-secondary">
              Status
              <select
                className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case tracking-normal"
                value={bayDraft.status}
                onChange={(event) => setBayDraft((d) => ({ ...d, status: event.target.value }))}
              >
                <option value="FREE">FREE</option>
                <option value="OCCUPIED">OCCUPIED</option>
                <option value="RESERVED">RESERVED</option>
                <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
              </select>
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-primary">Bulk create bays</h2>
            <Button type="button" size="sm" onClick={() => void bulkCreateBays()}>
              Generate
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Zone code"
              value={bulkDraft.zone_code}
              onChange={(v) => setBulkDraft((d) => ({ ...d, zone_code: v }))}
            />
            <Field
              label="Count"
              value={bulkDraft.count}
              onChange={(v) => setBulkDraft((d) => ({ ...d, count: v }))}
            />
            <Field
              label="Prefix"
              value={bulkDraft.prefix}
              onChange={(v) => setBulkDraft((d) => ({ ...d, prefix: v }))}
            />
          </div>
        </article>
      </div>

      <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-primary">Live occupancy (DB + sensor)</h2>
            {effectiveOccupancy ? (
              <p className="text-xs text-ink-secondary">
                {effectiveOccupancy.zone_code}: {effectiveOccupancy.free_count}/
                {effectiveOccupancy.total_count} free · updated{' '}
                {new Date(effectiveOccupancy.polled_at).toLocaleString()}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => (
              <Button
                key={zone.id}
                type="button"
                size="sm"
                variant={effectiveZoneCode === zone.code ? 'primary' : 'secondary'}
                onClick={() => void refreshEffectiveOccupancy(zone.code)}
              >
                Refresh {zone.code}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-10">
          {(effectiveOccupancy?.bays ?? []).map((bay) => (
            <div
              key={bay.code}
              className={`rounded border px-2 py-2 text-center text-xs font-medium ${
                bay.status === 'FREE'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : bay.status === 'OCCUPIED'
                    ? 'border-slate-300 bg-slate-100 text-slate-600'
                    : bay.status === 'RESERVED'
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-rose-300 bg-rose-50 text-rose-800'
              }`}
            >
              {bay.code}
              <div className="text-[10px] font-normal">{bay.status}</div>
            </div>
          ))}
          {!effectiveOccupancy?.bays.length ? (
            <p className="col-span-full text-sm text-ink-secondary">
              Refresh a zone to preview merged occupancy (reservations + stub sensor).
            </p>
          ) : null}
        </div>
      </article>

      <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-primary">Stub sensor occupancy</h2>
            {occupancyScenario ? (
              <p className="text-xs text-ink-secondary">Scenario: {occupancyScenario}</p>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void refreshOccupancy(zoneDraft.code || 'ZONE-A')}
          >
            Refresh ZONE-A
          </Button>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-10">
          {occupancy.map((bay) => (
            <div
              key={bay.code}
              className={`rounded border px-2 py-2 text-center text-xs font-medium ${
                bay.status === 'FREE'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : bay.status === 'OCCUPIED'
                    ? 'border-rose-300 bg-rose-50 text-rose-800'
                    : 'border-amber-300 bg-amber-50 text-amber-800'
              }`}
            >
              {bay.code}
              <div className="text-[10px] font-normal">{bay.status}</div>
            </div>
          ))}
          {occupancy.length === 0 ? (
            <p className="col-span-full text-sm text-ink-secondary">
              Poll the stub sensor to preview bay occupancy (KMC pilot: B01 and B02 occupied).
            </p>
          ) : null}
        </div>
      </article>

      <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-ink-primary">Registered bays</h2>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-warm-border text-xs uppercase tracking-wide text-ink-secondary">
                <th className="py-2 pr-3">Zone</th>
                <th className="py-2 pr-3">Bay</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {bays.map((bay) => (
                <tr key={bay.id} className="border-b border-warm-border/60">
                  <td className="py-2 pr-3">{bay.zone_code}</td>
                  <td className="py-2 pr-3">{bay.bay_code}</td>
                  <td className="py-2">{bay.status}</td>
                </tr>
              ))}
              {bays.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-ink-secondary">
                    No bays registered yet.
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
