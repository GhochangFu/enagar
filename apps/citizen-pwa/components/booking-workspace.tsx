'use client';

import {
  validateSubmission,
  type EnagarFormSchema,
  type FormSubmission,
  FormRenderPlan,
  FormSubmissionValue,
} from '@enagar/forms';
import { DynamicFormFields } from '@enagar/forms/web';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { resolveServiceProcessingFeePaise } from '../lib/booking-service-fees';
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
  assetDisplayName,
  completeBookingStubPayment,
  confirmBookingHold,
  createApplicationDraft,
  createBookingHold,
  fetchAssetSlots,
  fetchPublicBookableAssets,
  initiateApplicationPayment,
  initiateBookingHoldPayment,
  linkBookingHoldApplication,
  quoteBooking,
  submitApplicationDraft,
  type BookingQuote,
  type BookingReservation,
  type PublicBookableAsset,
} from '../lib/bookings-api';
import { formatInrFromPaise } from '../lib/workspace-http';

import { BookingConfirmationPanel } from './booking-confirmation-panel';
import { BookingHourGrid } from './booking-hour-grid';

import type { PwaLocaleCode, ServiceSummary, TokenResponse } from '../lib/workspace-types';
import type { JSX } from 'react';

type BookingStep = 'asset' | 'calendar' | 'details' | 'quote' | 'checkout' | 'pending' | 'done';

