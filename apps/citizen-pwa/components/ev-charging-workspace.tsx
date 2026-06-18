'use client';

import { Badge, Button, Card } from '@enagar/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import { completeBookingStubPayment } from '../lib/bookings-api';
import {
  confirmEvChargingPayment,
  createEvChargingHold,
  evChargingIdempotencyKey,
  fetchEvChargers,
  initiateEvChargingPayment,
  startEvChargingSession,
  stopEvChargingSession,
} from '../lib/ev-charging-api';
import { formatInrFromPaise } from '../lib/workspace-http';

import type { EvCharger, EvSession } from '../lib/ev-charging-api';
import type { TokenResponse } from '../lib/workspace-types';
import type { JSX } from 'react';

type Props = {
  apiBaseUrl: string;
  tenantCode: string;
  token: TokenResponse;
  onBack: () => void;
  onStatus: (message: string) => void;
};

function localizedName(name: EvCharger['name']): string {
  if (typeof name === 'string') {
    return name;
  }
  return name.en ?? Object.values(name)[0] ?? 'EV charger';
}

function formatRatePerKwh(paise: number): string {
  return `${formatInrFromPaise(paise)}/kWh`;
}

function sessionStep(session: EvSession | null): 'list' | 'held' | 'charging' | 'bill' | 'done' {
  if (!session) {
    return 'list';
  }
  if (session.status === 'COMPLETED') {
    return 'done';
  }
  if (session.status === 'awaiting_payment') {
    return 'bill';
  }
  if (session.status === 'CHARGING') {
    return 'charging';
  }
  if (session.status === 'HELD') {
    return 'held';
  }
  return 'list';
}

