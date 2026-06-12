import { Button, FieldLabel, TextField, useToast } from '@enagar/ui';
import { useEffect, useState } from 'react';

import { IconHeader } from './icon-header';
import { ModalShell } from './modal-shell';

import type { JSX } from 'react';

const SOFT_CAP_RUPEES = 5_000;
const MAX_FEE_RUPEES = 100_000; // mirrors the DTO cap (₹100,000 / 10,000,000 paise).

export function LateFeeConfigModal({
  tenantCode,
  apiBase,
  token,
  onClose,
}: {
  tenantCode: string;
  apiBase: string;
  token: string;
  onClose: () => void;
}): JSX.Element {
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
      onClose();
    } catch (err) {
      toast((err as Error).message, 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell onClose={onClose} labelledBy="late-fee-title" size="sm" z="z-[70]">
      <div data-testid="late-fee-section">
        <IconHeader icon="receipt" eyebrow="Configuration" title="Late fee" />
        <p className="mt-2 text-xs text-ink-muted">
          Flat late fee applied when the daily scheduler flips an invoice to{' '}
          <code className="rounded bg-canvas px-1 py-0.5 font-mono text-[11px]">OVERDUE</code>.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="space-y-2">
            <FieldLabel htmlFor="late-fee-input">Late fee (₹)</FieldLabel>
            <TextField
              id="late-fee-input"
              type="number"
              min={0}
              max={MAX_FEE_RUPEES}
              step="0.01"
              value={String(rupees)}
              onChange={(e) => setRupees(parseFloat(e.target.value) || 0)}
              data-testid="late-fee-input"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              icon="check"
              disabled={busy || rupees === original}
              data-testid="late-fee-save"
            >
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
}
