'use client';

import { Button } from '@enagar/ui';
import { useMemo, useRef, useState } from 'react';

import { FORM_FIELD_TYPES, type EnagarFormSchema, type FormFieldType } from '@enagar/forms';
import {
  FORM_IMPORT_POLICY,
  applyImportProposalToDraft,
  assessImportProposalApplyability,
  validateImportProposalSchema,
  type FormImportFieldCandidate,
  type FormImportJobRecord,
  type FormImportProposal,
} from '@enagar/forms/form-import';

export type FormImportPanelProps = {
  uploadPath: string;
  getAuthHeaders: () => HeadersInit;
  draftSchema: EnagarFormSchema | null;
  onApply: (schema: EnagarFormSchema) => void;
  onStatus?: (message: string | null) => void;
};

function confidenceBadge(confidence: number): { label: string; className: string } {
  if (confidence < FORM_IMPORT_POLICY.min_accepted_field_confidence) {
    return { label: 'Low confidence', className: 'bg-red-50 text-red-700' };
  }
  if (confidence < FORM_IMPORT_POLICY.warn_field_confidence_below) {
    return { label: 'Review', className: 'bg-amber-50 text-amber-800' };
  }
  return { label: 'High confidence', className: 'bg-emerald-50 text-emerald-700' };
}

export function FormImportPanel({
  uploadPath,
  getAuthHeaders,
  draftSchema,
  onApply,
  onStatus,
}: FormImportPanelProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<FormImportJobRecord | null>(null);
  const [proposal, setProposal] = useState<FormImportProposal | null>(null);

  const applyability = useMemo(
    () => (proposal ? assessImportProposalApplyability(proposal) : { ok: false, reasons: [] }),
    [proposal],
  );

  const schemaValidation = useMemo(() => {
    if (!proposal || !draftSchema) {
      return { ok: false, issues: [] };
    }
    return validateImportProposalSchema(proposal, {
      service_code: draftSchema.service_code,
      version: draftSchema.version,
    });
  }, [draftSchema, proposal]);

  async function uploadFile(file: File): Promise<void> {
    setBusy(true);
    onStatus?.('Uploading Excel template…');
    try {
      const body = new FormData();
      body.append('file', file);
      const headers = getAuthHeaders();
      const response = await fetch(uploadPath, {
        method: 'POST',
        headers,
        body,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(text.slice(0, 240) || `Upload failed (${response.status})`);
      }
      const payload = (await response.json()) as FormImportJobRecord;
      setJob(payload);
      if (payload.proposal) {
        setProposal(cloneProposal(payload.proposal));
      } else {
        setProposal(null);
      }
      onStatus?.(
        payload.status === 'completed'
          ? `Import ready — review ${payload.proposal?.fields.length ?? 0} proposed fields.`
          : (payload.rejection_reason ?? 'Import was rejected.'),
      );
    } catch (error) {
      setJob(null);
      setProposal(null);
      onStatus?.(error instanceof Error ? error.message : 'Import upload failed');
    } finally {
      setBusy(false);
    }
  }

  function updateCandidate(candidateId: string, patch: Partial<FormImportFieldCandidate>): void {
    setProposal((current) => {
      if (!current) {
        return current;
      }
      const fields = current.fields.map((field) =>
        field.candidate_id === candidateId ? { ...field, ...patch } : field,
      );
      const overall_confidence =
        fields
          .filter((field) => field.disposition !== 'rejected')
          .reduce((sum, field) => sum + field.confidence, 0) /
        Math.max(fields.filter((field) => field.disposition !== 'rejected').length, 1);
      return { ...current, fields, overall_confidence };
    });
  }

  function moveCandidate(candidateId: string, direction: -1 | 1): void {
    setProposal((current) => {
      if (!current) {
        return current;
      }
      const index = current.fields.findIndex((field) => field.candidate_id === candidateId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.fields.length) {
        return current;
      }
      const fields = [...current.fields];
      const [field] = fields.splice(index, 1);
      if (!field) {
        return current;
      }
      fields.splice(target, 0, field);
      return { ...current, fields };
    });
  }

  function applyToDraft(): void {
    if (!proposal || !draftSchema) {
      onStatus?.('Load a valid form draft before applying import.');
      return;
    }
    if (!applyability.ok) {
      onStatus?.(applyability.reasons.join('; '));
      return;
    }
    if (!schemaValidation.ok) {
      onStatus?.(
        schemaValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '),
      );
      return;
    }
    const next = applyImportProposalToDraft(draftSchema, proposal);
    onApply(next);
    setJob(null);
    setProposal(null);
    onStatus?.('Imported fields applied to draft. Save draft when ready.');
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Form import</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Import from Excel</h2>
          <p className="text-xs text-slate-500">
            Upload a `.xlsx` template, review proposed fields, then apply to the current draft.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadFile(file);
              }
              event.target.value = '';
            }}
          />
          <Button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? 'Uploading…' : 'Import form'}
          </Button>
          {proposal ? (
            <Button type="button" variant="secondary" onClick={() => void applyToDraft()}>
              Apply to draft
            </Button>
          ) : null}
        </div>
      </div>

      {job?.rejection_reason ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {job.rejection_reason}
        </p>
      ) : null}

      {proposal ? (
        <div className="mt-4 space-y-3">
          {!applyability.ok ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {applyability.reasons.join('; ')}
            </p>
          ) : null}
          {!schemaValidation.ok ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {schemaValidation.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')}
            </p>
          ) : null}
          {proposal.fields.map((field) => {
            const badge = confidenceBadge(field.confidence);
            const rejected = field.disposition === 'rejected';
            return (
              <div
                key={field.candidate_id}
                className={`rounded-lg border p-3 ${rejected ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{field.field_id}</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {field.label.en ?? field.field_id}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>
                    {badge.label} · {(field.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <label className="text-xs text-slate-600">
                    Label (English)
                    <input
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      value={field.label.en ?? ''}
                      onChange={(event) =>
                        updateCandidate(field.candidate_id, {
                          label: { ...field.label, en: event.target.value },
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Type
                    <select
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      value={field.type}
                      onChange={(event) =>
                        updateCandidate(field.candidate_id, {
                          type: event.target.value as FormFieldType,
                        })
                      }
                    >
                      {FORM_FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      updateCandidate(field.candidate_id, {
                        disposition: rejected ? 'accepted' : 'rejected',
                      })
                    }
                  >
                    {rejected ? 'Accept' : 'Reject'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => moveCandidate(field.candidate_id, -1)}
                  >
                    Move up
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => moveCandidate(field.candidate_id, 1)}
                  >
                    Move down
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

function cloneProposal(proposal: FormImportProposal): FormImportProposal {
  return {
    ...proposal,
    fields: proposal.fields.map((field) => ({
      ...field,
      label: { ...field.label },
      help_text: field.help_text ? { ...field.help_text } : undefined,
      options: field.options?.map((option) => ({
        ...option,
        label: { ...option.label },
      })),
    })),
  };
}
