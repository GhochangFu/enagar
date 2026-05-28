'use client';

import { FieldValidationInspector } from './FieldValidationInspector';
import { fieldSummary, pickLocaleText } from './form-builder-utils';
import { FIELD_DRAG_MIME, FORM_FIELD_PALETTE } from './form-field-palette';

import type { EnagarFormField, EnagarFormSchema, FormFieldType } from '../index';
import type { DragEvent } from 'react';

export function FormSchemaBuilder({
  schema,
  valid,
  selectedFieldId,
  onSelectField,
  onAddField,
  onDropField,
  onUpdateField,
  onReorderField,
  onRemoveField,
}: {
  schema: EnagarFormSchema | null;
  valid: boolean;
  selectedFieldId: string | null;
  onSelectField: (fieldId: string | null) => void;
  onAddField: (type: FormFieldType) => void;
  onDropField: (event: DragEvent<HTMLDivElement>) => void;
  onUpdateField: (fieldId: string, patch: Partial<EnagarFormField>) => void;
  onReorderField: (fieldId: string, direction: -1 | 1) => void;
  onRemoveField: (fieldId: string) => void;
}): JSX.Element {
  const selectedField = schema?.fields.find((field) => field.id === selectedFieldId) ?? null;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sprint 6.7A · Drag-drop form palette
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Visual form builder</h2>
          <p className="text-xs text-slate-500">
            Adds and edits fields while preserving the same schema JSON saved by Sprint 6.2.
          </p>
        </div>
        <span
          className={
            valid
              ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700'
              : 'rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700'
          }
        >
          {valid ? 'Schema valid' : 'Fix JSON first'}
        </span>
      </div>
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Field palette
          </p>
          <div className="space-y-2">
            {FORM_FIELD_PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                draggable
                onClick={() => onAddField(item.type)}
                onDragStart={(event) => event.dataTransfer.setData(FIELD_DRAG_MIME, item.type)}
                className="block w-full rounded-lg border border-slate-200 bg-white p-3 text-left text-xs hover:border-[rgb(var(--brand-rgb))]"
              >
                <span className="block font-semibold text-slate-900">{item.title}</span>
                <span className="mt-1 block text-slate-500">{item.description}</span>
              </button>
            ))}
          </div>
        </div>
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDropField}
          className="min-h-72 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Draft field order
          </p>
          {schema ? (
            <div className="space-y-2">
              {schema.fields.map((field, index) => (
                <div
                  key={field.id}
                  className={
                    selectedFieldId === field.id
                      ? 'rounded-lg border border-[rgb(var(--brand-rgb))] bg-white p-3 shadow-sm'
                      : 'rounded-lg border border-slate-200 bg-white p-3'
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSelectField(field.id)}
                    className="block w-full text-left"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {index + 1}. {field.type}
                    </span>
                    <span className="mt-1 block font-medium text-slate-900">
                      {pickLocaleText(field.label)}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{fieldSummary(field)}</span>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onReorderField(field.id, -1)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => onReorderField(field.id, 1)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveField(field.id)}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Fix form JSON before using the visual builder.</p>
          )}
        </div>
        <FieldValidationInspector
          field={selectedField}
          allFields={schema?.fields ?? []}
          onUpdateField={onUpdateField}
        />
      </div>
    </article>
  );
}
