'use client';

import { t, type Locale } from '@enagar/i18n';
import { useEffect, useRef, useState } from 'react';

import {
  isVideoEvidenceMime,
  MAX_GRIEVANCE_EVIDENCE_FILES,
  validateGrievanceEvidenceFile,
  type PendingGrievanceEvidence,
} from '../lib/grievance-evidence';

type GrievanceEvidenceFieldProps = {
  language: Locale;
  items: PendingGrievanceEvidence[];
  onChange: (items: PendingGrievanceEvidence[]) => void;
  onError: (message: string) => void;
};

export function GrievanceEvidenceField({
  language,
  items,
  onChange,
  onError,
}: GrievanceEvidenceFieldProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      for (const url of previewUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previewUrls]);

  function addFiles(fileList: FileList | null): void {
    if (!fileList?.length) {
      return;
    }
    const next = [...items];
    const newUrls: string[] = [];

    for (const file of Array.from(fileList)) {
      if (next.length >= MAX_GRIEVANCE_EVIDENCE_FILES) {
        onError(t('grievance.evidenceLimit', language));
        break;
      }
      const validationError = validateGrievanceEvidenceFile(file);
      if (validationError) {
        onError(validationError);
        continue;
      }
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      if (previewUrl) {
        newUrls.push(previewUrl);
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        previewUrl,
        mimeType: file.type,
        label: file.name,
      });
    }

    onChange(next);
    if (newUrls.length) {
      setPreviewUrls((prev) => [...prev, ...newUrls]);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  function removeItem(id: string): void {
    const removed = items.find((row) => row.id === id);
    if (removed?.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
      setPreviewUrls((prev) => prev.filter((url) => url !== removed.previewUrl));
    }
    onChange(items.filter((row) => row.id !== id));
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-700">
        {t('grievance.evidenceTitle', language)}
      </legend>
      <p className="text-xs text-slate-600">{t('grievance.evidenceHelp', language)}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-slate-600 transition hover:border-brand hover:bg-white"
          onClick={() => inputRef.current?.click()}
          disabled={items.length >= MAX_GRIEVANCE_EVIDENCE_FILES}
        >
          <span className="text-2xl" aria-hidden>
            📷
          </span>
          <span className="text-sm font-semibold">{t('grievance.evidenceAddPhoto', language)}</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-slate-600 transition hover:border-brand hover:bg-white"
          onClick={() => inputRef.current?.click()}
          disabled={items.length >= MAX_GRIEVANCE_EVIDENCE_FILES}
        >
          <span className="text-2xl" aria-hidden>
            🎬
          </span>
          <span className="text-sm font-semibold">{t('grievance.evidenceAddVideo', language)}</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        className="sr-only"
        onChange={(event) => addFiles(event.target.files)}
      />

      {items.length ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
            >
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- blob preview URL
                <img
                  src={item.previewUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-600">
                  {isVideoEvidenceMime(item.mimeType) ? 'VIDEO' : 'FILE'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500">
                  {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-rose-700"
                onClick={() => removeItem(item.id)}
              >
                {t('grievance.evidenceRemove', language)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </fieldset>
  );
}
