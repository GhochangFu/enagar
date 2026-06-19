'use client';

import { Badge, Button, Card } from '@enagar/ui';
import { useCallback, useEffect, useState } from 'react';

import {
  buildApplyFormPrefill,
  fetchHoardingContext,
  quoteHoardingTax,
  type HoardingCalculatorSnapshot,
  type HoardingWardOption,
} from '../lib/advertising-api';
import { formatInrFromPaise } from '../lib/workspace-http';

import type { TokenResponse } from '../lib/workspace-types';
import type { JSX } from 'react';

type Props = {
  apiBaseUrl: string;
  tenantCode: string;
  token: TokenResponse;
  onBack: () => void;
  onContinue: (prefill: Record<string, string>) => void;
  onStatus: (message: string) => void;
};

export function HoardingCalculatorWorkspace({
  apiBaseUrl,
  tenantCode,
  token,
  onBack,
  onContinue,
  onStatus,
}: Props): JSX.Element {
  const [wards, setWards] = useState<HoardingWardOption[]>([]);
  const [wardCode, setWardCode] = useState('');
  const [widthFt, setWidthFt] = useState('10');
  const [heightFt, setHeightFt] = useState('8');
  const [durationMonths, setDurationMonths] = useState('3');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [quote, setQuote] = useState<HoardingCalculatorSnapshot | null>(null);

  const loadWards = useCallback(async (): Promise<void> => {
    const context = await fetchHoardingContext(apiBaseUrl, token, tenantCode);
    setWards(context.wards);
    setWardCode((current) => current || context.wards[0]?.number || '');
  }, [apiBaseUrl, tenantCode, token]);

  useEffect(() => {
    void loadWards().catch((error: unknown) => {
      const text = error instanceof Error ? error.message : 'Unable to load wards';
      setMessage(text);
      onStatus(text);
    });
  }, [loadWards, onStatus]);

  async function runQuote(): Promise<void> {
    setBusy(true);
    setMessage(null);
    setQuote(null);
    try {
      const snapshot = await quoteHoardingTax(apiBaseUrl, token, tenantCode, {
        ward_code: wardCode.trim(),
        width_ft: Number(widthFt),
        height_ft: Number(heightFt),
        duration_months: Number(durationMonths),
      });
      setQuote(snapshot);
      onStatus(
        `Hoarding quote: ${formatInrFromPaise(snapshot.tax_paise)} for ward ${snapshot.ward_code}`,
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Quote failed';
      setMessage(text);
      onStatus(text);
    } finally {
      setBusy(false);
    }
  }

  function continueToApply(): void {
    if (!quote) {
      setMessage('Get a quote before continuing to apply.');
      return;
    }
    onContinue(
      buildApplyFormPrefill({
        snapshot: quote,
        widthFt: Number(widthFt),
        heightFt: Number(heightFt),
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink-primary">Hoarding fee calculator</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Estimate hoarding tax from ward, size, and duration before you apply for permission.
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          Back to services
        </Button>
      </div>

      {message ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{message}</Card>
      ) : null}

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-ink-secondary">Ward</span>
            <select
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              value={wardCode}
              onChange={(event) => setWardCode(event.target.value)}
            >
              {wards.map((ward) => (
                <option key={ward.number} value={ward.number}>
                  {ward.number}
                  {ward.name ? ` — ${ward.name}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink-secondary">Duration (months)</span>
            <input
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              min={1}
              max={12}
              type="number"
              value={durationMonths}
              onChange={(event) => setDurationMonths(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-secondary">Width (ft)</span>
            <input
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              min={0.01}
              step="0.01"
              type="number"
              value={widthFt}
              onChange={(event) => setWidthFt(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-secondary">Height (ft)</span>
            <input
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              min={0.01}
              step="0.01"
              type="number"
              value={heightFt}
              onChange={(event) => setHeightFt(event.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button disabled={busy || !wardCode} onClick={() => void runQuote()}>
            Get quote
          </Button>
          <Button disabled={!quote} variant="secondary" onClick={continueToApply}>
            Continue to apply
          </Button>
        </div>

        {quote ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-emerald-900">
                Estimated tax: {formatInrFromPaise(quote.tax_paise)}
              </p>
              <Badge tone={quote.ward_matched ? 'success' : 'neutral'}>
                {quote.ward_matched ? 'Ward rate applied' : 'Flat fallback rate'}
              </Badge>
            </div>
            <dl className="mt-3 grid gap-2 text-sm text-emerald-900 md:grid-cols-2">
              <div>
                <dt className="text-emerald-700">Ward</dt>
                <dd className="font-medium">{quote.ward_code}</dd>
              </div>
              <div>
                <dt className="text-emerald-700">Area</dt>
                <dd className="font-medium">{quote.sqft} sqft</dd>
              </div>
              <div>
                <dt className="text-emerald-700">Duration</dt>
                <dd className="font-medium">{quote.duration_months} months</dd>
              </div>
              <div>
                <dt className="text-emerald-700">Rate</dt>
                <dd className="font-medium">
                  {formatInrFromPaise(quote.rate_paise_per_sqft_per_month)} / sqft / month
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-emerald-800">
              After officer approval you will pay the permission fee plus this hoarding tax as one
              combined approval payment.
            </p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
