'use client';

import { useMemo } from 'react';

import {
  createRenderPlan,
  type EnagarFormSchema,
  type FormSubmission,
  type FormSubmissionValue,
} from '../index';
import { DynamicFormFields } from '../web/DynamicFormFields';

import { buildPreviewSampleValues, type PreviewSamplePreset } from './preview-sample-values';

const toolbarButtonClass =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-[rgb(var(--brand-rgb))]';

export function FormCitizenPreview({
  schema,
  valid,
  values,
  onChange,
  onValuesChange,
}: {
  schema: EnagarFormSchema | null;
  valid: boolean;
  values: FormSubmission;
  onChange: (fieldId: string, value: FormSubmissionValue | undefined) => void;
  onValuesChange?: (values: FormSubmission) => void;
}): JSX.Element {
  const renderPlan = useMemo(() => {
    if (!schema || !valid) {
      return null;
    }
    return createRenderPlan(schema, { platform: 'web', values });
  }, [schema, valid, values]);

  function applyPreset(preset: PreviewSamplePreset): void {
    if (!schema || !onValuesChange) {
      return;
    }
    onValuesChange(buildPreviewSampleValues(schema, preset));
  }

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Citizen preview</h2>
          <p className="mt-1 text-xs text-slate-500">
            Rendered through <span className="font-mono">@enagar/forms/web</span>. Preview values
            are not saved or sent to citizens.
          </p>
        </div>
      </div>
      {schema && onValuesChange ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={toolbarButtonClass} onClick={() => applyPreset('empty')}>
            Empty
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => applyPreset('first-options')}
          >
            First options
          </button>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => applyPreset('show-if-smoke')}
          >
            Show-if smoke
          </button>
        </div>
      ) : null}
      <div className="mt-5 rounded-[2rem] border-8 border-slate-900 bg-slate-50 p-4 shadow-inner">
        {renderPlan ? (
          <DynamicFormFields nodes={renderPlan.nodes} values={values} onChange={onChange} />
        ) : (
          <p className="text-sm text-slate-500">Fix schema issues to see preview.</p>
        )}
      </div>
    </aside>
  );
}
