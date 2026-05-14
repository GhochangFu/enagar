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
};

function isFileSubmission(value: FormSubmissionValue | undefined): value is FileSubmission {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'name' in value);
}

/**
 * Renders `@enagar/forms` **`createRenderPlan`** nodes on the web (`platform: 'web'`).
 * Uses **`@enagar/ui`** primitives so Tailwind + tenant **`--brand-rgb`** stay consistent across surfaces.
 */
export function DynamicFormFields({ nodes, values, onChange }: Props) {
  return (
    <>
      {nodes
        .filter((node) => node.visible)
        .map((node) => (
          <FormNode key={node.id} node={node} onChange={onChange} value={values[node.id]} />
        ))}
    </>
  );
}

function FormNode({
  node,
  value,
  onChange,
}: {
  node: FormRenderNode;
  value: FormSubmissionValue | undefined;
  onChange: (fieldId: string, value: FormSubmissionValue | undefined) => void;
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
    return (
      <label className="block">
        <FieldLabel required={required}>
          {node.label}
          {acceptHint ? <span className="font-normal text-slate-500">{acceptHint}</span> : null}
        </FieldLabel>
        <HelpText>{node.help_text}</HelpText>
        <TextField
          placeholder="filename.pdf"
          onChange={(e) =>
            onChange(node.id, {
              name: e.target.value.trim() ? e.target.value.trim() : `${node.id}.pdf`,
              mime_type: 'application/pdf',
              size_mb: 1,
            })
          }
          value={isFileSubmission(value) ? value.name : ''}
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Simulated file metadata — matches API document simulation.
        </p>
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
