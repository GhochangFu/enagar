'use client';

import { useMemo, useState } from 'react';

import {
  applicationFeePaid,
  citizenMayInitiatePayment,
  citizenPaymentAwaitingDeptLink,
  effectivePaymentRollup,
} from '../lib/payment-eligibility';
import { authHeaders, formatInrFromPaise, readApiError } from '../lib/workspace-http';

import { BookingChargesPanel } from './booking-charges-panel';

import type { FeeLineDisplay } from '../lib/service-payment';
import type {
  ApplicationDetail,
  PaymentApiResponse,
  PaymentGatewayMethod,
  ReceiptCitizenPayload,
  TokenResponse,
} from '../lib/workspace-types';
import type { FormEvent } from 'react';

/** Inline receipt metadata fetcher for My Payments list rows. */
export function ReceiptPreviewPlaceholder({
  apiBaseUrl,
  payment,
  tenantScopeCode,
  token,
}: {
  apiBaseUrl: string;
  payment: PaymentApiResponse;
  tenantScopeCode?: string | null;
  token: TokenResponse;
}): JSX.Element {
  const [payload, setPayload] = useState<ReceiptCitizenPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadReceipt(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/payments/${encodeURIComponent(payment.id)}/receipt`, {
        headers: authHeaders(token, false, tenantScopeCode),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        setLoading(false);
        return;
      }
      setPayload((await res.json()) as ReceiptCitizenPayload);
    } catch {
      setError('Network error loading receipt metadata.');
    }
    setLoading(false);
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <h5 className="font-bold text-emerald-900">Receipt (metadata)</h5>
      <p className="mt-1 text-xs text-emerald-800">
        PDF is not implemented yet. Preview shows verification_path and qr_contract from Sprint 3.2.
      </p>
      {!payload && (
        <button
          className="mt-3 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={loading}
          onClick={() => void loadReceipt()}
          type="button"
        >
          {loading ? 'Loading…' : 'Load receipt metadata'}
        </button>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {payload && (
        <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-white p-3 font-mono text-[11px] leading-relaxed">
          {JSON.stringify(
            {
              receipt_number: payload.receipt_number,
              verification_path: payload.verification_path,
              qr_contract: payload.qr_contract,
              issued_at: payload.issued_at,
              amount_paise: payload.amount_paise,
            },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  );
}

function paymentReceiptHeading(payment: PaymentApiResponse): string {
  if (payment.fee_code === 'booking_deposit') {
    return 'Receipt — hall rent & security deposit';
  }
  if (payment.fee_code === 'application') {
    return 'Receipt — application fee';
  }
  if (payment.booking_reservation_id) {
    return 'Receipt — hall booking payment';
  }
  return 'Receipt';
}

/** Right-hand application dossier — payments stub, timeline, documents, citizen comment box. */
export function ApplicationDetailPanel({
  apiBaseUrl,
  application,
  comment,
  paymentLine,
  scheduledApprovalFee,
  onCancel,
  onCommentChange,
  onInitiatePayment,
  onStubComplete,
  onSubmitComment,
  payments,
  tenantScopeCode,
  token,
}: {
  apiBaseUrl: string;
  application: ApplicationDetail | null;
  comment: string;
  paymentLine: FeeLineDisplay | null;
  scheduledApprovalFee?: FeeLineDisplay | null;
  onCancel: () => void;
  onCommentChange: (value: string) => void;
  onInitiatePayment: (
    applicationId: string,
    amountPaise: number,
    method: PaymentGatewayMethod,
    feeCode: 'application' | 'approval',
  ) => Promise<PaymentApiResponse | null>;
  onStubComplete: (payment: PaymentApiResponse) => Promise<boolean>;
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => void;
  payments: PaymentApiResponse[];
  tenantScopeCode?: string | null;
  token: TokenResponse | null;
}): JSX.Element {
  const [paymentMethod, setPaymentMethod] = useState<PaymentGatewayMethod>('upi');

  const appPayments = useMemo(() => {
    if (!application) {
      return [];
    }
    if (application.related_payments && application.related_payments.length > 0) {
      return [...application.related_payments].sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
      );
    }
    const reservationId = application.booking_charges?.reservation_id ?? null;
    return payments
      .filter(
        (row) =>
          row.application_id === application.id ||
          (reservationId != null && row.booking_reservation_id === reservationId),
      )
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [application, payments]);

  const settledPayments = useMemo(
    () => appPayments.filter((row) => row.status === 'settled'),
    [appPayments],
  );

  if (!application) {
    return (
      <div className="rounded-3xl border border-dashed border-brand-muted bg-brand-surface/70 p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
          i
        </div>
        <h3 className="mt-4 text-xl font-black text-ink-primary">Application Detail</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-secondary">
          Select a color-coded application card to review its timeline, documents, comments, and
          payment actions.
        </p>
      </div>
    );
  }

  const deskIssuedPaymentId = application.active_payment_id?.trim() || null;
  const pendingStub =
    appPayments.find(
      (row) =>
        row.status === 'requires_action' &&
        (!deskIssuedPaymentId || row.id === deskIssuedPaymentId),
    ) ?? appPayments.find((row) => row.status === 'requires_action');
  const activeFeeCode = paymentLine?.feeCode;
  const canStartNewPayment =
    Boolean(token) &&
    paymentLine != null &&
    citizenMayInitiatePayment(
      application,
      activeFeeCode ? { feeCode: activeFeeCode } : undefined,
    ) &&
    !pendingStub &&
    !(deskIssuedPaymentId && activeFeeCode === 'approval');
  const awaitingDeptLink = citizenPaymentAwaitingDeptLink(application);
  const applicationLinePaid = applicationFeePaid(application);
  const paymentRollup = effectivePaymentRollup(application);

  return (
    <div className="space-y-4 rounded-3xl border border-warm-border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-brand">
            {application.docket_no}
          </p>
          <h3 className="mt-1 text-2xl font-black text-ink-primary">{application.service_name}</h3>
          <span className="mt-2 inline-flex rounded-full bg-brand-muted px-3 py-1 text-xs font-black text-brand">
            {application.status_label}
          </span>
        </div>
        <button
          className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>

      <InfoGrid
        items={[
          ['Stage', application.current_stage],
          ['Payment', paymentRollup],
          [
            'Pending at',
            application.pending_at_label ??
              application.pending_role ??
              (application.pending_designation
                ? application.pending_designation.replace(/_/g, ' ')
                : 'None'),
          ],
          ['Submitted', new Date(application.submitted_at).toLocaleString()],
        ]}
      />

      {application.booking_charges ? (
        <BookingChargesPanel charges={application.booking_charges} variant="citizen" />
      ) : null}

      <section className="rounded-2xl border border-slate-200 p-4">
        <h4 className="font-bold">Fees &amp; payment (stub)</h4>
        {application.fee_settlement && (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {(['application', 'approval'] as const).map((code) => {
              const line = application.fee_settlement?.[code];
              if (!line) {
                return null;
              }
              return (
                <li key={code}>
                  <span className="capitalize">{code.replace('_', ' ')}</span>: {line.status}
                  {line.amount_paise != null ? ` · ${formatInrFromPaise(line.amount_paise)}` : ''}
                </li>
              );
            })}
          </ul>
        )}
        {paymentLine != null ? (
          <p className="mt-2 text-sm text-slate-700">
            {paymentLine.label}: <strong>{formatInrFromPaise(paymentLine.amountPaise)}</strong>
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            No citizen payment line is open for this application right now.
          </p>
        )}
        {paymentRollup === 'not_required' &&
          !awaitingDeptLink &&
          !applicationLinePaid &&
          application.payment_schedule === 'deferred_only' && (
            <p className="mt-2 text-sm text-slate-600">
              No payment is required until the ULB issues a link after approval.
            </p>
          )}
        {awaitingDeptLink && scheduledApprovalFee && (
          <p className="mt-2 text-sm text-slate-600">
            <strong>{scheduledApprovalFee.label}</strong> (
            {formatInrFromPaise(scheduledApprovalFee.amountPaise)}) is payable after approval, when
            the ULB issues a payment link at the <strong>Payment pending</strong> stage.
          </p>
        )}
        {applicationLinePaid &&
          application.payment_schedule === 'upfront_and_deferred' &&
          application.current_stage !== 'payment-pending' && (
            <p className="mt-2 text-sm text-emerald-800">Application fee is paid.</p>
          )}
        {paymentRollup === 'paid' && (
          <p className="mt-2 text-sm text-emerald-800">Payment is recorded as paid.</p>
        )}
        {appPayments.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {appPayments.slice(0, 6).map((row) => (
              <li key={row.id}>
                {row.status.replace('_', ' ')} · {formatInrFromPaise(row.amount_paise)} ·{' '}
                <span className="font-mono">{row.gateway_order_id}</span>
              </li>
            ))}
          </ul>
        )}
        {paymentRollup === 'pending' && deskIssuedPaymentId && !pendingStub && token && (
          <p className="mt-2 text-sm text-amber-800">
            Payment was issued by the ULB. Reload this application or refresh the page if the
            capture button does not appear.
          </p>
        )}
        {application.payment_redirect_url && paymentRollup === 'pending' && (
          <p className="mt-2 text-xs text-slate-500 break-all">
            Partner link: {application.payment_redirect_url}
          </p>
        )}
        {pendingStub && token && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
            <p>
              {deskIssuedPaymentId ? 'Your municipality has issued a payment request. ' : ''}
              Stub partner reserved order <strong>{pendingStub.gateway_order_id}</strong>. Simulate
              capture to settle and issue receipt metadata.
            </p>
            <button
              className="mt-2 w-full rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void onStubComplete(pendingStub)}
              type="button"
            >
              Simulate PSP capture
            </button>
          </div>
        )}
        {canStartNewPayment && paymentLine != null && (
          <div className="mt-3 space-y-2">
            {paymentRollup === 'failed' && (
              <p className="text-sm text-amber-800">
                Last attempt failed. Start a fresh payment after reading the status banner;
                idempotency keys rotate each tap.
              </p>
            )}
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Method
              <select
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setPaymentMethod(event.target.value as PaymentGatewayMethod)}
                value={paymentMethod}
              >
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="netbanking">Net banking</option>
                <option value="wallet">Wallet</option>
              </select>
            </label>
            <button
              className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() =>
                void onInitiatePayment(
                  application.id,
                  paymentLine.amountPaise,
                  paymentMethod,
                  paymentLine.feeCode,
                )
              }
              type="button"
            >
              Initiate stub payment
            </button>
          </div>
        )}
        {!token && (paymentRollup === 'pending' || paymentRollup === 'failed') && (
          <p className="mt-2 text-sm text-red-700">Sign in is required to initiate payment.</p>
        )}
        {settledPayments.length > 0 && token && !pendingStub ? (
          <div className="mt-4 space-y-4">
            {settledPayments.map((row) => (
              <div key={row.id}>
                <p className="text-xs font-semibold uppercase text-slate-600">
                  {paymentReceiptHeading(row)}
                </p>
                <ReceiptPreviewPlaceholder
                  apiBaseUrl={apiBaseUrl}
                  payment={row}
                  tenantScopeCode={tenantScopeCode}
                  token={token}
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {application.current_stage === 'citizen-feedback' && token && (
        <CitizenFeedbackSection
          apiBaseUrl={apiBaseUrl}
          applicationId={application.id}
          tenantScopeCode={tenantScopeCode}
          token={token}
        />
      )}

      <section>
        <h4 className="font-bold">Timeline</h4>
        <div className="mt-2 space-y-2">
          {application.timeline.map((item) => (
            <div className="rounded-2xl bg-slate-50 p-3 text-sm" key={item.id}>
              <strong>{item.verb}</strong> to {item.to_stage} by {item.actor_role}
              {item.comment && <p className="text-slate-600">{item.comment}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="font-bold">Documents</h4>
        <div className="mt-2 space-y-2">
          {application.documents.map((document) => (
            <div className="rounded-2xl bg-slate-50 p-3 text-sm" key={document.id}>
              <strong>{document.document_code}</strong> — {document.scan_status}
              <p className="break-all text-slate-600">
                {document.original_name ?? document.object_key}
              </p>
              {token && document.scan_status === 'clean' && (
                <button
                  className="mt-2 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={() =>
                    void (async () => {
                      const res = await fetch(
                        `${apiBaseUrl}/documents/${encodeURIComponent(document.id)}/download`,
                        { headers: authHeaders(token, false, tenantScopeCode) },
                      );
                      if (!res.ok) {
                        return;
                      }
                      const payload = (await res.json()) as { download_url: string };
                      window.open(payload.download_url, '_blank', 'noopener,noreferrer');
                    })()
                  }
                  type="button"
                >
                  Download
                </button>
              )}
            </div>
          ))}
          {application.documents.length === 0 && (
            <p className="text-sm text-slate-600">No documents.</p>
          )}
        </div>
      </section>

      <form className="space-y-3" onSubmit={onSubmitComment}>
        <label className="block text-sm font-medium text-slate-700">
          Add Comment
          <textarea
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            onChange={(event) => onCommentChange(event.target.value)}
            rows={3}
            value={comment}
          />
        </label>
        <button className="rounded-2xl bg-brand px-4 py-2 font-semibold text-white" type="submit">
          Save Comment
        </button>
      </form>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }): JSX.Element {
  return (
    <dl className="grid gap-2 md:grid-cols-2">
      {items.map(([label, value]) => (
        <Info key={label} label={label} value={value} />
      ))}
    </dl>
  );
}

function CitizenFeedbackSection({
  apiBaseUrl,
  applicationId,
  tenantScopeCode,
  token,
}: {
  apiBaseUrl: string;
  applicationId: string;
  tenantScopeCode?: string | null;
  token: TokenResponse;
}): JSX.Element {
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitFeedback(): Promise<void> {
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch(
        `${apiBaseUrl}/applications/${encodeURIComponent(applicationId)}/feedback`,
        {
          method: 'POST',
          headers: authHeaders(token, true, tenantScopeCode),
          body: JSON.stringify({
            rating,
            comment: feedbackComment.trim() || undefined,
          }),
        },
      );
      if (!res.ok) {
        setStatus(await readApiError(res));
        setSubmitting(false);
        return;
      }
      setStatus('Thank you — your feedback was recorded.');
      window.location.reload();
    } catch {
      setStatus('Network error submitting feedback.');
    }
    setSubmitting(false);
  }

  return (
    <section className="rounded-2xl border border-brand/30 bg-brand-muted/40 p-4">
      <h4 className="font-bold text-brand">Rate this service</h4>
      <p className="mt-1 text-sm text-slate-700">
        Work is complete. Please share feedback before this application closes.
      </p>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Rating (1–5)
        <input
          className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
          max={5}
          min={1}
          onChange={(event) => setRating(Number(event.target.value))}
          type="number"
          value={rating}
        />
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Comment (optional)
        <textarea
          className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2"
          onChange={(event) => setFeedbackComment(event.target.value)}
          rows={3}
          value={feedbackComment}
        />
      </label>
      <button
        className="mt-3 w-full rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        disabled={submitting}
        onClick={() => void submitFeedback()}
        type="button"
      >
        {submitting ? 'Submitting…' : 'Submit feedback'}
      </button>
      {status ? (
        <p className="mt-2 text-sm text-slate-700" role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}
