'use client';

import {
  CROSS_FIELD_COMPARE_OPS,
  describeCrossFieldRule,
  nextCrossFieldRuleId,
} from './cross-field-rules-utils';
import { localeMap } from './form-builder-utils';
import {
  buildShowIfRule,
  showIfConditionKind,
  type ShowIfConditionKind,
} from './validation-presets';

import type { CrossFieldRule, EnagarFormField, ShowIfRule } from '../index';

const inputClass = 'mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs';
const labelClass = 'block text-xs font-medium text-slate-600';

function compareFields(fields: EnagarFormField[]): EnagarFormField[] {
  return fields.filter((field) => field.type !== 'section');
}

export function CrossFieldRulesPanel({
  fields,
  rules,
  onChange,
}: {
  fields: EnagarFormField[];
  rules: CrossFieldRule[];
  onChange: (rules: CrossFieldRule[]) => void;
}): JSX.Element {
  const candidates = compareFields(fields);

  function updateRule(index: number, patch: Partial<CrossFieldRule>): void {
    onChange(rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)));
  }

  function removeRule(index: number): void {
    onChange(rules.filter((_, ruleIndex) => ruleIndex !== index));
  }

  function addRule(): void {
    const left = candidates[0]?.id ?? 'field_a';
    const right = candidates[1]?.id ?? candidates[0]?.id ?? 'field_b';
    onChange([
      ...rules,
      {
        id: nextCrossFieldRuleId(rules),
        left,
        op: 'gt_field',
        right: left === right ? (candidates[1]?.id ?? left) : right,
      },
    ]);
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            EN-5 · Cross-field rules
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Compare fields on submit</h2>
          <p className="text-xs text-slate-500">
            Use for end date after start date, guest count vs capacity, and similar checks.
          </p>
        </div>
        <button
          type="button"
          onClick={addRule}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
        >
          Add rule
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-slate-500">No cross-field rules yet.</p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <div key={rule.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <label className={labelClass}>
                  Rule ID
                  <input
                    className={`${inputClass} font-mono`}
                    value={rule.id}
                    onChange={(event) => updateRule(index, { id: event.target.value })}
                  />
                </label>
                <label className={labelClass}>
                  Compare
                  <select
                    className={inputClass}
                    value={rule.op}
                    onChange={(event) =>
                      updateRule(index, { op: event.target.value as CrossFieldRule['op'] })
                    }
                  >
                    {CROSS_FIELD_COMPARE_OPS.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Left field
                  <select
                    className={inputClass}
                    value={rule.left}
                    onChange={(event) => updateRule(index, { left: event.target.value })}
                  >
                    {candidates.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Right field
                  <select
                    className={inputClass}
                    value={rule.right}
                    onChange={(event) => updateRule(index, { right: event.target.value })}
                  >
                    {candidates.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={`${labelClass} md:col-span-2`}>
                  Error message EN
                  <input
                    className={inputClass}
                    value={rule.message?.en ?? ''}
                    placeholder={describeCrossFieldRule(rule)}
                    onChange={(event) =>
                      updateRule(index, {
                        message: event.target.value.trim()
                          ? localeMap(event.target.value)
                          : undefined,
                      })
                    }
                  />
                </label>
              </div>
              <WhenGateEditor
                fields={fields}
                when={rule.when}
                onChange={(when) => updateRule(index, { when })}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">{describeCrossFieldRule(rule)}</p>
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function WhenGateEditor({
  fields,
  when,
  onChange,
}: {
  fields: EnagarFormField[];
  when: ShowIfRule | undefined;
  onChange: (when: ShowIfRule | undefined) => void;
}): JSX.Element {
  const enabled = when !== undefined;
  const controllingFields = compareFields(fields);
  const kind = showIfConditionKind(when) ?? 'equals';
  const controllingFieldId = when?.field ?? controllingFields[0]?.id ?? '';
  const equalsValue = when?.equals !== undefined ? String(when.equals) : (when?.includes ?? '');

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            if (!event.target.checked) {
              onChange(undefined);
              return;
            }
            const first = controllingFields[0];
            if (!first) {
              return;
            }
            onChange(buildShowIfRule(first.id, 'equals', ''));
          }}
        />
        Only when another field matches
      </label>
      {enabled ? (
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <label className={labelClass}>
            Field
            <select
              className={inputClass}
              value={controllingFieldId}
              onChange={(event) => onChange(buildShowIfRule(event.target.value, kind, equalsValue))}
            >
              {controllingFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.id}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Condition
            <select
              className={inputClass}
              value={kind}
              onChange={(event) =>
                onChange(
                  buildShowIfRule(
                    controllingFieldId,
                    event.target.value as ShowIfConditionKind,
                    equalsValue,
                  ),
                )
              }
            >
              <option value="equals">Equals</option>
              <option value="not_empty">Is not empty</option>
            </select>
          </label>
          {kind !== 'not_empty' ? (
            <label className={labelClass}>
              Value
              <input
                className={inputClass}
                value={equalsValue}
                onChange={(event) =>
                  onChange(buildShowIfRule(controllingFieldId, kind, event.target.value))
                }
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
