'use client';

import {
  ChoiceGrid,
  ChoicePill,
  DateField,
  FieldLabel,
  FieldRow,
  HelpText,
  NumberField,
  SectionHeading,
  TextAreaField,
  TextField,
} from '@enagar/ui';

import type { FileSubmission, FormRenderNode, FormSubmissionValue } from '../index';

type Props = {
  nodes: FormRenderNode[];
  values: Record<string, FormSubmissionValue | undefined>;
  onChange: (fieldId: string, value: FormSubmissionValue | undefined) => void;
  /** When the citizen picks a file, the parent can retain the `File` blob for upload after submit. */
  onFileBlob?: (fieldId: string, file: File | null) => void;
};

function isFileSubmission(value: FormSubmissionValue | undefined): value is FileSubmission {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'name' in value);
}

/**
 * Renders `@enagar/forms` **`createRenderPlan`** nodes on the web (`platform: 'web'`).
 * Uses **`@enagar/ui`** primitives so Tailwind + tenant **`--brand-rgb`** stay consistent across surfaces.
 */
export function DynamicFormFields({ nodes, values, onChange, onFileBlob }: Props) {
  return (
    <>
      {nodes
        .filter((node) => node.visible)
        .map((node) => (
          <FormNode
            key={node.id}
            node={node}
            onChange={onChange}
            onFileBlob={onFileBlob}
            value={values[node.id]}
          />
        ))}
    </>
  );
}

function fileAcceptAttribute(accept: string[] | undefined): string | undefined {
  if (!accept?.length) {
    return 'application/pdf,image/jpeg,image/png';
  }
  return accept.join(',');
}

function filePickerMime(file: File, accept: string[] | undefined): string {
  if (file.type) {
    return file.type;
  }
  if (accept?.includes('application/pdf')) {
    return 'application/pdf';
  }
  return 'application/octet-stream';
}

function FormNode({
  node,
  value,
  onChange,
  onFileBlob,
}: {
  node: FormRenderNode;
  value: FormSubmissionValue | undefined;
  onChange: (fieldId: string, value: FormSubmissionValue | undefined) => void;
  onFileBlob?: (fieldId: string, file: File | null) => void;
}) {
  if (node.widget === 'section') {
    return <SectionHeading title={node.label} />;
  }

  const required = node.required;

  // Native-style choice lists → pill parity with Expo (`DynamicFormFields` native).
  if (node.widget === 'choice-list' || node.widget === 'select') {
    return (
      <FieldRow>
        <FieldLabel required={required}>{node.label}</FieldLabel>
        <HelpText>{node.help_text}</HelpText>
        <ChoiceGrid>
          {(node.options ?? []).map((opt) => (
            <ChoicePill
              key={opt.value}
              label={opt.label}
              selected={String(value ?? '') === opt.value}
              onSelect={() => onChange(node.id, opt.value)}
            />
          ))}
        </ChoiceGrid>
      </FieldRow>
    );
  }

  if (node.widget === 'multi-choice-list') {
    const arr = Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string')
      : [];
    return (
      <FieldRow>
        <FieldLabel required={required}>{node.label}</FieldLabel>
        <HelpText>{node.help_text}</HelpText>
        <ChoiceGrid>
          {(node.options ?? []).map((opt) => {
            const selected = arr.includes(opt.value);
            return (
              <ChoicePill
                key={opt.value}
                label={opt.label}
                selected={selected}
                onSelect={() => {
                  const next = selected ? arr.filter((v) => v !== opt.value) : [...arr, opt.value];
                  onChange(node.id, next.length ? next : undefined);
                }}
              />
            );
          })}
        </ChoiceGrid>
      </FieldRow>
    );
  }

  if (node.widget === 'textarea') {
    return (
      <label className="block">
        <FieldLabel required={required}>{node.label}</FieldLabel>
        <HelpText>{node.help_text}</HelpText>
        <TextAreaField
          onChange={(e) => onChange(node.id, e.target.value)}
          placeholder={node.help_text ?? node.label}
          value={typeof value === 'string' ? value : ''}
        />
      </label>
    );
  }

  if (node.widget === 'number-input') {
    return (
      <label className="block">
        <FieldLabel required={required}>{node.label}</FieldLabel>
        <HelpText>{node.help_text}</HelpText>
        <NumberField
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') {
              onChange(node.id, undefined);
              return;
            }
            const n = Number(v);
            onChange(node.id, Number.isFinite(n) ? n : undefined);
          }}
          value={typeof value === 'number' ? String(value) : ''}
        />
      </label>
    );
  }

  if (node.widget === 'date-input') {
    return (
      <label className="block">
        <FieldLabel required={required}>{node.label}</FieldLabel>
        <HelpText>{node.help_text}</HelpText>
        <DateField
          onChange={(e) => onChange(node.id, e.target.value)}
          value={typeof value === 'string' ? value : ''}
        />
      </label>
    );
  }

  if (node.widget === 'file-picker') {
    const acceptHint = node.accept?.length ? ` (${node.accept.join(', ')})` : '';
    const maxMb = node.max_size_mb ?? 10;
    return (
      <label className="block">
        <FieldLabel required={required}>
          {node.label}
          {acceptHint ? <span className="font-normal text-slate-500">{acceptHint}</span> : null}
        </FieldLabel>
        <HelpText>{node.help_text}</HelpText>
        <input
          type="file"
          accept={fileAcceptAttribute(node.accept)}
          className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-800 hover:file:bg-slate-200"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            onFileBlob?.(node.id, file);
            if (!file) {
              onChange(node.id, undefined);
              return;
            }
            if (file.size > maxMb * 1024 * 1024) {
              onChange(node.id, undefined);
              onFileBlob?.(node.id, null);
              return;
            }
            onChange(node.id, {
              name: file.name,
              mime_type: filePickerMime(file, node.accept),
              size_mb: Math.max(0.01, file.size / (1024 * 1024)),
            });
          }}
        />
        {isFileSubmission(value) ? (
          <p className="mt-2 text-xs font-medium text-emerald-800">
            Selected: {value.name} ({value.size_mb.toFixed(2)} MB)
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-400">Max {maxMb} MB per file.</p>
        )}
      </label>
    );
  }

  return (
    <label className="block">
      <FieldLabel required={required}>{node.label}</FieldLabel>
      <HelpText>{node.help_text}</HelpText>
      <TextField
        onChange={(e) => onChange(node.id, e.target.value)}
        value={typeof value === 'string' ? value : ''}
      />
    </label>
  );
}
