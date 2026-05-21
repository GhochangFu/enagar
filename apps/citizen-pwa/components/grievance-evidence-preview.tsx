'use client';

import { useEffect, useState } from 'react';

import { authHeaders } from '../lib/workspace-http';

import type { TokenResponse } from '../lib/workspace-types';

export type GrievanceAttachmentSummary = {
  id: string;
  content_type: string;
  storage_key: string;
};

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function isVideoMime(mime: string): boolean {
  return mime.startsWith('video/');
}

function AttachmentPreview({
  apiBaseUrl,
  token,
  grievanceId,
  tenantScopeCode,
  attachment,
}: {
  apiBaseUrl: string;
  token: TokenResponse;
  grievanceId: string;
  tenantScopeCode?: string | null;
  attachment: GrievanceAttachmentSummary;
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
          `${apiBaseUrl}/grievances/${encodeURIComponent(grievanceId)}/attachments/${encodeURIComponent(attachment.id)}/blob`,
          {
            cache: 'no-store',
            headers: authHeaders(token, false, tenantScopeCode),
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
  }, [apiBaseUrl, attachment.content_type, attachment.id, grievanceId, tenantScopeCode, token]);

  const label = attachment.storage_key.split('/').pop() ?? attachment.storage_key;

  if (isImageMime(attachment.content_type)) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {previewUrl && !loadFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated blob preview
          <img src={previewUrl} alt="" className="h-36 w-full object-cover" />
        ) : (
          <div className="flex h-36 items-center justify-center bg-slate-100 text-xs text-slate-600">
            {loadFailed ? 'Preview unavailable' : 'Loading…'}
          </div>
        )}
        <figcaption className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
          {label}
        </figcaption>
      </figure>
    );
  }

  if (isVideoMime(attachment.content_type)) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {previewUrl && !loadFailed ? (
          <video src={previewUrl} controls className="h-36 w-full bg-black object-contain" />
        ) : (
          <div className="flex h-36 items-center justify-center bg-slate-100 text-xs text-slate-600">
            {loadFailed ? 'Video unavailable' : 'Loading video…'}
          </div>
        )}
        <figcaption className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
          {label}
        </figcaption>
      </figure>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
      {label} · {attachment.content_type}
    </div>
  );
}

export function GrievanceEvidencePreviewGrid({
  apiBaseUrl,
  token,
  grievanceId,
  tenantScopeCode,
  attachments,
}: {
  apiBaseUrl: string;
  token: TokenResponse;
  grievanceId: string;
  tenantScopeCode?: string | null;
  attachments: GrievanceAttachmentSummary[];
}): JSX.Element | null {
  if (!attachments.length) {
    return null;
  }

  return (
    <div className="mt-4">
      <p className="font-semibold text-slate-800">Evidence</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <AttachmentPreview
            key={attachment.id}
            apiBaseUrl={apiBaseUrl}
            token={token}
            grievanceId={grievanceId}
            tenantScopeCode={tenantScopeCode}
            attachment={attachment}
          />
        ))}
      </div>
    </div>
  );
}
