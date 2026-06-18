'use client';

import { Button, Card } from '@enagar/ui';
import { useRef, useState } from 'react';

import {
  completeWaterMeterStubRecharge,
  initiateWaterMeterRecharge,
  lookupWaterMeter,
  waterRechargeIdempotencyKey,
} from '../lib/water-meter-api';
import { formatInrFromPaise } from '../lib/workspace-http';

import type { WaterMeterLookup } from '../lib/water-meter-api';
import type { TokenResponse } from '../lib/workspace-types';
import type { JSX } from 'react';

type Props = {
  apiBaseUrl: string;
  tenantCode: string;
  token: TokenResponse;
  onBack: () => void;
  onStatus: (message: string) => void;
};

const PRESET_AMOUNTS = [10_000, 50_000, 100_000] as const;

function formatReading(litres: number | null): string {
  return litres == null ? 'Not available' : `${litres.toLocaleString('en-IN')} litres`;
}

export function WaterMeterRechargeWorkspace({
  apiBaseUrl,
  tenantCode,
  token,
  onBack,
  onStatus,
}: Props): JSX.Element {
  const [meterId, setMeterId] = useState('WM-001');
  const [amountPaise, setAmountPaise] = useState(50_000);
  const [meter, setMeter] = useState<WaterMeterLookup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  const normalizedMeterId = meterId.trim().toUpperCase();

  async function loadMeter(): Promise<void> {
    if (!normalizedMeterId || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await lookupWaterMeter(apiBaseUrl, token, tenantCode, normalizedMeterId);
      setMeter(result);
      onStatus(`Meter ${result.meter_id} balance loaded`);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to load meter';
      setMessage(text);
      onStatus(text);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  async function recharge(): Promise<void> {
    if (!meter || submittingRef.current) return;
    if (!Number.isInteger(amountPaise) || amountPaise < 100) {
      setMessage('Enter a recharge amount of at least ₹1.00.');
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const initiated = await initiateWaterMeterRecharge(
        apiBaseUrl,
        token,
        tenantCode,
        meter.meter_id,
        amountPaise,
        'upi',
        waterRechargeIdempotencyKey(meter.meter_id, amountPaise),
      );
      if (!initiated.payment) {
        throw new Error('Payment initiation failed');
      }
      await completeWaterMeterStubRecharge(apiBaseUrl, token, tenantCode, initiated.payment);
      const refreshed = await lookupWaterMeter(apiBaseUrl, token, tenantCode, meter.meter_id);
      setMeter(refreshed);
      onStatus(
        `Water recharge complete — ${formatInrFromPaise(amountPaise)} credited to ${meter.meter_id}`,
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to complete recharge';
      setMessage(text);
      onStatus(text);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-brand">IoT water</p>
          <h3 className="text-2xl font-bold text-ink-primary">Check balance and recharge</h3>
        </div>
        <Button onClick={onBack} variant="secondary">
          Back to services
        </Button>
      </div>

      {message ? (
        <Card className="border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {message}
        </Card>
      ) : null}

      <Card className="space-y-4 p-4">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-ink-secondary">Meter ID</span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase"
            maxLength={80}
            minLength={3}
            onChange={(event) => setMeterId(event.target.value)}
            placeholder="e.g. WM-001"
            value={meterId}
          />
        </label>
        <Button disabled={busy || normalizedMeterId.length < 3} onClick={() => void loadMeter()}>
          Lookup meter
        </Button>
      </Card>

      {meter ? (
        <Card className="space-y-4 p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-ink-secondary">Meter</p>
            <h4 className="text-xl font-bold text-ink-primary">{meter.meter_id}</h4>
            <p className="text-sm text-ink-secondary">{meter.consumer_name}</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-mint-band p-3">
              <dt className="text-xs font-semibold uppercase text-ink-secondary">Balance</dt>
              <dd className="text-lg font-bold text-ink-primary">
                {formatInrFromPaise(meter.balance_paise)}
              </dd>
            </div>
            <div className="rounded-2xl bg-mint-band p-3">
              <dt className="text-xs font-semibold uppercase text-ink-secondary">Last reading</dt>
              <dd className="text-sm font-semibold text-ink-primary">
                {formatReading(meter.last_reading_litres)}
              </dd>
            </div>
            <div className="rounded-2xl bg-mint-band p-3">
              <dt className="text-xs font-semibold uppercase text-ink-secondary">Reading time</dt>
              <dd className="text-sm font-semibold text-ink-primary">
                {meter.last_reading_at ? new Date(meter.last_reading_at).toLocaleString() : '—'}
              </dd>
            </div>
          </dl>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink-secondary">Recharge amount</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    amountPaise === amount
                      ? 'border-brand bg-brand-muted text-brand'
                      : 'border-slate-200 text-ink-primary'
                  }`}
                  disabled={busy}
                  key={amount}
                  onClick={() => setAmountPaise(amount)}
                  type="button"
                >
                  {formatInrFromPaise(amount)}
                </button>
              ))}
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase text-ink-secondary">
                Custom amount (₹)
              </span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                min={1}
                onChange={(event) => setAmountPaise(Math.round(Number(event.target.value) * 100))}
                type="number"
                value={(amountPaise / 100).toString()}
              />
            </label>
          </div>

          <Button disabled={busy || amountPaise < 100} onClick={() => void recharge()}>
            Pay and recharge
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
