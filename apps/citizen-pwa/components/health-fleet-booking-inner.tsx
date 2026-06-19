'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  addDaysYmd,
  formatIstDate,
  formatIstTimeRange,
  isIstWeekday,
  istDayEndUtc,
  istDayStartUtc,
  nextIstWeekdayYmd,
  parseBookingDurationRules,
  selectionDurationMinutes,
  slotStepMinutes,
  toggleSlotSelection,
  ymdInIst,
  type SlotSelection,
} from '../lib/booking-slot-grid';
import {
  completeBookingStubPayment,
  confirmBookingHold,
  createFleetBookingHold,
  fetchFleetAvailability,
  initiateBookingHoldPayment,
  quoteFleetBooking,
  type BookingReservation,
  type FleetBookingQuote,
} from '../lib/bookings-api';
import { formatInrFromPaise } from '../lib/workspace-http';

import { BookingConfirmationPanel } from './booking-confirmation-panel';
import { BookingHourGrid } from './booking-hour-grid';

import type { PwaLocaleCode, ServiceSummary, TokenResponse } from '../lib/workspace-types';
import type { JSX } from 'react';

type FleetStep = 'calendar' | 'details' | 'checkout' | 'done';

type HealthFleetBookingInnerProps = {
  apiBaseUrl: string;
  token: TokenResponse;
  tenantCode: string;
  language: PwaLocaleCode;
  linkedService: ServiceSummary;
  onStatus: (message: string) => void;
  onBack: () => void;
};

const FLEET_RULES = parseBookingDurationRules({
  min_duration_minutes: 60,
  max_duration_minutes: 480,
});

