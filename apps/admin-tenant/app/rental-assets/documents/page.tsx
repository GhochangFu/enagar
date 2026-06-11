'use client';

import {
  Badge,
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  Icon,
  PageHeader,
  SegmentedControl,
  ToastProvider,
  useToast,
} from '@enagar/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from '../../../components/tenant-admin-session';

type DocStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

interface ReviewQueueRow {
  id: string;
  status: DocStatus;
  fileName: string;
  uploadedAt: string;
  agreementId: string;
  lessorName: string;
  assetName: string;
  reviewerNote?: string | null;
}

// Mirrors the API-side assertTenantPortalStaff gate for approve / reject.
const REVIEWER_ROLES = new Set(['tenant_admin', 'municipality_admin', 'state_admin']);

const STATUS_LABELS: Record<DocStatus, string> = {
  PENDING_REVIEW: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const STATUS_TONE: Record<DocStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

function DocumentsReviewContent() {
  const { token, apiBase, me } = useTenantAdminSession();
  const { toast } = useToast();
  const router = useRouter();
  const [rows, setRows] = useState<ReviewQueueRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DocStatus>('PENDING_REVIEW');
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');

  const canReview = !!me && me.normalized_roles.some((r) => REVIEWER_ROLES.has(r));

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/rental-assets/documents?status=${statusFilter}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Array<{
        id: string;
        status: DocStatus;
        fileName: string;
        uploadedAt: string;
        agreementId: string;
        reviewerNote?: string | null;
        agreement?: { lessorName?: string; asset?: { name?: { en?: string } } };
      }>;
      setRows(
        data.map((d) => ({
          id: d.id,
          status: d.status,
          fileName: d.fileName,
          uploadedAt: d.uploadedAt,
          agreementId: d.agreementId,
          lessorName: d.agreement?.lessorName ?? '—',
          assetName: d.agreement?.asset?.name?.en ?? '—',
          reviewerNote: d.reviewerNote ?? null,
        })),
      );
    } catch (error) {
      console.error('Failed to fetch review queue', error);
      toast('Could not load the document review queue.', 'danger');
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, authHeaders, statusFilter, toast]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const counts = useMemo(() => {
    const c: Record<DocStatus, number> = {
      PENDING_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
    };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  async function reviewDocument(
    docId: string,
    agreementId: string,
    decision: 'APPROVE' | 'REJECT',
    note?: string,
  ) {
    setBusyDocId(docId);
    try {
      const res = await fetch(
        `${apiBase}/rental-assets/agreements/${agreementId}/documents/${docId}/review`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ decision, note: note ?? undefined }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? 'Review failed');
      }
      toast(
        decision === 'APPROVE' ? 'Document approved.' : 'Document rejected.',
        decision === 'APPROVE' ? 'success' : 'info',
      );
      setRejectionNote('');
      await loadDocuments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Review failed';
      toast(`Review failed: ${message}`, 'danger');
    } finally {
      setBusyDocId(null);
    }
  }

  function handleReject(docId: string, agreementId: string) {
    if (!rejectionNote.trim()) {
      toast('Rejection note is required.', 'warning');
      return;
    }
    void reviewDocument(docId, agreementId, 'REJECT', rejectionNote.trim());
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Documents — review queue"
        description="Lease agreement documents uploaded by staff. Approve to activate the lease, or reject with a note for the operator."
      />

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-warm-border p-4 md:flex-row md:items-center md:justify-between">
          <SegmentedControl
            aria-label="Filter by document status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as DocStatus)}
            options={[
              { value: 'PENDING_REVIEW', label: `Pending (${counts.PENDING_REVIEW})` },
              { value: 'APPROVED', label: `Approved (${counts.APPROVED})` },
              { value: 'REJECTED', label: `Rejected (${counts.REJECTED})` },
            ]}
          />
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Icon name="alert-circle" size={12} />
            {canReview
              ? 'You can approve or reject pending documents below.'
              : 'Read-only — your role can view but not review.'}
          </div>
        </div>

        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>File</DataTableHeaderCell>
              <DataTableHeaderCell>Lessor</DataTableHeaderCell>
              <DataTableHeaderCell>Asset</DataTableHeaderCell>
              <DataTableHeaderCell>Uploaded</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {isLoading ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-10 text-center text-ink-muted">
                  <div className="flex items-center justify-center gap-2">
                    <Icon name="refresh" size={14} className="animate-spin" />
                    Loading documents…
                  </div>
                </DataTableCell>
              </DataTableRow>
            ) : rows.length === 0 ? (
              <DataTableRow>
                <DataTableCell colSpan={6} className="py-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-ink-muted">
                      <Icon name="inbox" size={20} />
                    </div>
                    <p className="text-sm font-medium text-ink-primary">
                      No documents in this bucket
                    </p>
                    <p className="text-xs text-ink-muted">
                      {statusFilter === 'PENDING_REVIEW'
                        ? 'Nothing is waiting for review right now.'
                        : `No ${STATUS_LABELS[statusFilter].toLowerCase()} documents in this tenant.`}
                    </p>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ) : (
              rows.map((row) => (
                <DataTableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-canvas/60"
                  onClick={() => router.push(`/rental-assets?lease=${row.agreementId}`)}
                >
                  <DataTableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-primary">{row.fileName}</p>
                      {row.reviewerNote ? (
                        <p className="mt-0.5 text-xs italic text-ink-secondary">
                          Reviewer note: {row.reviewerNote}
                        </p>
                      ) : null}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="text-ink-secondary">{row.lessorName}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="text-ink-secondary">{row.assetName}</span>
                  </DataTableCell>
                  <DataTableCell>
                    <span className="text-xs text-ink-muted">
                      {new Date(row.uploadedAt).toLocaleString()}
                    </span>
                  </DataTableCell>
                  <DataTableCell>
                    <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    {row.status === 'PENDING_REVIEW' && canReview ? (
                      <div
                        className="inline-flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={busyDocId === row.id}
                          onClick={() => void reviewDocument(row.id, row.agreementId, 'APPROVE')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busyDocId === row.id}
                          onClick={() => handleReject(row.id, row.agreementId)}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>

        {!isLoading && rows.length > 0 ? (
          <div className="flex items-center justify-between border-t border-warm-border bg-canvas/40 px-4 py-2 text-xs text-ink-muted">
            <span>
              Showing {rows.length} {STATUS_LABELS[statusFilter].toLowerCase()} document
              {rows.length === 1 ? '' : 's'}
            </span>
            <span>
              {canReview
                ? 'Click a row to open the lease detail modal.'
                : 'You do not have permission to review documents.'}
            </span>
          </div>
        ) : null}
      </Card>

      {canReview ? (
        <Card className="p-4">
          <label className="block text-xs font-medium text-ink-secondary">
            Reviewer note (required for reject)
            <textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              rows={2}
              placeholder="Add context that the operator will see when this document is rejected…"
              className="mt-1 w-full rounded-lg border border-warm-border bg-surface p-2 text-sm text-ink-primary focus:border-brand focus:outline-none"
            />
          </label>
        </Card>
      ) : null}
    </div>
  );
}

export default function DocumentsReviewPage() {
  return (
    <ToastProvider>
      <DocumentsReviewContent />
    </ToastProvider>
  );
}
