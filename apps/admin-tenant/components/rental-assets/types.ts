/**
 * Shared types for the rental-assets + rental-invoices operator pages.
 *
 * These mirror the shapes returned by `GET /rental-assets` and
 * `GET /lease-invoices` (the latter now includes the full payment history +
 * receipts on each row so the ledger can show Paid / Paid date / Method /
 * Receipt # without a second roundtrip). Keep field names in sync with the
 * Prisma includes in `apps/api/src/modules/lease-invoices/lease-invoices.service.ts`.
 */

export type RentalAssetStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RESERVED';

export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';

export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'cheque'
  | 'upi'
  | 'card'
  | 'netbanking'
  | string;

export type LeaseInvoice = {
  id: string;
  invoiceNo: string;
  amountPaise: number;
  lateFeePaise: number;
  status: InvoiceStatus;
  dueDate: string;
};

export type LeasePayment = {
  id: string;
  amountPaise: number;
  method: PaymentMethod;
  status: string;
  gateway: string;
  settledAt: string | null;
  createdAt: string;
};

/**
 * Did this payment actually clear? The canonical signal is `settledAt`
 * (a real timestamp) — the `status` string is a free-form label that
 * varies by gateway path:
 *   - offline (cash / bank transfer / cheque): writes `status: 'succeeded'`
 *   - online (stub gateway via POST /payments/stub/complete): writes
 *     `status: 'settled'`
 *   - in-flight (gateway redirect pending): `status: 'requires_action'`,
 *     `settledAt: null`
 *
 * Anything with a non-null `settledAt` has been paid, regardless of what
 * the `status` string says. Use this everywhere we need to decide
 * "paid / not paid" so the grid and the detail drawer stay in lockstep.
 */
export function isPaymentSettled(p: LeasePayment): boolean {
  return p.settledAt != null;
}

export type LeaseReceipt = {
  id: string;
  receiptNumber: string;
  amountPaise: number;
  issuedAt: string;
  verificationToken: string;
};

export type LeaseAgreement = {
  id: string;
  lessorName: string;
  lessorPhone?: string | null;
  tradeLicenseNo: string;
  startDate: string;
  endDate: string;
  securityDepositPaise: number;
  status: string;
  invoices?: LeaseInvoice[];
};

export type RentalAsset = {
  id: string;
  assetType: string;
  name: Record<string, string>;
  location: Record<string, unknown>;
  status: RentalAssetStatus;
  baseLeaseRatePaise: number;
  ratePeriod: string;
  createdAt?: string;
  agreements?: LeaseAgreement[];
};

export type InvoiceRow = {
  id: string;
  invoiceNo: string;
  amountPaise: number;
  lateFeePaise: number;
  status: InvoiceStatus;
  dueDate: string;
  createdAt?: string;
  agreement: {
    id: string;
    lessorName: string;
    lessorPhone?: string | null;
    asset: { id: string; name: Record<string, string> };
  };
  payments: LeasePayment[];
  receipts: LeaseReceipt[];
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  HOARDING: 'Hoarding',
  MARKET_STALL: 'Market Stall',
  LAND: 'Land',
  COMMUNITY_HALL_LONG_TERM: 'Community Hall',
  OTHER: 'Other',
};

export const STATUS_TONE: Record<RentalAssetStatus, 'success' | 'neutral' | 'warning' | 'info'> = {
  AVAILABLE: 'success',
  RENTED: 'neutral',
  MAINTENANCE: 'warning',
  RESERVED: 'info',
};

export const STATUS_LABELS: Record<RentalAssetStatus, string> = {
  AVAILABLE: 'Available',
  RENTED: 'Rented',
  MAINTENANCE: 'Maintenance',
  RESERVED: 'Reserved',
};

export const INVOICE_STATUS_TONE: Record<
  InvoiceStatus,
  'success' | 'warning' | 'danger' | 'neutral'
> = {
  PAID: 'success',
  PENDING: 'warning',
  OVERDUE: 'danger',
  WAIVED: 'neutral',
};

export const RATE_PERIOD_LABELS: Record<string, string> = {
  MONTHLY: 'month',
  QUARTERLY: 'quarter',
  YEARLY: 'year',
};

/**
 * Pretty-print a payment method string for human display. Falls back to a
 * Title-Case version of the raw value so an unknown method still renders
 * sensibly rather than `bank_transfer` leaking into the UI.
 */
export function paymentMethodLabel(method: PaymentMethod | undefined | null): string {
  if (!method) return '—';
  const known: Record<string, string> = {
    cash: 'Cash',
    bank_transfer: 'Bank transfer',
    cheque: 'Cheque / DD',
    upi: 'UPI',
    card: 'Card',
    netbanking: 'Net banking',
    wallet: 'Wallet',
  };
  return known[method] ?? method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' ');
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function formatRate(paise: number, period: string): string {
  const periodLabel = RATE_PERIOD_LABELS[period] ?? period.toLowerCase();
  return `${formatINR(paise)} / ${periodLabel}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** "12 Jun 2026, 14:32" — used for settled-at and similar audit timestamps. */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}