export function HealthFleetBookingInner({
  apiBaseUrl,
  token,
  tenantCode,
  language,
  linkedService,
  onStatus,
  onBack,
}: HealthFleetBookingInnerProps): JSX.Element {
  const serviceCode = linkedService.code;
  const isAmbulance = serviceCode === 'ambulance';
  const isHearse = serviceCode === 'hearse';
  const localeTag = language === 'bn' ? 'bn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';

  const [step, setStep] = useState<FleetStep>('calendar');
  const [selectedDay, setSelectedDay] = useState(() =>
    nextIstWeekdayYmd(addDaysYmd(ymdInIst(new Date()), 1)),
  );
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof fetchFleetAvailability>>>([]);
  const [slotSelection, setSlotSelection] = useState<SlotSelection>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [holderName, setHolderName] = useState('');
  const [holderMobile, setHolderMobile] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [bplDeclared, setBplDeclared] = useState(false);
  const [quote, setQuote] = useState<FleetBookingQuote | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<BookingReservation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const fleetUnitLabel = useCallback(
    (units: number) => {
      const noun = isAmbulance
        ? units === 1
          ? 'ambulance'
          : 'ambulances'
        : units === 1
          ? 'hearse'
          : 'hearses';
      return `${units} ${noun} available`;
    },
    [isAmbulance],
  );

  const loadSlots = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const from = istDayStartUtc(selectedDay).toISOString();
      const to = istDayEndUtc(selectedDay).toISOString();
      const rows = await fetchFleetAvailability(apiBaseUrl, tenantCode, serviceCode, from, to);
      setSlots(rows);
      setSlotSelection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load fleet availability');
    } finally {
      setBusy(false);
    }
  }, [apiBaseUrl, tenantCode, serviceCode, selectedDay]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const dayOptions = useMemo(() => {
    const weekdays: string[] = [];
    let cursor = addDaysYmd(ymdInIst(new Date()), 1);
    while (weekdays.length < 14) {
      if (isIstWeekday(cursor)) {
        weekdays.push(cursor);
      }
      cursor = addDaysYmd(cursor, 1);
    }
    return weekdays;
  }, []);

  const slotSummaryLine = slotSelection
    ? `${formatIstDate(slotSelection.startsAt, localeTag)} · ${formatIstTimeRange(slotSelection.startsAt, slotSelection.endsAt, localeTag)}`
    : null;

  const heading = isAmbulance ? 'Book municipal ambulance' : 'Book hearse van';
  const subheading = isAmbulance
    ? 'Choose a time slot — the municipality assigns an available ambulance automatically.'
    : 'Choose a time slot — the municipality assigns the hearse van automatically.';

  async function proceedToCheckout(): Promise<void> {
    if (!slotSelection) {
      return;
    }
    if (isAmbulance && !pickupAddress.trim()) {
      setError('Pickup address is required for ambulance booking.');
      return;
    }
    if (emergency && !isAmbulance) {
      setError('Emergency booking is only available for ambulance.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const q = await quoteFleetBooking(apiBaseUrl, token, tenantCode, {
        tenant_code: tenantCode,
        service_code: serviceCode,
        starts_at: slotSelection.startsAt,
        ends_at: slotSelection.endsAt,
      });
      setQuote(q);

      const hold = await createFleetBookingHold(apiBaseUrl, token, tenantCode, {
        tenant_code: tenantCode,
        service_code: serviceCode,
        starts_at: slotSelection.startsAt,
        ends_at: slotSelection.endsAt,
        holder_name: holderName.trim() || undefined,
        holder_mobile: holderMobile.trim() || undefined,
        pickup_address: isAmbulance ? { en: pickupAddress.trim() } : undefined,
        emergency: isAmbulance && emergency ? true : undefined,
        bpl_declared: isHearse && bplDeclared ? true : undefined,
      });
      setHoldId(hold.id);

      if (emergency || hold.rent_paise === 0) {
        onStatus('Emergency hold placed — confirming without payment…');
        const reservation = await confirmBookingHold(apiBaseUrl, token, tenantCode, hold.id);
        setConfirmed(reservation);
        setStep('done');
        onStatus(
          reservation.booking_no
            ? `Emergency booking ${reservation.booking_no} confirmed`
            : 'Emergency booking confirmed.',
        );
        return;
      }

      setStep('checkout');
      onStatus('Slot held — complete payment to confirm.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place hold');
    } finally {
      setBusy(false);
    }
  }

  async function completePaymentAndConfirm(): Promise<void> {
    if (!holdId || !quote) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onStatus('Paying booking fee (stub)…');
      const checkout = await initiateBookingHoldPayment(
        apiBaseUrl,
        token,
        tenantCode,
        holdId,
        'upi',
        `fleet-${holdId}`,
        quote.rent_paise > 0,
      );
      await completeBookingStubPayment(
        apiBaseUrl,
        token,
        tenantCode,
        checkout.payment.id,
        checkout.payment.gateway_order_id,
      );

      onStatus('Confirming booking…');
      const reservation = await confirmBookingHold(apiBaseUrl, token, tenantCode, holdId, {
        depositId: checkout.deposit_id || undefined,
      });
      setConfirmed(reservation);
      setStep('done');
      onStatus(
        reservation.booking_no
          ? `Booking ${reservation.booking_no} confirmed`
          : 'Booking confirmed.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment or confirmation failed');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'done' && confirmed?.booking_no) {
    return (
      <div className="space-y-4">
        <BookingConfirmationPanel
          apiBaseUrl={apiBaseUrl}
          bookingNo={confirmed.booking_no}
          reservationId={confirmed.id}
          tenantScopeCode={tenantCode}
          token={token}
        />
        <button
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
          onClick={onBack}
          type="button"
        >
          Back to services
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-brand">Health</p>
          <h3 className="text-2xl font-bold text-slate-900">{heading}</h3>
          <p className="mt-1 text-sm text-slate-600">{subheading}</p>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
          onClick={onBack}
          type="button"
        >
          Cancel
        </button>
      </div>

      {error ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {step === 'calendar' ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {dayOptions.map((day) => (
              <button
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  selectedDay === day
                    ? 'bg-brand text-white'
                    : 'border border-slate-200 text-slate-700'
                }`}
                key={day}
                onClick={() => setSelectedDay(day)}
                type="button"
              >
                {formatIstDate(istDayStartUtc(day), localeTag, 'short')}
              </button>
            ))}
          </div>
          {busy ? (
            <p className="text-sm text-slate-600">Loading availability…</p>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">No bookable hours on this day.</p>
              <p className="mt-1">
                Fleet services run on <strong>weekdays 09:00–21:00 IST</strong>. Try another day or
                ask the ULB to refresh fleet availability.
              </p>
            </div>
          ) : slots.every((slot) => slot.status === 'taken' || slot.available_units <= 0) ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">All units booked for this day.</p>
              <p className="mt-1">No {isAmbulance ? 'ambulances' : 'hearse vans'} are free on the selected date.</p>
            </div>
          ) : (
            <BookingHourGrid
              fleetUnitLabel={fleetUnitLabel}
              locale={language}
              onSelectSlot={(slot) => {
                const next = toggleSlotSelection(slots, slotSelection, slot, FLEET_RULES);
                setSlotSelection(next);
                if (next) {
                  setAnnouncement(
                    `Selected ${formatIstTimeRange(next.startsAt, next.endsAt, localeTag)}`,
                  );
                } else {
                  setAnnouncement('Selection cleared');
                }
              }}
              rules={FLEET_RULES}
              selected={slotSelection}
              selectionAnnouncement={announcement}
              slots={slots}
            />
          )}
          {slotSelection ? (
            <p className="text-sm text-slate-700">
              {formatIstDate(slotSelection.startsAt, localeTag)} ·{' '}
              {formatIstTimeRange(slotSelection.startsAt, slotSelection.endsAt, localeTag)} (
              {selectionDurationMinutes(slotSelection, slotStepMinutes(slots))} min)
            </p>
          ) : null}
          <button
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!slotSelection || busy}
            onClick={() => setStep('details')}
            type="button"
          >
            Continue to details
          </button>
        </section>
      ) : null}

      {step === 'details' ? (
        <section className="space-y-4">
          {slotSummaryLine ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Selected slot</p>
              <p className="mt-1">{slotSummaryLine}</p>
            </div>
          ) : null}

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-800">
              Contact name
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setHolderName(event.target.value)}
                type="text"
                value={holderName}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Mobile number
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                inputMode="tel"
                onChange={(event) => setHolderMobile(event.target.value)}
                type="tel"
                value={holderMobile}
              />
            </label>
            {isAmbulance ? (
              <>
                <label className="block text-sm font-semibold text-slate-800">
                  Pickup address <span className="text-red-600">*</span>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    onChange={(event) => setPickupAddress(event.target.value)}
                    required
                    rows={3}
                    value={pickupAddress}
                  />
                </label>
                <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                  <input
                    checked={emergency}
                    className="mt-1"
                    onChange={(event) => setEmergency(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Emergency ambulance</strong> — I declare this is a medical emergency.
                    No booking fee applies (max 2 emergency bookings per day). Municipality may audit
                    this declaration.
                  </span>
                </label>
              </>
            ) : null}
            {isHearse ? (
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800">
                <input
                  checked={bplDeclared}
                  className="mt-1"
                  onChange={(event) => setBplDeclared(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  I declare eligibility for BPL subsidy. Upload supporting documents at the desk if
                  requested; full fare applies until verified.
                </span>
              </label>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
              onClick={() => setStep('calendar')}
              type="button"
            >
              Back
            </button>
            <button
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={busy || (isAmbulance && !pickupAddress.trim())}
              onClick={() => void proceedToCheckout()}
              type="button"
            >
              {emergency ? 'Confirm emergency booking' : 'Continue to payment'}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'checkout' && quote && slotSelection ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <h4 className="font-bold text-slate-900">Review and pay</h4>
          {slotSummaryLine ? <p className="text-sm text-slate-700">{slotSummaryLine}</p> : null}
          <ul className="space-y-1 text-sm text-slate-700">
            <li>Service: {linkedService.name[language] ?? linkedService.name.en}</li>
            <li>Rent: {formatInrFromPaise(quote.rent_paise)}</li>
            <li>Security deposit: {formatInrFromPaise(quote.deposit_paise)}</li>
            <li className="font-semibold">Total due now: {formatInrFromPaise(quote.total_paise)}</li>
          </ul>
          <p className="text-xs text-slate-500">
            A specific vehicle is assigned automatically after you pay. It will not appear on your
            confirmation PDF.
          </p>
          <button
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void completePaymentAndConfirm()}
            type="button"
          >
            Pay and confirm (stub)
          </button>
        </section>
      ) : null}
    </div>
  );
}