type BookingWorkspaceProps = {
  apiBaseUrl: string;
  token: TokenResponse;
  tenantCode: string;
  language: PwaLocaleCode;
  linkedService?: ServiceSummary | null;
  applicationForm?: {
    schema: EnagarFormSchema;
    renderPlan: FormRenderPlan;
    values: FormSubmission;
    onChange: (fieldId: string, value: FormSubmissionValue | undefined) => void;
    onFileBlob: (fieldId: string, file: File | null) => void;
  };
  onStatus: (message: string) => void;
  onBack: () => void;
  variant?: 'default' | 'led';
  prepareDraftDocuments?: (
    draftId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
};

export function BookingWorkspace({
  apiBaseUrl,
  token,
  tenantCode,
  language,
  linkedService,
  applicationForm,
  onStatus,
  onBack,
  variant = 'default',
  prepareDraftDocuments,
}: BookingWorkspaceProps): JSX.Element {
  const linkedServiceCode = linkedService?.code;
  const isLedBooking = variant === 'led' || linkedServiceCode === 'ad-led';
  const hasApplicationFlow = Boolean(linkedServiceCode && (applicationForm || isLedBooking));
  const defersSlotPayment =
    isLedBooking || linkedService?.payment_schedule === 'deferred_only';
  const needsClerkApproval = Boolean(applicationForm && linkedServiceCode) && !defersSlotPayment;
  const [step, setStep] = useState<BookingStep>('asset');
  const [assets, setAssets] = useState<PublicBookableAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<PublicBookableAsset | null>(null);
  const [selectedDay, setSelectedDay] = useState(() =>
    nextIstWeekdayYmd(addDaysYmd(ymdInIst(new Date()), 1)),
  );
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof fetchAssetSlots>>>([]);
  const [slotSelection, setSlotSelection] = useState<SlotSelection>(null);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [depositId, setDepositId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<BookingReservation | null>(null);
  const [applicationDocket, setApplicationDocket] = useState<string | null>(null);
  const [pendingApplicationId, setPendingApplicationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const rules = useMemo(
    () => parseBookingDurationRules(selectedAsset?.rules),
    [selectedAsset?.rules],
  );
  const localeTag = language === 'bn' ? 'bn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
  const processingFeePaise = useMemo(
    () => resolveServiceProcessingFeePaise(linkedService),
    [linkedService],
  );
  const requiresApplicationFeeNow =
    processingFeePaise > 0 &&
    (linkedService?.payment_schedule === 'upfront_only' ||
      linkedService?.payment_schedule === 'upfront_and_deferred');
  const rentDuePaise = quote?.rent_paise ?? 0;
  const depositDuePaise = quote?.deposit_paise ?? selectedAsset?.security_deposit_paise ?? 0;
  const totalDueNowPaise = processingFeePaise + rentDuePaise + depositDuePaise;

  const loadAssets = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchPublicBookableAssets(apiBaseUrl, tenantCode, linkedServiceCode);
      setAssets(rows);
      if (rows.length === 0) {
        setError(
          isLedBooking
            ? 'No LED boards are linked to this service for your municipality. Ask the ULB to configure boards under Operations → Advertising.'
            : linkedServiceCode
              ? 'No community halls are linked to this service for your municipality. Ask the ULB to configure halls under Operations → Bookings.'
              : 'No bookable assets are available for your municipality.',
        );
        return;
      }
      if (rows.length === 1) {
        setSelectedAsset(rows[0]!);
        setStep('calendar');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load bookable assets');
    }
  }, [apiBaseUrl, tenantCode, linkedServiceCode, isLedBooking]);

  const loadSlots = useCallback(async () => {
    if (!selectedAsset) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const from = istDayStartUtc(selectedDay).toISOString();
      const to = istDayEndUtc(selectedDay).toISOString();
      const rows = await fetchAssetSlots(
        apiBaseUrl,
        tenantCode,
        selectedAsset.code,
        from,
        to,
        linkedServiceCode,
      );
      setSlots(rows);
      setSlotSelection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load slots');
    } finally {
      setBusy(false);
    }
  }, [apiBaseUrl, tenantCode, selectedAsset, selectedDay, linkedServiceCode]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (step === 'calendar' && selectedAsset) {
      void loadSlots();
    }
  }, [step, selectedAsset, selectedDay, loadSlots]);

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

  async function proceedToQuoteReview(): Promise<void> {
    if (!selectedAsset || !slotSelection) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const q = await quoteBooking(apiBaseUrl, token, tenantCode, {
        tenant_code: tenantCode,
        service_code: linkedServiceCode,
        asset_code: selectedAsset.code,
        starts_at: slotSelection.startsAt,
        ends_at: slotSelection.endsAt,
      });
      setQuote(q);
      const hold = await createBookingHold(apiBaseUrl, token, tenantCode, {
        tenant_code: tenantCode,
        service_code: linkedServiceCode,
        asset_code: selectedAsset.code,
        starts_at: slotSelection.startsAt,
        ends_at: slotSelection.endsAt,
      });
      setHoldId(hold.id);
      setDepositId(null);
      setStep('quote');
      onStatus('Slot quoted — review and submit your application.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare quotation');
    } finally {
      setBusy(false);
    }
  }

  async function proceedToCheckout(): Promise<void> {
    if (!selectedAsset || !slotSelection) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const q = await quoteBooking(apiBaseUrl, token, tenantCode, {
        tenant_code: tenantCode,
        service_code: linkedServiceCode,
        asset_code: selectedAsset.code,
        starts_at: slotSelection.startsAt,
        ends_at: slotSelection.endsAt,
      });
      setQuote(q);
      const hold = await createBookingHold(apiBaseUrl, token, tenantCode, {
        tenant_code: tenantCode,
        service_code: linkedServiceCode,
        asset_code: selectedAsset.code,
        starts_at: slotSelection.startsAt,
        ends_at: slotSelection.endsAt,
      });
      setHoldId(hold.id);
      setDepositId(null);
      setStep('checkout');
      onStatus('Hold placed — complete payment to confirm.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place hold');
    } finally {
      setBusy(false);
    }
  }

  function continueFromCalendar(): void {
    if (isLedBooking && !applicationForm) {
      setError(
        'The LED booking application form is not available. Ask your municipality to publish the ad-led service form, then refresh.',
      );
      return;
    }
    if (hasApplicationFlow) {
      setStep('details');
      return;
    }
    void proceedToCheckout();
  }

  function continueFromDetails(): void {
    if (!applicationForm) {
      return;
    }
    const validation = validateSubmission(applicationForm.schema, applicationForm.values);
    if (!validation.ok) {
      setError(validation.issues.map((issue) => issue.message).join(' · ') || 'Invalid form');
      return;
    }
    setError(null);
    if (defersSlotPayment) {
      void proceedToQuoteReview();
      return;
    }
    void proceedToCheckout();
  }

  function buildLedBookingSnapshotJson(): string | undefined {
    if (!selectedAsset || !slotSelection || !quote) {
      return undefined;
    }
    return JSON.stringify({
      asset_code: selectedAsset.code,
      starts_at: slotSelection.startsAt,
      ends_at: slotSelection.endsAt,
      rent_paise: quote.rent_paise,
      deposit_paise: depositDuePaise,
      total_paise: quote.rent_paise + depositDuePaise,
      quoted_at: new Date().toISOString(),
    });
  }

  async function submitDeferredApplication(): Promise<void> {
    if (!holdId || !quote || !slotSelection || !selectedAsset || !applicationForm) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      onStatus('Saving application draft…');
      const snapshotJson = buildLedBookingSnapshotJson();
      const draft = await createApplicationDraft(apiBaseUrl, token, tenantCode, {
        service_code: linkedServiceCode!,
        form_data: {
          ...applicationForm.values,
          bookable_asset_code: selectedAsset.code,
          booking_starts_at: slotSelection.startsAt,
          booking_ends_at: slotSelection.endsAt,
          booking_rent_paise: quote.rent_paise,
          booking_deposit_paise: depositDuePaise,
          booking_application_fee_paise: processingFeePaise,
          ...(snapshotJson ? { led_booking_snapshot: snapshotJson } : {}),
        },
      });
      const applicationId = draft.id;
      const docketNo = draft.docket_no;
      setApplicationDocket(draft.docket_no);

      if (prepareDraftDocuments) {
        onStatus('Uploading application documents…');
        const documentsReady = await prepareDraftDocuments(applicationId);
        if (!documentsReady.ok) {
          setError(documentsReady.error);
          return;
        }
      }

      if (requiresApplicationFeeNow) {
        onStatus('Paying application fee (stub)…');
        const appPay = await initiateApplicationPayment(
          apiBaseUrl,
          token,
          tenantCode,
          applicationId,
          processingFeePaise,
          `ad-led-app-${applicationId}`,
        );
        await completeBookingStubPayment(
          apiBaseUrl,
          token,
          tenantCode,
          appPay.id,
          appPay.gateway_order_id,
        );
      }

      onStatus('Linking slot to your application…');
      await linkBookingHoldApplication(apiBaseUrl, token, tenantCode, holdId, applicationId);
      onStatus('Submitting application for ULB review…');
      const submitted = await submitApplicationDraft(
        apiBaseUrl,
        token,
        tenantCode,
        applicationId,
      );
      setPendingApplicationId(applicationId);
      setApplicationDocket(submitted.docket_no ?? docketNo ?? null);
      setStep('pending');
      onStatus(
        `Quotation submitted · Application ${submitted.docket_no ?? docketNo ?? ''} is pending verification. You will receive a payment link after approval.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application submission failed');
    } finally {
      setBusy(false);
    }
  }

  async function payAndConfirm(): Promise<void> {
    if (!holdId || !quote || !slotSelection || !selectedAsset) {
      return;
    }
    if (processingFeePaise > 0 && !linkedServiceCode) {
      setError('Application fee is configured but no linked service was provided.');
      return;
    }
    if (depositDuePaise === 0 && processingFeePaise === 0) {
      setError(
        'Hall fees are not configured. Ask the ULB to set asset rates in Operations → Bookings, or run: node scripts/refresh-kmc-booking-availability.mjs',
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      let applicationId: string | undefined;
      let docketNo: string | undefined;
      if (applicationForm && linkedServiceCode) {
        onStatus('Saving application draft…');
        const draft = await createApplicationDraft(apiBaseUrl, token, tenantCode, {
          service_code: linkedServiceCode,
          form_data: {
            ...applicationForm.values,
            bookable_asset_code: selectedAsset.code,
            booking_starts_at: slotSelection.startsAt,
            booking_ends_at: slotSelection.endsAt,
            booking_rent_paise: quote?.rent_paise ?? 0,
            booking_deposit_paise: depositDuePaise,
            booking_application_fee_paise: processingFeePaise,
            booking_upfront_total_paise: totalDueNowPaise,
          },
        });
        applicationId = draft.id;
        docketNo = draft.docket_no;
        setApplicationDocket(draft.docket_no);

        if (prepareDraftDocuments) {
          onStatus('Uploading application documents…');
          const documentsReady = await prepareDraftDocuments(applicationId);
          if (!documentsReady.ok) {
            setError(documentsReady.error);
            return;
          }
        }

        if (processingFeePaise > 0) {
          onStatus('Paying application fee (stub)…');
          const appPay = await initiateApplicationPayment(
            apiBaseUrl,
            token,
            tenantCode,
            draft.id,
            processingFeePaise,
            `hall-app-${draft.id}`,
          );
          await completeBookingStubPayment(
            apiBaseUrl,
            token,
            tenantCode,
            appPay.id,
            appPay.gateway_order_id,
          );
        }
      }

      let activeDepositId = depositId;
      if (depositDuePaise > 0) {
        onStatus('Paying hall security deposit (stub)…');
        const checkout = await initiateBookingHoldPayment(
          apiBaseUrl,
          token,
          tenantCode,
          holdId,
          'upi',
          `booking-${holdId}`,
          rentDuePaise > 0,
        );
        activeDepositId = checkout.deposit_id;
        setDepositId(activeDepositId);
        await completeBookingStubPayment(
          apiBaseUrl,
          token,
          tenantCode,
          checkout.payment.id,
          checkout.payment.gateway_order_id,
        );
      }

      if (needsClerkApproval && applicationId) {
        onStatus('Linking slot to your application…');
        await linkBookingHoldApplication(apiBaseUrl, token, tenantCode, holdId, applicationId);
        onStatus('Submitting application for ULB review…');
        const submitted = await submitApplicationDraft(
          apiBaseUrl,
          token,
          tenantCode,
          applicationId,
        );
        setPendingApplicationId(applicationId);
        setApplicationDocket(submitted.docket_no ?? docketNo ?? null);
        setStep('pending');
        onStatus(
          `Slot held · Application ${submitted.docket_no ?? docketNo ?? ''} submitted for review. You will get a booking number after the municipality confirms.`,
        );
        return;
      }

      onStatus('Confirming booking…');
      const reservation = await confirmBookingHold(apiBaseUrl, token, tenantCode, holdId, {
        depositId: activeDepositId ?? undefined,
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

  const slotSummaryLine =
    slotSelection && selectedAsset
      ? `${assetDisplayName(selectedAsset.name, language)} · ${formatIstDate(slotSelection.startsAt, localeTag)} · ${formatIstTimeRange(slotSelection.startsAt, slotSelection.endsAt, localeTag)}`
      : null;

  if (isLedBooking && !applicationForm) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <p className="font-semibold">LED application form not loaded</p>
          <p className="mt-2">
            Applicant and campaign details are required before booking. The municipality must publish
            the <strong>ad-led</strong> service form (run database seed or publish in Service
            designer), then reload this page.
          </p>
        </div>
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

  if (step === 'pending') {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <h4 className="text-lg font-bold text-amber-950">
            {defersSlotPayment ? 'Quotation submitted — pending verification' : 'Slot held — pending ULB approval'}
          </h4>
          <p className="mt-2 text-sm text-amber-900">
            {defersSlotPayment
              ? 'Your LED slot is held while the municipality reviews your application. No payment is due now. After approval, you will receive a payment link for the quoted rent and security deposit. Your booking number and confirmation PDF are issued after payment.'
              : 'Your fees are recorded and the hall slot is reserved on hold. A municipality officer will review your application and confirm or reject the booking. You will receive a booking number and confirmation PDF only after approval.'}
          </p>
          {applicationDocket ? (
            <p className="mt-3 text-sm text-amber-900">
              Application docket:{' '}
              <span className="font-mono font-semibold">{applicationDocket}</span> — track under My
              Applications.
            </p>
          ) : null}
          {holdId ? (
            <p className="mt-1 text-xs text-amber-800">
              Hold reference: <span className="font-mono">{holdId}</span>
            </p>
          ) : null}
          {pendingApplicationId ? (
            <p className="mt-1 text-xs text-amber-800">
              Application id: <span className="font-mono">{pendingApplicationId}</span>
            </p>
          ) : null}
        </div>
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
        {applicationDocket ? (
          <p className="text-sm text-slate-600">
            Linked application docket:{' '}
            <span className="font-mono font-semibold">{applicationDocket}</span> — track it under My
            Applications.
          </p>
        ) : null}
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
          <p className="text-sm font-semibold uppercase text-brand">
            {isLedBooking ? 'Advertising' : 'Bookings'}
          </p>
          <h3 className="text-2xl font-bold text-slate-900">
            {isLedBooking
              ? 'LED board — hourly slot booking'
              : linkedServiceCode === 'community-hall'
                ? 'Community hall — hourly booking'
                : 'Reserve a municipal facility'}
          </h3>
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

      {step === 'asset' ? (
        <section className="space-y-3">
          <p className="text-sm text-slate-600">
            {isLedBooking
              ? `Choose an LED display board for ${tenantCode}. Only boards linked to this service are shown.`
              : linkedServiceCode === 'community-hall'
                ? `Choose a community hall for ${tenantCode}. Only halls linked to this service are shown.`
                : `Choose a bookable asset for ${tenantCode}.`}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {assets.map((asset) => (
              <button
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand"
                key={asset.code}
                onClick={() => {
                  setSelectedAsset(asset);
                  setStep('calendar');
                }}
                type="button"
              >
                <p className="font-semibold text-slate-900">
                  {assetDisplayName(asset.name, language)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{asset.code}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {formatInrFromPaise(asset.base_rate_paise)} / hour · deposit{' '}
                  {formatInrFromPaise(asset.security_deposit_paise)}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === 'calendar' && selectedAsset ? (
        <section className="space-y-4">
          <p className="font-semibold text-slate-800">
            {assetDisplayName(selectedAsset.name, language)}
          </p>
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
            <p className="text-sm text-slate-600">Loading hour grid…</p>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">No bookable hours on this day.</p>
              <p className="mt-1">
                This hall is open on <strong>weekdays 09:00–21:00 IST</strong> only. If every
                weekday is empty, refresh dev data: run{' '}
                <code className="rounded bg-white/80 px-1">pnpm prisma db seed</code> from the repo
                root (rolls availability forward).
              </p>
            </div>
          ) : (
            <BookingHourGrid
              locale={language}
              onSelectSlot={(slot) => {
                const next = toggleSlotSelection(slots, slotSelection, slot, rules);
                setSlotSelection(next);
                if (next) {
                  setAnnouncement(
                    `Selected ${formatIstTimeRange(next.startsAt, next.endsAt, localeTag)}`,
                  );
                } else {
                  setAnnouncement('Selection cleared');
                }
              }}
              rules={rules}
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
            onClick={continueFromCalendar}
            type="button"
          >
            {hasApplicationFlow
              ? isLedBooking
                ? 'Continue to applicant details'
                : 'Continue to event details'
              : 'Continue to quote'}
          </button>
        </section>
      ) : null}

      {step === 'details' && applicationForm ? (
        <section className="space-y-4">
          {slotSummaryLine ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Selected slot</p>
              <p className="mt-1">{slotSummaryLine}</p>
            </div>
          ) : null}
          <div>
            <h4 className="text-lg font-bold text-slate-900">
              {isLedBooking ? 'Campaign & applicant details' : 'Event & applicant details'}
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              Required for your {linkedService?.name[language] ?? (isLedBooking ? 'LED board' : 'community hall')}{' '}
              application. Your selected slot is saved with this draft.
            </p>
          </div>
          <DynamicFormFields
            nodes={applicationForm.renderPlan.nodes}
            onChange={applicationForm.onChange}
            onFileBlob={applicationForm.onFileBlob}
            values={applicationForm.values}
          />
          <button
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy}
            onClick={continueFromDetails}
            type="button"
          >
            {defersSlotPayment ? 'Continue to quotation' : 'Continue to payment'}
          </button>
        </section>
      ) : null}

      {step === 'quote' && quote && slotSelection ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <h4 className="font-bold text-slate-900">Review quotation</h4>
          {slotSummaryLine ? (
            <p className="text-sm text-slate-700">{slotSummaryLine}</p>
          ) : null}
          <ul className="space-y-1 text-sm text-slate-700">
            <li>
              Slot: {formatIstDate(slotSelection.startsAt, localeTag)} ·{' '}
              {formatIstTimeRange(slotSelection.startsAt, slotSelection.endsAt, localeTag)}
            </li>
            <li>LED rent (hourly): {formatInrFromPaise(quote.rent_paise)}</li>
            <li>Security deposit (refundable): {formatInrFromPaise(depositDuePaise)}</li>
            {requiresApplicationFeeNow ? (
              <li>Application fee (pay now): {formatInrFromPaise(processingFeePaise)}</li>
            ) : null}
            <li className="font-semibold text-slate-900">
              {requiresApplicationFeeNow
                ? `Pay now: ${formatInrFromPaise(processingFeePaise)} · After approval: ${formatInrFromPaise(quote.rent_paise + depositDuePaise)}`
                : `Total after approval: ${formatInrFromPaise(quote.rent_paise + depositDuePaise)}`}
            </li>
          </ul>
          <p className="text-xs text-slate-500">
            {requiresApplicationFeeNow
              ? 'The application fee is due when you submit. Rent and security deposit are collected only after municipality verification, via a desk payment link.'
              : 'No payment is required now. Submit your application for municipality verification. After approval, you will receive a payment link from the desk for the quoted amount.'}
          </p>
          <button
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void submitDeferredApplication()}
            type="button"
          >
            {busy
              ? 'Submitting…'
              : requiresApplicationFeeNow
                ? 'Pay application fee (stub) & submit'
                : 'Submit application for verification'}
          </button>
        </section>
      ) : null}

      {step === 'checkout' && quote && slotSelection ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <h4 className="font-bold text-slate-900">Review & pay</h4>
          <ul className="space-y-1 text-sm text-slate-700">
            <li>
              Slot: {formatIstDate(slotSelection.startsAt, localeTag)} ·{' '}
              {formatIstTimeRange(slotSelection.startsAt, slotSelection.endsAt, localeTag)}
            </li>
            <li>Hall rent (hourly): {formatInrFromPaise(quote.rent_paise)}</li>
            <li>Security deposit (refundable): {formatInrFromPaise(depositDuePaise)}</li>
            {processingFeePaise > 0 ? (
              <li>Application / processing fee: {formatInrFromPaise(processingFeePaise)}</li>
            ) : null}
            <li className="font-semibold text-slate-900">
              Pay upfront now (stub sandbox): {formatInrFromPaise(totalDueNowPaise)}
            </li>
          </ul>
          <p className="text-xs text-slate-500">
            {needsClerkApproval
              ? 'Application fee, hall rent for your selected hours, and the refundable security deposit are all due now. Your booking number is issued only after the municipality approves your application.'
              : 'Application fee, hall rent, and security deposit are due now before the booking number is issued.'}
          </p>
          <button
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy || totalDueNowPaise <= 0}
            onClick={() => void payAndConfirm()}
            type="button"
          >
            {busy
              ? 'Processing…'
              : needsClerkApproval
                ? 'Pay fees (stub) & submit for approval'
                : 'Pay fees (stub) & confirm booking'}
          </button>
        </section>
      ) : null}
    </div>
  );
}
