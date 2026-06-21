'use client';

import {
  createBlankFormSchemaDraft,
  validateFormSchema,
  type EnagarFormField,
  type EnagarFormSchema,
  type FormFieldType,
  type FormSubmission,
} from '@enagar/forms';
import {
  FIELD_DRAG_MIME,
  CrossFieldRulesPanel,
  FormCitizenPreview,
  FormSchemaBuilder,
  FormSchemaJsonFallback,
  cloneFormSchema,
  fieldPaletteItem,
  nextSequence,
  pretty,
} from '@enagar/forms/builder';
import { FormImportPanel } from '@enagar/forms/form-import-ui';
import { Button, PageHeader } from '@enagar/ui';
import Link from 'next/link';
import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { type StateOAuthBundle } from '../../../../../lib/oauth/session-storage-keys';
import { readApiError, readStoredStateAuth } from '../../../../../lib/state-admin-auth';
import { pickLabel } from '../../../../../lib/state-dashboard-forms';

type GlobalTemplateRow = {
  code: string;
  category_code: string;
  name: unknown;
  lifecycle_status: string;
  library_version: number;
  form_schema: unknown;
  has_usable_form_schema: boolean;
};

function isUsableFormSchema(value: unknown): value is EnagarFormSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Array.isArray(record.fields) && record.fields.length > 0;
}

function resolveInitialSchema(code: string, formSchema: unknown, title: string): EnagarFormSchema {
  if (isUsableFormSchema(formSchema)) {
    return cloneFormSchema(formSchema);
  }
  return createBlankFormSchemaDraft(code, { en: title || code });
}

