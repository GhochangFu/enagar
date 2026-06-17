'use client';

import { Badge, Button, Card } from '@enagar/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { completeBookingStubPayment } from '../lib/bookings-api';
import {
  confirmSmartParkingHold,
  createSmartParkingHold,
  fetchSmartParkingBays,
  fetchSmartParkingZones,
  initiateSmartParkingPayment,
  quoteSmartParking,
  smartParkingIdempotencyKey,
} from '../lib/smart-parking-api';
import { formatInrFromPaise } from '../lib/workspace-http';

import type { TokenResponse } from '../lib/workspace-types';
import type { JSX } from 'react';

type Props = {
  apiBaseUrl: string;
  tenantCode: string;
  token: TokenResponse;
  onBack: () => void;
  onStatus: (message: string) => void;
};

function bayButtonClass(status: string, selected: boolean): string {
  if (selected) {
    return 'border-brand bg-brand text-brand-fg';
  }
  if (status === 'FREE') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (status === 'RESERVED') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-slate-200 bg-slate-100 text-slate-500';
}

export function SmartParkingWorkspace({
  apiBaseUrl,
  tenantCode,
  token,
  onBack,
  onStatus,
}: Props): JSX.Element {
  const [zones, setZones] = useState<
    Array<{ code: string; free_count: number; total_count: number }>
  >([]);
  const [zoneCode, setZoneCode] = useState<string | null>(null);
  const [bays, setBays] = useState<Array<{ code: string; status: string }>>([]);
  const [bayCode, setBayCode] = useState<string | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ rent_paise: number } | null>(null);
  const [hold, setHold] = useState<{
    hold_id: string;
    payment: { id: string; gateway_order_id: string; status: string } | null;
  } | null>(null);
  const [bookingNo, setBookingNo] = useState<string | null>(null);
  const [durationHours, setDurationHours] = useState(1);
  const submittingRef = useRef(false);
  const startsAt = useMemo(() => new Date().toISOString(), []);
  const endsAt = useMemo(
    () => new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
    [durationHours, startsAt],
  );

  const loadZones = useCallback(async (): Promise<void> => {
    const items = await fetchSmartParkingZones(apiBaseUrl, token, tenantCode);
    setZones(items);
    setZoneCode((current) => current ?? items[0]?.code ?? null);
  }, [apiBaseUrl, tenantCode, token]);

  const loadBays = useCallback(
    async (activeZone: string): Promise<Array<{ code: string; status: string }>> => {
      const items = await fetchSmartParkingBays(apiBaseUrl, token, tenantCode, activeZone);
      setBays(items);
      setBayCode((current) => {
        if (current && items.some((bay) => bay.code === current && bay.status === 'FREE')) {
          return current;
        }
        return items.find((bay) => bay.status === 'FREE')?.code ?? null;
      });
      return items;
    },
    [apiBaseUrl, tenantCode, token],
  );

  useEffect(() => {
    void (async () => {
      try {
        await loadZones();
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Unable to load zones';
        setMessage(text);
        onStatus(text);
      }
    })();
  }, [loadZones, onStatus]);

  useEffect(() => {
    if (!zoneCode) return;
    void (async () => {
      try {
        await loadBays(zoneCode);
      } catch (error) {
        const text = error instanceof Error ? error.message : 'Unable to load bays';
        setMessage(text);
        onStatus(text);
      }
    })();
  }, [loadBays, onStatus, zoneCode]);

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

  async function runQuote(): Promise<void> {
    if (!zoneCode || !bayCode) return;
    setBusy(true);
    setMessage(null);
    try {
      const vehicle_number = assertVehicleNumber();
      const data = await quoteSmartParking(apiBaseUrl, token, tenantCode, {
        zone_code: zoneCode,
        bay_code: bayCode,
        starts_at: startsAt,
        ends_at: endsAt,
        vehicle_number,
      });
      setQuote({ rent_paise: data.rent_paise });
      onStatus(`Smart parking quote ready: ${formatInrFromPaise(data.rent_paise)}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to quote smart parking';
      setMessage(text);
      onStatus(text);
    } finally {
      setBusy(false);
    }
  }

  async function reserveAndPay(): Promise<void> {
    if (!zoneCode || !bayCode || submittingRef.current || bookingNo) return;
    submittingRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const vehicle_number = assertVehicleNumber();
      const created = await createSmartParkingHold(apiBaseUrl, token, tenantCode, {
        zone_code: zoneCode,
        bay_code: bayCode,
        starts_at: startsAt,
        ends_at: endsAt,
        vehicle_number,
      });
      const withPayment = await initiateSmartParkingPayment(
        apiBaseUrl,
        token,
        tenantCode,
        created.hold_id,
        'upi',
        smartParkingIdempotencyKey(created.hold_id),
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
      const confirmed = await confirmSmartParkingHold(
        apiBaseUrl,
        token,
        tenantCode,
        created.hold_id,
        withPayment.payment.id,
      );
      setHold(withPayment);
      setBookingNo(confirmed.booking_no);
      setQuote(null);
      onStatus(`Smart parking confirmed: ${confirmed.booking_no}`);
      await loadZones();
      await loadBays(zoneCode);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unable to reserve and pay';
      setMessage(text);
      onStatus(text);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  const canTransact = Boolean(bayCode) && normalizedVehicleNumber().length >= 4 && !bookingNo;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-brand">Smart parking</p>
          <h3 className="text-2xl font-bold text-ink-primary">Reserve a bay and pay</h3>
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

      <Card className="space-y-3 p-4">
        <p className="text-sm font-semibold text-ink-secondary">Zones</p>
        <div className="flex flex-wrap gap-2">
          {zones.map((zone) => (
            <button
              key={zone.code}
              className={`rounded-xl border px-3 py-2 text-sm ${
                zoneCode === zone.code ? 'border-brand bg-brand-muted' : 'border-slate-200'
              }`}
              onClick={() => setZoneCode(zone.code)}
              type="button"
            >
              {zone.code} ({zone.free_count}/{zone.total_count} free)
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-ink-secondary">Vehicle registration</span>
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            disabled={Boolean(bookingNo)}
            maxLength={20}
            minLength={4}
            onChange={(event) => {
              setVehicleNumber(event.target.value);
              setQuote(null);
            }}
            placeholder="e.g. WB06A1234"
            value={vehicleNumber}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-ink-secondary">Duration</span>
          <select
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            disabled={Boolean(bookingNo) || busy}
            onChange={(event) => {
              setDurationHours(Number(event.target.value));
              setQuote(null);
            }}
            value={durationHours}
          >
            <option value={1}>1 hour</option>
            <option value={2}>2 hours</option>
            <option value={3}>3 hours</option>
          </select>
        </label>
      </Card>

      <Card className="space-y-3 p-4">
        <p className="text-sm font-semibold text-ink-secondary">Bay grid</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {bays.map((bay) => {
            const selectable = bay.status === 'FREE';
            return (
              <button
                key={bay.code}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold ${bayButtonClass(
                  bay.status,
                  bayCode === bay.code,
                )}`}
                disabled={!selectable}
                onClick={() => {
                  setBayCode(bay.code);
                  setQuote(null);
                }}
                type="button"
              >
                {bay.code}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">FREE</Badge>
          <Badge tone="warning">RESERVED</Badge>
          <Badge tone="neutral">OCCUPIED / OUT_OF_SERVICE</Badge>
        </div>
      </Card>

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Button disabled={busy || !canTransact} onClick={() => void runQuote()} variant="secondary">
          Quote
        </Button>
        <Button disabled={busy || !canTransact} onClick={() => void reserveAndPay()}>
          Reserve and pay now
        </Button>
        {quote ? (
          <p className="text-sm font-semibold">
            Rent ({durationHours} hr): {formatInrFromPaise(quote.rent_paise)}
          </p>
        ) : null}
        {bookingNo ? (
          <p className="text-sm font-semibold text-emerald-700">Confirmed: {bookingNo}</p>
        ) : null}
        {hold?.payment ? (
          <p className="text-xs text-ink-secondary">Payment {hold.payment.id}</p>
        ) : null}
      </Card>
    </div>
  );
}
