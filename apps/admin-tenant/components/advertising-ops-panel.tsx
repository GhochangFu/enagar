'use client';

import { AlertBanner, Button } from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from './tenant-admin-session';

type WardRow = {
  number: string;
  name: string | null;
};

type HoardingWardRateRow = {
  ward_code: string;
  rate_paise_per_sqft_per_month: number;
};

type HoardingRateMatrixResponse = {
  flat_rate_paise_per_sqft_per_month: number;
  ward_rates: HoardingWardRateRow[];
  wards: WardRow[];
};

type HoardingQuotePreview = {
  tax_paise: number;
  revenue_head_code: string;
  ward_matched: boolean;
  ward_code: string;
  sqft: number;
  duration_months: number;
  rate_paise_per_sqft_per_month: number;
};

function formatInr(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function AdvertisingOpsPanel(): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [wards, setWards] = useState<WardRow[]>([]);
  const [flatRate, setFlatRate] = useState('5000');
  const [wardRates, setWardRates] = useState<HoardingWardRateRow[]>([]);
  const [preview, setPreview] = useState<HoardingQuotePreview | null>(null);

  const [previewDraft, setPreviewDraft] = useState({
    ward_code: '12',
    width_ft: '10',
    height_ft: '8',
    duration_months: '3',
  });

  const [newRow, setNewRow] = useState({
    ward_code: '',
    rate_paise_per_sqft_per_month: '7500',
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
    const res = await fetch(`${apiBase}/admin/tenant/advertising/hoarding-rates`, { headers });
    if (!res.ok) {
      throw new Error(`Hoarding rates load failed (${res.status})`);
    }
    const json = (await res.json()) as HoardingRateMatrixResponse;
    setFlatRate(String(json.flat_rate_paise_per_sqft_per_month));
    setWardRates(json.ward_rates);
    setWards(json.wards);
  }, [apiBase, headers, token]);

  useEffect(() => {
    void load().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to load hoarding rates');
    });
  }, [load]);

  async function saveMatrix(): Promise<void> {
    setStatus(null);
    const payload = {
      flat_rate_paise_per_sqft_per_month: Number(flatRate),
      ward_rates: wardRates,
    };
    const res = await fetch(`${apiBase}/admin/tenant/advertising/hoarding-rates`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Save failed (${res.status})`);
    }
    await load();
    setStatus('Hoarding rate matrix saved.');
  }

  async function runPreview(): Promise<void> {
    setStatus(null);
    setPreview(null);
    const payload = {
      ward_code: previewDraft.ward_code.trim(),
      width_ft: Number(previewDraft.width_ft),
      height_ft: Number(previewDraft.height_ft),
      duration_months: Number(previewDraft.duration_months),
    };
    const res = await fetch(`${apiBase}/admin/tenant/advertising/hoarding-rates/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Preview failed (${res.status})`);
    }
    setPreview((await res.json()) as HoardingQuotePreview);
  }

  function addWardRow(): void {
    const ward_code = newRow.ward_code.trim();
    if (!ward_code) {
      setStatus('Ward code is required.');
      return;
    }
    setWardRates((rows) => [
      ...rows.filter((row) => row.ward_code !== ward_code),
      {
        ward_code,
        rate_paise_per_sqft_per_month: Number(newRow.rate_paise_per_sqft_per_month),
      },
    ]);
    setNewRow((draft) => ({ ...draft, ward_code: '' }));
  }

  function removeWardRow(wardCode: string): void {
    setWardRates((rows) => rows.filter((row) => row.ward_code !== wardCode));
  }

  return (
    <div className="space-y-6">
      {status ? <AlertBanner tone="info">{status}</AlertBanner> : null}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-ink-primary">Hoarding rate matrix</h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Ward-specific rates (paise per sqft per month). Unknown wards use the flat fallback rate.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-ink-secondary">Flat fallback rate (paise / sqft / month)</span>
            <input
              className="mt-1 w-full rounded border border-border px-3 py-2"
              value={flatRate}
              onChange={(event) => setFlatRate(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-secondary">
                <th className="py-2 pr-4">Ward</th>
                <th className="py-2 pr-4">Rate (paise / sqft / month)</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {wardRates.map((row) => (
                <tr key={row.ward_code} className="border-b border-border/60">
                  <td className="py-2 pr-4">{row.ward_code}</td>
                  <td className="py-2 pr-4">{row.rate_paise_per_sqft_per_month}</td>
                  <td className="py-2">
                    <Button variant="ghost" size="sm" onClick={() => removeWardRow(row.ward_code)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="block text-sm">
            <span className="text-ink-secondary">Ward code</span>
            <select
              className="mt-1 w-full rounded border border-border px-3 py-2"
              value={newRow.ward_code}
              onChange={(event) => setNewRow((draft) => ({ ...draft, ward_code: event.target.value }))}
            >
              <option value="">Select ward…</option>
              {wards.map((ward) => (
                <option key={ward.number} value={ward.number}>
                  {ward.number}
                  {ward.name ? ` — ${ward.name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink-secondary">Rate (paise)</span>
            <input
              className="mt-1 w-full rounded border border-border px-3 py-2"
              value={newRow.rate_paise_per_sqft_per_month}
              onChange={(event) =>
                setNewRow((draft) => ({ ...draft, rate_paise_per_sqft_per_month: event.target.value }))
              }
            />
          </label>
          <div className="flex items-end">
            <Button variant="secondary" onClick={() => addWardRow()}>
              Add ward rate
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={() => void saveMatrix().catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Save failed'))}>
            Save matrix
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-ink-primary">Quote preview</h3>
        <p className="mt-1 text-sm text-ink-secondary">
          Validates hoarding tax math using the saved matrix (ward × sqft × months).
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="block text-sm">
            <span className="text-ink-secondary">Ward code</span>
            <input
              className="mt-1 w-full rounded border border-border px-3 py-2"
              value={previewDraft.ward_code}
              onChange={(event) => setPreviewDraft((draft) => ({ ...draft, ward_code: event.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-secondary">Width (ft)</span>
            <input
              className="mt-1 w-full rounded border border-border px-3 py-2"
              value={previewDraft.width_ft}
              onChange={(event) => setPreviewDraft((draft) => ({ ...draft, width_ft: event.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-secondary">Height (ft)</span>
            <input
              className="mt-1 w-full rounded border border-border px-3 py-2"
              value={previewDraft.height_ft}
              onChange={(event) => setPreviewDraft((draft) => ({ ...draft, height_ft: event.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-secondary">Duration (months)</span>
            <input
              className="mt-1 w-full rounded border border-border px-3 py-2"
              value={previewDraft.duration_months}
              onChange={(event) =>
                setPreviewDraft((draft) => ({ ...draft, duration_months: event.target.value }))
              }
            />
          </label>
        </div>

        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() =>
              void runPreview().catch((error: unknown) =>
                setStatus(error instanceof Error ? error.message : 'Preview failed'),
              )
            }
          >
            Run preview
          </Button>
        </div>

        {preview ? (
          <dl className="mt-4 grid gap-2 text-sm md:grid-cols-2">
            <div>
              <dt className="text-ink-secondary">Tax</dt>
              <dd className="font-medium">{formatInr(preview.tax_paise)}</dd>
            </div>
            <div>
              <dt className="text-ink-secondary">Sqft</dt>
              <dd className="font-medium">{preview.sqft}</dd>
            </div>
            <div>
              <dt className="text-ink-secondary">Rate applied</dt>
              <dd className="font-medium">
                {preview.rate_paise_per_sqft_per_month} paise / sqft / month
                {preview.ward_matched ? ' (ward match)' : ' (flat fallback)'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-secondary">Revenue head</dt>
              <dd className="font-medium">{preview.revenue_head_code}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </div>
  );
}
