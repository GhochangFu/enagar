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
  PaginationBar,
  SegmentedControl,
  ToastProvider,
  useToast,
} from '@enagar/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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

type StatusCounts = Record<DocStatus, number>;

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

const EMPTY_COUNTS: StatusCounts = {
  PENDING_REVIEW: 0,
  APPROVED: 0,
  REJECTED: 0,
};

// RentalAsset.name is a Json column in the schema; it can be a plain string
// (when authored via older seeds) or a localized { en, ... } object. Pick
// whichever shape arrives rather than assuming `.en`.
function pickAssetName(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const o = raw as { en?: unknown; en_IN?: unknown; default?: unknown };
    if (typeof o.en === 'string') return o.en;
    if (typeof o.en_IN === 'string') return o.en_IN;
    if (typeof o.default === 'string') return o.default;
  }
  return '—';
}

function DocumentsReviewContent() {
  const { token, apiBase, me } = useTenantAdminSession();
  const { toast } = useToast();
  const router = useRouter();
  const [rows, setRows] = useState<ReviewQueueRow[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DocStatus>('PENDING_REVIEW');
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');

  const canReview = !!me && me.normalized_roles.some((r) => REVIEWER_ROLES.has(r));

  // Defense-in-depth: the API 403s for non-reviewers, but a staff member
  // with a weaker role could still read the queue (file names, lessor
  // names, reviewer notes) by visiting this URL directly. Redirect them.
  useEffect(() => {
    if (me && !canReview) {
      router.replace('/rental-assets');
    }
  }, [me, canReview, router]);

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
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`${apiBase}/rental-assets/documents?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        items: Array<{
          id: string;
          status: DocStatus;
          fileName: string;
          uploadedAt: string;
          agreementId: string;
          reviewerNote?: string | null;
          agreement?: { lessorName?: string; asset?: { name?: unknown } };
        }>;
        total: number;
        page: number;
        page_size: number;
        status_counts: StatusCounts;
      };
      setRows(
        data.items.map((d) => ({
          id: d.id,
          status: d.status,
          fileName: d.fileName,
          uploadedAt: d.uploadedAt,
          agreementId: d.agreementId,
          lessorName: d.agreement?.lessorName ?? '—',
          assetName: pickAssetName(d.agreement?.asset?.name),
          reviewerNote: d.reviewerNote ?? null,
        })),
      );
      setTotal(data.total);
      setStatusCounts(data.status_counts ?? EMPTY_COUNTS);
    } catch (error) {
      console.error('Failed to fetch review queue', error);
      toast('Could not load the document review queue.', 'danger');
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, authHeaders, page, pageSize, statusFilter, toast]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
              { value: 'PENDING_REVIEW', label: `Pending (${statusCounts.PENDING_REVIEW})` },
              { value: 'APPROVED', label: `Approved (${statusCounts.APPROVED})` },
              { value: 'REJECTED', label: `Rejected (${statusCounts.REJECTED})` },
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

        {!isLoading && total > 0 ? (
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
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
