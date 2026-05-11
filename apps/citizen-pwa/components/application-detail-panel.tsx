'use client';

import { useMemo, useState } from 'react';

import { authHeaders, formatInrFromPaise, readApiError } from '../lib/workspace-http';

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

/** Right-hand application dossier — payments stub, timeline, documents, citizen comment box. */
export function ApplicationDetailPanel({
  apiBaseUrl,
  application,
  comment,
  feePaise,
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
  feePaise: number | null;
  onCancel: () => void;
  onCommentChange: (value: string) => void;
  onInitiatePayment: (
    applicationId: string,
    amountPaise: number,
    method: PaymentGatewayMethod,
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
    return payments
      .filter((row) => row.application_id === application.id)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [application, payments]);

  if (!application) {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="text-xl font-bold">Application Detail</h3>
        <p className="mt-3 text-slate-600">Select an application to see timeline and documents.</p>
      </div>
    );
  }

  const pendingStub = appPayments.find((row) => row.status === 'requires_action');
  const latestSettled = appPayments.find((row) => row.status === 'settled');
  const canStartNewPayment =
    Boolean(token) &&
    feePaise != null &&
    (application.payment_status === 'pending' || application.payment_status === 'failed') &&
    !pendingStub;

  return (
    <div className="space-y-4 rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-brand">{application.docket_no}</p>
          <h3 className="text-2xl font-bold">{application.service_name}</h3>
          <p className="text-slate-600">{application.status_label}</p>
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
          ['Payment', application.payment_status],
          ['Pending Role', application.pending_role ?? 'None'],
          ['Submitted', new Date(application.submitted_at).toLocaleString()],
        ]}
      />

      <section className="rounded-2xl border border-slate-200 p-4">
        <h4 className="font-bold">Fees &amp; payment (stub)</h4>
        {feePaise != null ? (
          <p className="mt-2 text-sm text-slate-700">
            Fixed fee: <strong>{formatInrFromPaise(feePaise)}</strong>
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            This service has no fixed-fee line item in the catalogue (or fee is not fixed).
          </p>
        )}
        {application.payment_status === 'not_required' && (
          <p className="mt-2 text-sm text-slate-600">
            No payment is required for this application.
          </p>
        )}
        {application.payment_status === 'paid' && (
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
        {pendingStub && token && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
            <p>
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
        {canStartNewPayment && feePaise != null && (
          <div className="mt-3 space-y-2">
            {application.payment_status === 'failed' && (
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
              onClick={() => void onInitiatePayment(application.id, feePaise, paymentMethod)}
              type="button"
            >
              Initiate stub payment
            </button>
          </div>
        )}
        {!token &&
          (application.payment_status === 'pending' || application.payment_status === 'failed') && (
            <p className="mt-2 text-sm text-red-700">Sign in is required to initiate payment.</p>
          )}
        {latestSettled && token && !pendingStub && (
          <ReceiptPreviewPlaceholder
            apiBaseUrl={apiBaseUrl}
            payment={latestSettled}
            tenantScopeCode={tenantScopeCode}
            token={token}
          />
        )}
      </section>

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
              <strong>{document.document_code}</strong> - {document.scan_status}
              <p className="break-all text-slate-600">{document.object_key}</p>
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
