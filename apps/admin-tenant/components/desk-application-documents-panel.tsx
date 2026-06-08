'use client';

import { Button } from '@enagar/ui';
import { useEffect, useRef, useState } from 'react';

import {
  uploadDeskApplicationDocument,
  type DeskApplicationDocumentsResponse,
} from '../lib/desk-application-documents-api';

export type DeskApplicationDocument = {
  id: string;
  document_code: string;
  original_name: string;
  mime_type: string;
  size_mb: number;
  upload_status: string;
  scan_status: string;
  created_at: string;
  workflow_stage_code?: string;
  uploaded_by_role?: string;
  note?: string;
};

type DeskApplicationDocumentsPanelProps = {
  apiBase: string;
  token: string;
  applicationId: string;
  /** Current workflow stage of the application. Stamped on every staff attachment. */
  currentStage: string;
  documents: DeskApplicationDocument[];
  /** Invoked after a successful upload so the parent can re-fetch the application. */
  onUploaded?: (document: DeskApplicationDocumentsResponse) => void;
};

const SUPPORTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function isPdfMime(mime: string): boolean {
  return mime === 'application/pdf';
}

function DocumentPreview({
  apiBase,
  token,
  applicationId,
  document,
}: {
  apiBase: string;
  token: string;
  applicationId: string;
  document: DeskApplicationDocument;
}): JSX.Element {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    if (document.scan_status !== 'clean') {
      return;
    }
    if (!isImageMime(document.mime_type) && !isPdfMime(document.mime_type)) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch(
          `${apiBase}/admin/tenant/desk/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(document.id)}/blob`,
          {
            cache: 'no-store',
            headers: { authorization: `Bearer ${token}` },
          },
        );
        if (!response.ok || cancelled) {
          if (!cancelled) {
            setLoadFailed(true);
          }
          return;
        }
        const blob = await response.blob();
        if (cancelled) {
          return;
        }
        revoked = URL.createObjectURL(blob);
        setPreviewUrl(revoked);
        setLoadFailed(false);
      } catch {
        if (!cancelled) {
          setLoadFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) {
        URL.revokeObjectURL(revoked);
      }
    };
  }, [apiBase, applicationId, document.id, document.mime_type, document.scan_status, token]);

  if (document.scan_status !== 'clean') {
    return (
      <p className="text-xs text-ink-secondary">Scan {document.scan_status} — preview when clean</p>
    );
  }

  if (loadFailed) {
    return <p className="text-xs text-ink-secondary">Preview unavailable</p>;
  }

  if (previewUrl && isImageMime(document.mime_type)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl}
        alt={document.original_name}
        className="max-h-48 w-full rounded-lg border border-warm-border object-contain bg-surface"
      />
    );
  }

  if (previewUrl && isPdfMime(document.mime_type)) {
    return (
      <iframe
        title={document.original_name}
        src={previewUrl}
        className="h-56 w-full rounded-lg border border-warm-border bg-surface"
      />
    );
  }

  return <p className="text-xs text-ink-secondary">Loading preview…</p>;
}

export function DeskApplicationDocumentsPanel({
  apiBase,
  token,
  applicationId,
  currentStage,
  documents,
  onUploaded,
}: DeskApplicationDocumentsPanelProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [documentCode, setDocumentCode] = useState('context_attachment');
  const [note, setNote] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function resetForm(): void {
    setPendingFile(null);
    setNote('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!pendingFile || isUploading) {
      return;
    }
    setIsUploading(true);
    setUploadStatus('Uploading…');
    setUploadError(null);
    try {
      const uploaded = await uploadDeskApplicationDocument({
        apiBase,
        token,
        applicationId,
        file: pendingFile,
        documentCode,
        workflowStageCode: currentStage,
        note: note.trim() || undefined,
      });
      setUploadStatus(`Attached at stage "${currentStage}" — scan ${uploaded.scan_status}.`);
      resetForm();
      onUploaded?.(uploaded);
    } catch (error) {
      setUploadStatus(null);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="rounded-xl border border-warm-border bg-surface p-3 space-y-2"
        aria-label="Attach a document to the current stage"
      >
        <p className="text-sm font-semibold text-ink-primary">
          Attach a document to stage{' '}
          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-warm-border/40">
            {currentStage}
          </span>
        </p>
        <p className="text-xs text-ink-secondary">
          Optional. Does not block the transition. PDF, JPEG, or PNG; up to 10&nbsp;MB.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
          <label className="text-xs text-ink-secondary space-y-1">
            <span>Document code</span>
            <input
              type="text"
              value={documentCode}
              onChange={(event) => setDocumentCode(event.target.value)}
              className="w-full rounded border border-warm-border px-2 py-1 text-sm bg-canvas"
              maxLength={80}
              required
            />
          </label>
          <label className="text-xs text-ink-secondary space-y-1">
            <span>Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded border border-warm-border px-2 py-1 text-sm bg-canvas"
              maxLength={500}
              placeholder="What is this document for?"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORTED_MIME_TYPES.join(',')}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPendingFile(file);
            }}
            className="text-sm"
            required
          />
          <Button type="submit" size="sm" disabled={!pendingFile || isUploading}>
            {isUploading ? 'Uploading…' : 'Attach'}
          </Button>
        </div>
        {uploadStatus ? (
          <p className="text-xs text-ink-secondary" role="status">
            {uploadStatus}
          </p>
        ) : null}
        {uploadError ? (
          <p className="text-xs text-danger" role="alert">
            {uploadError}
          </p>
        ) : null}
      </form>

      {documents.length === 0 ? (
        <p className="text-sm text-ink-secondary">No application documents.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-ink-primary">Application documents</p>
          <ul className="space-y-3">
            {documents.map((document) => (
              <li
                key={document.id}
                className="rounded-xl border border-warm-border bg-surface p-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink-primary">{document.original_name}</p>
                    <p className="text-xs text-ink-secondary">
                      {document.document_code} · {document.mime_type} ·{' '}
                      {document.size_mb.toFixed(2)} MB · {document.scan_status}
                      {document.workflow_stage_code
                        ? ` · stage ${document.workflow_stage_code}`
                        : ''}
                      {document.uploaded_by_role ? ` · by ${document.uploaded_by_role}` : ''}
                    </p>
                    {document.note ? (
                      <p className="text-xs text-ink-secondary italic">{document.note}</p>
                    ) : null}
                  </div>
                  {document.scan_status === 'clean' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        void (async () => {
                          const response = await fetch(
                            `${apiBase}/admin/tenant/desk/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(document.id)}/blob`,
                            {
                              headers: { authorization: `Bearer ${token}` },
                            },
                          );
                          if (!response.ok) {
                            return;
                          }
                          const blob = await response.blob();
                          const url = URL.createObjectURL(blob);
                          const anchor = window.document.createElement('a');
                          anchor.href = url;
                          anchor.download = document.original_name;
                          anchor.click();
                          URL.revokeObjectURL(url);
                        })();
                      }}
                    >
                      Download
                    </Button>
                  ) : null}
                </div>
                {token ? (
                  <DocumentPreview
                    apiBase={apiBase}
                    token={token}
                    applicationId={applicationId}
                    document={document}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
