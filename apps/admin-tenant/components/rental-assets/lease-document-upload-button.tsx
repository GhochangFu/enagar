'use client';

import { Button, useToast } from '@enagar/ui';
import { useRef, useState } from 'react';

import { useTenantAdminSession } from '../tenant-admin-session';

interface Props {
  agreementId: string;
  onUploaded?: (doc: { id: string; status: string }) => void;
}

const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg'] as const;
type AllowedMime = (typeof ALLOWED)[number];

function isAllowedMime(value: string): value is AllowedMime {
  return (ALLOWED as readonly string[]).includes(value);
}

export function LeaseDocumentUploadButton({ agreementId, onUploaded }: Props): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  // A `<label>` wrapping a hidden `<input type="file">` is the typical
  // "button that opens a file picker" pattern, but it stops working as
  // soon as the visible UI inside the label is a real `<button>` — the
  // button captures the click and the label's "trigger input" behaviour
  // is suppressed. Drive the input from a ref instead.
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isAllowedMime(file.type)) {
      toast('Only PDF, PNG, or JPEG files are allowed', 'danger');
      e.target.value = '';
      return;
    }
    setBusy(true);
    try {
      // 1. presign
      const presignRes = await fetch(
        `${apiBase}/rental-assets/agreements/${agreementId}/documents/upload-url`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            agreementId,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        },
      );
      if (!presignRes.ok) throw new Error('Failed to get upload URL');
      const { url, storageKey } = (await presignRes.json()) as {
        url: string;
        storageKey: string;
      };

      // 2. PUT file to the presigned URL (S3 or stub). Hash for the
      //    API's record-upload step (server validates sha256 against the
      //    bytes that just landed in object storage).
      const buf = await file.arrayBuffer();
      const sha = await crypto.subtle.digest('SHA-256', buf);
      const shaHex = Array.from(new Uint8Array(sha))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const putRes = await fetch(url, {
        method: 'PUT',
        body: buf,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) {
        throw new Error(`Upload to object storage failed (HTTP ${putRes.status})`);
      }

      // 3. record the upload
      const recordRes = await fetch(
        `${apiBase}/rental-assets/agreements/${agreementId}/documents`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            agreementId,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            sha256: shaHex,
            storageKey,
          }),
        },
      );
      if (!recordRes.ok) throw new Error('Failed to record upload');
      const doc = (await recordRes.json()) as { id: string; status: string };
      onUploaded?.(doc);
      toast('Document uploaded — awaiting review', 'success');
    } catch (err) {
      toast((err as Error).message, 'danger');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(',')}
        onChange={onPick}
        disabled={busy}
        className="hidden"
        data-testid="lease-doc-upload"
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Uploading…' : 'Upload signed lease'}
      </Button>
    </>
  );
}
