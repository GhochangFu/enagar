'use client';

import { Button, useToast } from '@enagar/ui';
import { useEffect, useState } from 'react';

const SOFT_CAP_RUPEES = 5_000;
const MAX_FEE_RUPEES = 100_000; // mirrors the DTO cap (₹100,000 / 10,000,000 paise).

interface LateFeeSectionProps {
  tenantCode: string;
  apiBase: string;
  token: string;
}

export function LateFeeSection({ tenantCode, apiBase, token }: LateFeeSectionProps): JSX.Element {
  const [rupees, setRupees] = useState(0);
  const [original, setOriginal] = useState(0);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`${apiBase}/tenants/${tenantCode}/config`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setRupees(d.lateFeePaise / 100);
          setOriginal(d.lateFeePaise / 100);
        }
      });
  }, [apiBase, tenantCode, token]);

  async function save(): Promise<void> {
    if (rupees < 0) {
      toast('Late fee cannot be negative', 'danger');
      return;
    }
    if (
      !window.confirm(
        'This change applies to invoices flipped overdue after this moment. Already-overdue invoices are not retroactively changed. Continue?',
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/tenants/${tenantCode}/config`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lateFeePaise: Math.round(rupees * 100) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Save failed');
      }
      if (rupees > SOFT_CAP_RUPEES) {
        toast(
          `Heads up: ₹${rupees.toFixed(2)} is above the ₹${SOFT_CAP_RUPEES} soft cap`,
          'warning',
        );
      } else {
        toast('Late fee updated', 'success');
      }
      setOriginal(rupees);
    } catch (err) {
      toast((err as Error).message, 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border p-4 space-y-2 max-w-md" data-testid="late-fee-section">
      <h3 className="text-sm font-semibold">Late fee configuration</h3>
      <p className="text-xs text-gray-600">
        Flat late fee applied when the daily scheduler flips an invoice to <code>OVERDUE</code>.
      </p>
      <label className="block text-sm">
        Late fee (₹)
        <input
          type="number"
          min={0}
          max={MAX_FEE_RUPEES}
          step="0.01"
          value={rupees}
          onChange={(e) => setRupees(parseFloat(e.target.value) || 0)}
          className="border rounded px-2 py-1 w-32 ml-2"
          data-testid="late-fee-input"
        />
      </label>
      <Button
        type="button"
        disabled={busy || rupees === original}
        onClick={save}
        data-testid="late-fee-save"
      >
        {busy ? 'Saving…' : 'Save'}
      </Button>
    </section>
  );
}