export function GlobalFormBuilderClient({ code }: { code: string }): JSX.Element {
  const [auth, setAuth] = useState<StateOAuthBundle | null>(null);
  const [template, setTemplate] = useState<GlobalTemplateRow | null>(null);
  const [formText, setFormText] = useState('');
  const [values, setValues] = useState<FormSubmission>({});
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>('Loading global template…');

  useEffect(() => {
    setAuth(readStoredStateAuth());
  }, []);

  const apiBase = useMemo(() => auth?.api_base_url ?? 'http://localhost:3001/api', [auth]);

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      if (!auth) {
        throw new Error('Missing state-admin session');
      }
      const response = await fetch(`${apiBase}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.access_token}`,
          ...(init?.headers ?? {}),
        },
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      return (await response.json()) as T;
    },
    [apiBase, auth],
  );

  const uploadAuthHeaders = useCallback((): HeadersInit => {
    if (!auth) {
      return {};
    }
    return { Authorization: `Bearer ${auth.access_token}` };
  }, [auth]);

  const loadTemplate = useCallback(async (): Promise<void> => {
    if (!auth) {
      setStatus('Sign in required.');
      return;
    }
    try {
      const rows = await api<GlobalTemplateRow[]>('/admin/state/global-service-library');
      const row = rows.find((item) => item.code === code);
      if (!row) {
        setStatus(`Global template "${code}" was not found.`);
        return;
      }
      setTemplate(row);
      setFormText(pretty(resolveInitialSchema(code, row.form_schema, pickLabel(row.name))));
      setValues({});
      setSelectedFieldId(null);
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load global template');
    }
  }, [api, auth, code]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  const parsedForm = useMemo(() => {
    try {
      const schema = JSON.parse(formText) as EnagarFormSchema;
      return { schema, validation: validateFormSchema(schema) };
    } catch {
      return {
        schema: null,
        validation: { ok: false, issues: [{ path: '$', message: 'Invalid JSON' }] },
      };
    }
  }, [formText]);

  const updateFormSchema = useCallback(
    (updater: (schema: EnagarFormSchema) => EnagarFormSchema): void => {
      if (!parsedForm.schema) {
        setStatus('Fix form JSON before using the visual builder.');
        return;
      }
      const next = updater(cloneFormSchema(parsedForm.schema));
      setFormText(pretty({ ...next, service_code: code }));
      const validation = validateFormSchema({ ...next, service_code: code });
      setStatus(
        validation.ok ? 'Visual template updated.' : 'Visual template has validation issues.',
      );
    },
    [code, parsedForm.schema],
  );

  function addField(type: FormFieldType): void {
    const item = fieldPaletteItem(type);
    if (!item) {
      return;
    }
    updateFormSchema((schema) => {
      const field = item.build(nextSequence(schema.fields, type));
      setSelectedFieldId(field.id);
      return { ...schema, fields: [...schema.fields, field] };
    });
  }

  function onPaletteDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const type = event.dataTransfer.getData(FIELD_DRAG_MIME) as FormFieldType;
    if (type) {
      addField(type);
    }
  }

  function updateField(fieldId: string, patch: Partial<EnagarFormField>): void {
    if (typeof patch.id === 'string' && patch.id !== fieldId) {
      setSelectedFieldId(patch.id);
    }
    updateFormSchema((schema) => ({
      ...schema,
      fields: schema.fields.map((field) =>
        field.id === fieldId ? ({ ...field, ...patch } as EnagarFormField) : field,
      ),
    }));
  }

  function reorderField(fieldId: string, direction: -1 | 1): void {
    updateFormSchema((schema) => {
      const index = schema.fields.findIndex((field) => field.id === fieldId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= schema.fields.length) {
        return schema;
      }
      const fields = [...schema.fields];
      const [field] = fields.splice(index, 1);
      if (!field) {
        return schema;
      }
      fields.splice(target, 0, field);
      return { ...schema, fields };
    });
  }

  function removeField(fieldId: string): void {
    updateFormSchema((schema) => ({
      ...schema,
      fields: schema.fields.filter((field) => field.id !== fieldId),
    }));
    setSelectedFieldId(null);
  }

  async function saveFormTemplate(): Promise<void> {
    if (!template || !parsedForm.schema || !parsedForm.validation.ok) {
      setStatus('Form schema must be valid before saving.');
      return;
    }
    try {
      const form_schema = { ...parsedForm.schema, service_code: code };
      await api<GlobalTemplateRow>('/admin/state/global-service-library', {
        method: 'PATCH',
        body: JSON.stringify({
          code: template.code,
          category_code: template.category_code,
          name: template.name,
          form_schema,
        }),
      });
      setStatus('Global form template saved.');
      await loadTemplate();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed');
    }
  }

  if (!auth) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-ink-secondary">Sign in to edit global form templates.</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-platform-accent">
          Go to login
        </Link>
      </main>
    );
  }

  if (!template) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-ink-secondary">{status ?? 'Loading…'}</p>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <PageHeader
        eyebrow="Global service library"
        title={pickLabel(template.name)}
        subtitle={`Template ${template.code} · ${template.lifecycle_status} · v${template.library_version}`}
        actions={
          <Link
            href="/dashboard"
            className="text-sm font-medium text-platform-accent hover:underline"
          >
            Back to dashboard
          </Link>
        }
      />

      {status ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {status}
        </p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <FormImportPanel
            uploadPath={`${apiBase}/admin/state/global-service-library/${code}/form-import`}
            getAuthHeaders={uploadAuthHeaders}
            draftSchema={parsedForm.schema}
            onApply={(schema) => {
              setFormText(pretty({ ...schema, service_code: code }));
              setSelectedFieldId(null);
              setStatus('Imported fields applied to draft. Save form template when ready.');
            }}
            onStatus={setStatus}
          />
          <FormSchemaBuilder
            schema={parsedForm.schema}
            valid={parsedForm.validation.ok}
            selectedFieldId={selectedFieldId}
            onSelectField={setSelectedFieldId}
            onAddField={addField}
            onDropField={onPaletteDrop}
            onUpdateField={updateField}
            onReorderField={reorderField}
            onRemoveField={removeField}
          />

          <CrossFieldRulesPanel
            fields={parsedForm.schema?.fields ?? []}
            rules={parsedForm.schema?.cross_field_rules ?? []}
            onChange={(rules) =>
              updateFormSchema((schema) => ({
                ...schema,
                cross_field_rules: rules.length > 0 ? rules : undefined,
              }))
            }
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void saveFormTemplate()}>
              Save form template
            </Button>
            <p className="text-xs text-ink-secondary">
              Persists <span className="font-mono">form_schema</span> only; other template metadata
              stays unchanged.
            </p>
          </div>

          <FormSchemaJsonFallback
            value={formText}
            onChange={setFormText}
            valid={parsedForm.validation.ok}
            issues={parsedForm.validation.issues}
            onSave={() => void saveFormTemplate()}
            saveLabel="Save form template"
          />
        </div>

        <FormCitizenPreview
          schema={parsedForm.schema}
          valid={parsedForm.validation.ok}
          values={values}
          onChange={(fieldId, value) => setValues((prev) => ({ ...prev, [fieldId]: value }))}
          onValuesChange={setValues}
        />
      </section>
    </div>
  );
}
