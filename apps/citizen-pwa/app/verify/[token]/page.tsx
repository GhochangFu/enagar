import { notFound } from 'next/navigation';

interface PublicReceiptView {
  receiptNumber: string;
  amountPaise: number;
  currency: string;
  lessorName: string;
  settlementAt: string | null;
  verifiedBy: 'eNagarSeba';
}

async function fetchReceipt(token: string): Promise<PublicReceiptView | null> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
  const res = await fetch(`${base}/verify/${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Verify API returned ${res.status}`);
  return res.json();
}

export default async function VerifyPage({ params }: { params: { token: string } }) {
  const view = await fetchReceipt(params.token);
  if (!view) notFound();
  return (
    <main className="max-w-md mx-auto p-6 space-y-3" data-testid="verify-page">
      <header>
        <h1 className="text-xl font-semibold">Receipt verified</h1>
        <p className="text-xs text-gray-500">Verified by {view.verifiedBy}</p>
      </header>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-500">Receipt no.</dt>
        <dd>{view.receiptNumber}</dd>
        <dt className="text-gray-500">Amount</dt>
        <dd>
          ₹{(view.amountPaise / 100).toFixed(2)} {view.currency}
        </dd>
        <dt className="text-gray-500">Lessor</dt>
        <dd>{view.lessorName}</dd>
        <dt className="text-gray-500">Settled at</dt>
        <dd>{view.settlementAt ? new Date(view.settlementAt).toLocaleString() : '—'}</dd>
      </dl>
      <footer className="border-t pt-2 text-xs text-gray-500">
        This page is public. No PII beyond what the operator already exposes is shown.
      </footer>
    </main>
  );
}