export function EvChargingWorkspace({
  apiBaseUrl,
  tenantCode,
  token,
  onBack,
  onStatus,
}: Props): JSX.Element {
  const [chargers, setChargers] = useState<EvCharger[]>([]);
  const [chargerCode, setChargerCode] = useState<string | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [session, setSession] = useState<EvSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const loadChargers = useCallback(async (): Promise<void> => {
    const items = await fetchEvChargers(apiBaseUrl, token, tenantCode);
    setChargers(items);
  }, [apiBaseUrl, tenantCode, token]);

  useEffect(() => {
    void (async () => {
      try {
        await loadChargers();
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Unable to load chargers';
        setMessage(text);
        onStatus(text);
      }
    })();
  }, [loadChargers, onStatus]);

  function normalizedVehicleNumber(): string {
    return vehicleNumber.trim().toUpperCase();
  }

  function assertVehicleNumber(): string {
    const normalized = normalizedVehicleNumber();
    if (normalized.length < 4 || normalized.length > 20) {
      throw new Error('Enter a valid vehicle registration number (4–20 characters).');
    }
    return normalized;
  }

  async function reserveCharger(): Promise<void> {
    if (!chargerCode || submittingRef.current || session) return;
    submittingRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const vehicle_number = assertVehicleNumber();
      const held = await createEvChargingHold(
        apiBaseUrl,
        token,
        tenantCode,
        chargerCode,
        vehicle_number,
      );
      setSession(held);
      onStatus(`Charger ${chargerCode} reserved for 15 minutes`);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to reserve charger';
      setMessage(text);
      onStatus(text);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  const canReserve =
    Boolean(chargerCode) && normalizedVehicleNumber().length >= 4 && !session && !busy;

  async function startCharging(): Promise<void> {
    if (!session || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const started = await startEvChargingSession(
        apiBaseUrl,
        token,
        tenantCode,
        session.session_id,
      );
      setSession(started);
      onStatus('Charging started');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to start charging';
      setMessage(text);
      onStatus(text);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  async function stopCharging(): Promise<void> {
    if (!session || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const stopped = await stopEvChargingSession(
        apiBaseUrl,
        token,
        tenantCode,
        session.session_id,
      );
      setSession(stopped);
      const amount = stopped.amount_paise ?? 0;
      onStatus(
        `Charging stopped — ${stopped.kwh_consumed ?? 0} kWh · ${formatInrFromPaise(amount)}`,
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to stop charging';
      setMessage(text);
      onStatus(text);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  async function payAndComplete(): Promise<void> {
    if (!session || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const withPayment = await initiateEvChargingPayment(
        apiBaseUrl,
        token,
        tenantCode,
        session.session_id,
        'upi',
        evChargingIdempotencyKey(session.session_id),
      );
      if (!withPayment.payment) {
        throw new Error('Payment initiation failed');
      }
      await completeBookingStubPayment(
        apiBaseUrl,
        token,
        tenantCode,
        withPayment.payment.id,
        withPayment.payment.gateway_order_id,
      );
      const completed = await confirmEvChargingPayment(
        apiBaseUrl,
        token,
        tenantCode,
        session.session_id,
        withPayment.payment.id,
      );
      setSession(completed);
      onStatus('EV charging session completed — receipt available in Payments');
      await loadChargers();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to complete payment';
      setMessage(text);
      onStatus(text);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  const step = sessionStep(session);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-brand">EV charging</p>
          <h3 className="text-2xl font-bold text-ink-primary">Reserve, charge, and pay</h3>
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

      {step === 'list' ? (
        <>
          <Card className="space-y-3 p-4">
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-ink-secondary">Vehicle registration</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                maxLength={20}
                minLength={4}
                onChange={(event) => setVehicleNumber(event.target.value)}
                placeholder="e.g. WB06A1234"
                value={vehicleNumber}
              />
            </label>
          </Card>

          <Card className="space-y-3 p-4">
            <p className="text-sm font-semibold text-ink-secondary">Available chargers</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {chargers.map((charger) => {
                const selected = chargerCode === charger.code;
                return (
                  <button
                    key={charger.code}
                    className={`rounded-2xl border p-4 text-left transition ${
                      !charger.available
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                        : selected
                          ? 'border-brand bg-brand-muted'
                          : 'border-slate-200 hover:border-brand hover:bg-brand-muted'
                    }`}
                    disabled={!charger.available || busy}
                    onClick={() => setChargerCode(charger.code)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink-primary">
                          {localizedName(charger.name)}
                        </p>
                        <p className="text-xs text-ink-secondary">{charger.code}</p>
                      </div>
                      <Badge tone={charger.available ? 'success' : 'neutral'}>
                        {charger.available ? 'Available' : 'Busy'}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-secondary">
                      <div>
                        <dt className="font-medium">Connector</dt>
                        <dd>{charger.connector_type}</dd>
                      </div>
                      <div>
                        <dt className="font-medium">Max power</dt>
                        <dd>{charger.max_kw} kW</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="font-medium">Rate</dt>
                        <dd>{formatRatePerKwh(charger.rate_paise_per_kwh)}</dd>
                      </div>
                    </dl>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="flex flex-wrap items-center gap-3 p-4">
            <Button disabled={!canReserve} onClick={() => void reserveCharger()}>
              Reserve charger
            </Button>
            {chargerCode ? (
              <p className="text-sm text-ink-secondary">Selected: {chargerCode}</p>
            ) : null}
          </Card>
        </>
      ) : null}

      {session && step !== 'list' ? (
        <Card className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink-secondary">Active session</p>
              <p className="text-lg font-bold">{session.charger_code}</p>
              {session.vehicle_number ? (
                <p className="text-sm text-ink-secondary">Vehicle {session.vehicle_number}</p>
              ) : null}
            </div>
            <Badge tone={step === 'done' ? 'success' : 'warning'}>
              {session.status === 'awaiting_payment' ? 'Awaiting payment' : session.status}
            </Badge>
          </div>

          {session.hold_expires_at && step === 'held' ? (
            <p className="text-sm text-ink-secondary">
              Hold expires at {new Date(session.hold_expires_at).toLocaleTimeString()}
            </p>
          ) : null}

          {session.kwh_consumed != null ? (
            <p className="text-sm">
              Consumed: <strong>{session.kwh_consumed} kWh</strong>
              {session.amount_paise != null ? (
                <>
                  {' '}
                  · Bill: <strong>{formatInrFromPaise(session.amount_paise)}</strong>
                </>
              ) : null}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {step === 'held' ? (
              <Button disabled={busy} onClick={() => void startCharging()}>
                Start charging
              </Button>
            ) : null}
            {step === 'charging' ? (
              <Button disabled={busy} onClick={() => void stopCharging()}>
                Stop charging
              </Button>
            ) : null}
            {step === 'bill' ? (
              <Button disabled={busy} onClick={() => void payAndComplete()}>
                Pay {session.amount_paise != null ? formatInrFromPaise(session.amount_paise) : ''}
              </Button>
            ) : null}
            {step === 'done' ? (
              <p className="text-sm font-semibold text-emerald-700">
                Session complete. View receipt in Payments.
              </p>
            ) : null}
          </div>

          {session.payment ? (
            <p className="text-xs text-ink-secondary">Payment {session.payment.id}</p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
