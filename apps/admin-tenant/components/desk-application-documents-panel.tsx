'use client';

import { Button } from '@enagar/ui';
import { useEffect, useState } from 'react';

export type DeskApplicationDocument = {
  id: string;
  document_code: string;
  original_name: string;
  mime_type: string;
  size_mb: number;
  upload_status: string;
  scan_status: string;
  created_at: string;
};

type DeskApplicationDocumentsPanelProps = {
  apiBase: string;
  token: string;
  applicationId: string;
  documents: DeskApplicationDocument[];
};

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
  documents,
}: DeskApplicationDocumentsPanelProps): JSX.Element {
  if (!documents.length) {
    return <p className="text-sm text-ink-secondary">No application documents.</p>;
  }

  return (
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
                  {document.document_code} · {document.mime_type} · {document.size_mb.toFixed(2)} MB
                  · {document.scan_status}
                </p>
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
  );
}
