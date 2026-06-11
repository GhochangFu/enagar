'use client';

import { Button, useToast } from '@enagar/ui';
import { useState } from 'react';

import { useTenantAdminSession } from '../tenant-admin-session';

import { LeaseDocumentUploadButton } from './lease-document-upload-button';

export type LeaseDocumentStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface DocRow {
  id: string;
  status: LeaseDocumentStatus;
  fileName: string;
  uploadedAt: string;
  reviewerNote?: string | null;
}

interface Props {
  agreementId: string;
  documents: DocRow[];
  onChanged: () => void;
}

// Roles that may approve / reject documents. Mirrors the API-side
// assertTenantPortalStaff gate; UI-side check is defense-in-depth.
const REVIEWER_ROLES = new Set(['tenant_admin', 'municipality_admin', 'state_admin']);

export function LeaseDocumentPanel({ agreementId, documents, onChanged }: Props): JSX.Element {
  const { token, apiBase, me } = useTenantAdminSession();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  const canReview = !!me && me.normalized_roles.some((r) => REVIEWER_ROLES.has(r));

  async function handleReview(docId: string, decision: 'APPROVE' | 'REJECT') {
    if (decision === 'REJECT' && !note.trim()) {
      toast('Rejection note is required', 'danger');
      return;
    }
    setBusyDocId(docId);
    try {
      const res = await fetch(
        `${apiBase}/rental-assets/agreements/${agreementId}/documents/${docId}/review`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            decision,
            note: decision === 'REJECT' ? note : undefined,
          }),
        },
      );
      if (!res.ok) throw new Error('Review failed');
      setNote('');
      onChanged();
    } catch (err) {
      toast((err as Error).message, 'danger');
    } finally {
      setBusyDocId(null);
    }
  }

  return (
    <section
      className="mt-5 rounded-xl border border-warm-border bg-canvas/40 p-4"
      data-testid="lease-doc-panel"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">
          Agreement documents
        </h3>
        <LeaseDocumentUploadButton agreementId={agreementId} onUploaded={onChanged} />
      </header>

      {documents.length === 0 ? (
        <p className="mt-2 text-xs text-ink-muted">No documents uploaded yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-warm-border rounded-xl border border-warm-border bg-surface">
          {documents.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-2 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-primary">{d.fileName}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Uploaded {new Date(d.uploadedAt).toLocaleString()} · {d.status}
                </p>
                {d.reviewerNote ? (
                  <p className="mt-0.5 text-xs italic text-ink-secondary">
                    Reviewer note: {d.reviewerNote}
                  </p>
                ) : null}
              </div>
              {d.status === 'PENDING_REVIEW' && canReview ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={busyDocId === d.id}
                    onClick={() => handleReview(d.id, 'APPROVE')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busyDocId === d.id}
                    onClick={() => handleReview(d.id, 'REJECT')}
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canReview && documents.some((d) => d.status === 'PENDING_REVIEW') ? (
        <div className="mt-3">
          <label className="block text-xs font-medium text-ink-secondary">
            Reviewer note (required for reject)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-warm-border bg-surface p-2 text-sm text-ink-primary focus:border-brand focus:outline-none"
              rows={2}
              placeholder="Add context for the lessor when you reject…"
            />
          </label>
        </div>
      ) : null}
    </section>
  );
}
