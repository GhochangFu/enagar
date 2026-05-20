'use client';

import { type ReactNode, useEffect, useState } from 'react';

export type DeskGrievanceAttachment = {
  id: string;
  content_type: string;
  storage_key: string;
  created_at: string;
};

type DeskGrievanceEvidencePanelProps = {
  apiBase: string;
  token: string;
  grievanceId: string;
  attachments: DeskGrievanceAttachment[];
  photoKeys: unknown;
};

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function isVideoMime(mime: string): boolean {
  return mime.startsWith('video/');
}

function legacyPhotoKeys(photoKeys: unknown): string[] {
  if (!Array.isArray(photoKeys)) {
    return [];
  }
  return photoKeys.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function AttachmentPreview({
  apiBase,
  token,
  grievanceId,
  attachment,
}: {
  apiBase: string;
  token: string;
  grievanceId: string;
  attachment: DeskGrievanceAttachment;
}): JSX.Element {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    if (!isImageMime(attachment.content_type) && !isVideoMime(attachment.content_type)) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch(
          `${apiBase}/admin/tenant/desk/grievances/${encodeURIComponent(grievanceId)}/attachments/${encodeURIComponent(attachment.id)}/blob`,
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
  }, [apiBase, attachment.content_type, attachment.id, grievanceId, token]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const label = attachment.storage_key.split('/').pop() ?? attachment.storage_key;

  if (isImageMime(attachment.content_type)) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-warm-border bg-surface">
        {previewUrl && !loadFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated blob preview
          <img src={previewUrl} alt="" className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-1 bg-mint-band/40 px-3 text-center text-xs text-ink-secondary">
            <span className="text-2xl" aria-hidden>
              📷
            </span>
            <span>{loadFailed ? 'Preview unavailable' : 'Loading…'}</span>
          </div>
        )}
        <figcaption className="border-t border-warm-border px-3 py-2 text-xs text-ink-secondary">
          {label} · {attachment.content_type}
        </figcaption>
      </figure>
    );
  }

  if (isVideoMime(attachment.content_type)) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-warm-border bg-surface">
        {previewUrl && !loadFailed ? (
          <video src={previewUrl} controls className="h-40 w-full bg-black object-contain" />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-1 bg-mint-band/40 px-3 text-center text-xs text-ink-secondary">
            <span className="text-2xl" aria-hidden>
              🎬
            </span>
            <span>{loadFailed ? 'Video preview unavailable' : 'Loading video…'}</span>
          </div>
        )}
        <figcaption className="border-t border-warm-border px-3 py-2 text-xs text-ink-secondary">
          {label} · {attachment.content_type}
        </figcaption>
      </figure>
    );
  }

  return (
    <div className="rounded-2xl border border-warm-border bg-mint-band/30 p-4 text-xs text-ink-secondary">
      <p className="font-medium text-ink-primary">{label}</p>
      <p className="mt-1">{attachment.content_type}</p>
    </div>
  );
}

function EvidenceSection({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold text-ink-primary">{title}</h4>
      {children}
    </section>
  );
}

export function DeskGrievanceEvidencePanel({
  apiBase,
  token,
  grievanceId,
  attachments,
  photoKeys,
}: DeskGrievanceEvidencePanelProps): JSX.Element | null {
  const legacy = legacyPhotoKeys(photoKeys);
  if (!attachments.length && !legacy.length) {
    return null;
  }

  return (
    <EvidenceSection title="Evidence (photos & video)">
      {attachments.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {attachments.map((attachment) => (
            <AttachmentPreview
              key={attachment.id}
              apiBase={apiBase}
              token={token}
              grievanceId={grievanceId}
              attachment={attachment}
            />
          ))}
        </div>
      ) : null}
      {legacy.length ? (
        <ul className="space-y-1 rounded-2xl border border-warm-border bg-mint-band/20 p-3 font-mono text-xs text-ink-secondary">
          {legacy.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      ) : null}
    </EvidenceSection>
  );
}
