import { Button, FieldLabel, TextField, useToast } from '@enagar/ui';
import { useEffect, useState } from 'react';

import { DataRow } from './data-row';
import { IconHeader } from './icon-header';
import { ModalShell } from './modal-shell';

import type { LeaseAgreement } from './types';

export function EditLessorPhoneModal({
  lease,
  apiBase,
  token,
  onClose,
  onSaved,
}: {
  lease: LeaseAgreement | null;
  apiBase: string;
  token: string;
  onClose: () => void;
  onSaved: (updated: { id: string; lessorPhone: string | null }) => void;
}): JSX.Element | null {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPhone(lease?.lessorPhone ?? '');
  }, [lease]);

  if (!lease) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`${apiBase}/rental-assets/agreements/${lease.id}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ lessorPhone: phone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const updated = (await res.json()) as { id: string; lessorPhone: string | null };
      onSaved(updated);
      toast('Lessor phone updated.', 'success');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast(`Could not update phone: ${message}`, 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} labelledBy="edit-phone-title" size="sm" z="z-[70]">
      <IconHeader icon="phone" eyebrow="Edit lessor phone" title={lease.lessorName} />
      <p className="mt-2 text-xs text-ink-muted">
        Used by the citizen portal to look up this lease. Leave blank to remove access.
      </p>
      <form onSubmit={handleSave} className="mt-5 space-y-4">
        <DataRow icon="file-text" label="Trade License" value={lease.tradeLicenseNo} mono />
        <div className="space-y-2">
          <FieldLabel htmlFor="lessorPhone">Phone</FieldLabel>
          <TextField
            id="lessorPhone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g., 9876543210"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" icon="check" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
