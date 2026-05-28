'use client';

import { isChoiceField, isMultiselectField, localeMap, slugify } from './form-builder-utils';
import {
  TEXT_PATTERN_PRESETS,
  buildShowIfRule,
  parseOptionalInt,
  parseOptionalNumber,
  showIfConditionKind,
  type ShowIfConditionKind,
} from './validation-presets';

import type { EnagarFormField, ShowIfRule } from '../index';

const inputClass = 'mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs';
const labelClass = 'block text-xs font-medium text-slate-600';
const sectionClass = 'mt-4 border-t border-slate-200 pt-3';

function patternPresetValue(pattern: string | undefined): string {
  if (!pattern) {
    return '';
  }
  const preset = TEXT_PATTERN_PRESETS.find((item) => item.value === pattern);
  return preset ? preset.value : '__custom__';
}

function ShowIfEditor({
  field,
  allFields,
  onUpdateField,
}: {
  field: EnagarFormField;
  allFields: EnagarFormField[];
  onUpdateField: (fieldId: string, patch: Partial<EnagarFormField>) => void;
}): JSX.Element {
  const controllingFields = allFields.filter(
    (candidate) => candidate.id !== field.id && candidate.type !== 'section',
  );
  const enabled = field.show_if !== undefined;
  const kind = showIfConditionKind(field.show_if) ?? 'equals';
  const controllingFieldId = field.show_if?.field ?? controllingFields[0]?.id ?? '';
  const controllingField = allFields.find((candidate) => candidate.id === controllingFieldId);
  const controllingIsMultiselect = isMultiselectField(controllingField);
  const equalsValue =
    field.show_if?.equals !== undefined
      ? String(field.show_if.equals)
      : (field.show_if?.includes ?? '');
  const equalsAnyValues = field.show_if?.equals_any ?? [];

  function setShowIf(next: ShowIfRule | undefined): void {
    onUpdateField(field.id, { show_if: next } as Partial<EnagarFormField>);
  }

  function resolveConditionKind(
    condition: ShowIfConditionKind,
    nextControllingField: EnagarFormField | undefined,
  ): ShowIfConditionKind {
    if (condition === 'includes' && !isMultiselectField(nextControllingField)) {
      return 'equals';
    }
    return condition;
  }

  function patchShowIf(
    controllingField: string,
    condition: ShowIfConditionKind,
    value: string,
    nextEqualsAnyValues?: Array<string | number | boolean>,
  ): void {
    if (!controllingField) {
      return;
    }
    const nextField = allFields.find((candidate) => candidate.id === controllingField);
    const resolvedCondition = resolveConditionKind(condition, nextField);
    setShowIf(
      buildShowIfRule(
        controllingField,
        resolvedCondition,
        value,
        resolvedCondition === 'equals_any' ? nextEqualsAnyValues : undefined,
      ),
    );
  }

  function toggleEqualsAnyOption(optionValue: string): void {
    const nextValues = equalsAnyValues.includes(optionValue)
      ? equalsAnyValues.filter((entry) => entry !== optionValue)
      : [...equalsAnyValues, optionValue];
    patchShowIf(controllingFieldId, 'equals_any', '', nextValues);
  }

  const conditionHelp =
    kind === 'not_empty'
      ? 'Show this field when the controlling field has any answer.'
      : kind === 'equals_any'
        ? 'Show when the controlling field equals any one of the selected values (OR).'
        : kind === 'includes'
          ? 'Pick one option. The controlling field must be multi-select and the citizen must select that option.'
          : controllingIsMultiselect
            ? 'For multi-select fields, prefer Includes option. Equals matches the whole selection string.'
            : 'Show when the controlling field equals one value. Use this for Trade Licence trade type → food.';
  const effectiveKind = kind === 'includes' && !controllingIsMultiselect ? 'equals' : kind;

  return (
    <div className={sectionClass}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Conditional visibility
      </p>
      <label className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => {
            if (!event.target.checked) {
              setShowIf(undefined);
              return;
            }
            const first = controllingFields[0];
            if (!first) {
              return;
            }
            setShowIf(buildShowIfRule(first.id, 'equals', ''));
          }}
        />
        Show only when another field matches
      </label>
      {enabled ? (
        <div className="mt-3 grid gap-2">
          <label className={labelClass}>
            Controlling field
            <select
              className={inputClass}
              value={controllingFieldId}
              onChange={(event) => {
                const nextField = allFields.find(
                  (candidate) => candidate.id === event.target.value,
                );
                patchShowIf(
                  event.target.value,
                  resolveConditionKind(kind, nextField),
                  equalsValue,
                  kind === 'equals_any' ? equalsAnyValues : undefined,
                );
              }}
            >
              {controllingFields.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.id}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Condition
            <select
              className={inputClass}
              value={effectiveKind}
              onChange={(event) => {
                const nextKind = event.target.value as ShowIfConditionKind;
                if (nextKind === 'equals_any') {
                  const seed =
                    controllingField && isChoiceField(controllingField)
                      ? [controllingField.options[0]?.value ?? ''].filter(Boolean)
                      : equalsValue
                        ? [equalsValue]
                        : [''];
                  patchShowIf(controllingFieldId, nextKind, '', seed);
                  return;
                }
                patchShowIf(controllingFieldId, nextKind, equalsValue);
              }}
            >
              <option value="equals">Equals one value</option>
              <option value="equals_any">Equals any of (OR)</option>
              {controllingIsMultiselect ? (
                <option value="includes">Includes one option (multi-select only)</option>
              ) : null}
              <option value="not_empty">Is not empty</option>
            </select>
          </label>
          <p className="text-xs text-slate-500">{conditionHelp}</p>
          {kind === 'includes' && !controllingIsMultiselect ? (
            <p className="text-xs text-amber-800">
              Includes only works when the controlling field type is multi-select. Switch to Equals
              for select, radio, or text fields such as Trade Licence trade type.
            </p>
          ) : null}
          {kind === 'equals_any' ? (
            controllingField && isChoiceField(controllingField) ? (
              <fieldset className={labelClass}>
                <legend className="text-xs font-medium text-slate-600">Values (any match)</legend>
                <div className="mt-2 space-y-1">
                  {controllingField.options.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 text-xs text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={equalsAnyValues.includes(option.value)}
                        onChange={() => toggleEqualsAnyOption(option.value)}
                      />
                      {option.label.en} ({option.value})
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <label className={labelClass}>
                Values (comma-separated)
                <input
                  className={inputClass}
                  value={equalsAnyValues.map(String).join(', ')}
                  placeholder="food, retail"
                  onChange={(event) =>
                    patchShowIf(controllingFieldId, 'equals_any', event.target.value)
                  }
                />
              </label>
            )
          ) : null}
          {kind !== 'not_empty' && kind !== 'equals_any' ? (
            controllingField && isChoiceField(controllingField) ? (
              <label className={labelClass}>
                Value
                <select
                  className={inputClass}
                  value={equalsValue}
                  onChange={(event) => patchShowIf(controllingFieldId, kind, event.target.value)}
                >
                  <option value="">Select value</option>
                  {controllingField.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label.en} ({option.value})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className={labelClass}>
                Value
                <input
                  className={inputClass}
                  value={equalsValue}
                  onChange={(event) => patchShowIf(controllingFieldId, kind, event.target.value)}
                />
              </label>
            )
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Field is always visible in the apply form.</p>
      )}
    </div>
  );
}

export function FieldValidationInspector({
  field,
  allFields,
  onUpdateField,
}: {
  field: EnagarFormField | null;
  allFields: EnagarFormField[];
  onUpdateField: (fieldId: string, patch: Partial<EnagarFormField>) => void;
}): JSX.Element {
  if (!field) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
        Select a field to edit labels, validation rules, conditional visibility, and options.
      </div>
    );
  }

  const patternPreset = patternPresetValue(
    field.type === 'text' || field.type === 'textarea' ? field.pattern : undefined,
  );

  return (
    <div className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Field validation inspector
      </p>
      <label className={labelClass}>
        Field ID
        <input
          className={`${inputClass} font-mono`}
          value={field.id}
          onChange={(event) => onUpdateField(field.id, { id: event.target.value })}
        />
      </label>
      <div className="mt-3 grid gap-2">
        {(['en', 'bn', 'hi'] as const).map((locale) => (
          <label key={locale} className={labelClass}>
            Label {locale.toUpperCase()}
            <input
              className={inputClass}
              value={field.label[locale]}
              onChange={(event) =>
                onUpdateField(field.id, {
                  label: { ...field.label, [locale]: event.target.value },
                } as Partial<EnagarFormField>)
              }
            />
          </label>
        ))}
      </div>
      {field.type !== 'section' ? (
        <>
          <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={field.required === true}
              onChange={(event) => onUpdateField(field.id, { required: event.target.checked })}
            />
            Required
          </label>
          {'help_text' in field ? (
            <label className="mt-3 block text-xs font-medium text-slate-600">
              Help text EN
              <input
                className={inputClass}
                value={field.help_text?.en ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, { help_text: localeMap(event.target.value) })
                }
              />
            </label>
          ) : null}
          <ShowIfEditor field={field} allFields={allFields} onUpdateField={onUpdateField} />
        </>
      ) : null}
      {field.type === 'text' || field.type === 'textarea' ? (
        <div className={sectionClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Text validation
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className={labelClass}>
              Min length
              <input
                type="number"
                min={0}
                className={inputClass}
                value={field.min_length ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    min_length: parseOptionalInt(event.target.value),
                  } as Partial<EnagarFormField>)
                }
              />
            </label>
            <label className={labelClass}>
              Max length
              <input
                type="number"
                min={1}
                className={inputClass}
                value={field.max_length ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    max_length: parseOptionalInt(event.target.value),
                  } as Partial<EnagarFormField>)
                }
              />
            </label>
          </div>
          <label className="mt-2 block text-xs font-medium text-slate-600">
            Pattern preset
            <select
              className={inputClass}
              value={patternPreset}
              onChange={(event) => {
                const next = event.target.value;
                if (next === '__custom__') {
                  return;
                }
                onUpdateField(field.id, {
                  pattern: next || undefined,
                } as Partial<EnagarFormField>);
              }}
            >
              {TEXT_PATTERN_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              <option value="__custom__">Custom regex</option>
            </select>
          </label>
          <label className="mt-2 block text-xs font-medium text-slate-600">
            Pattern (regex)
            <input
              className={`${inputClass} font-mono`}
              value={field.pattern ?? ''}
              placeholder="^[6-9][0-9]{9}$"
              onChange={(event) =>
                onUpdateField(field.id, {
                  pattern: event.target.value.trim() || undefined,
                } as Partial<EnagarFormField>)
              }
            />
          </label>
        </div>
      ) : null}
      {field.type === 'number' ? (
        <div className={sectionClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Number validation
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className={labelClass}>
              Min
              <input
                type="number"
                className={inputClass}
                value={field.min ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    min: parseOptionalNumber(event.target.value),
                  } as Partial<EnagarFormField>)
                }
              />
            </label>
            <label className={labelClass}>
              Max
              <input
                type="number"
                className={inputClass}
                value={field.max ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    max: parseOptionalNumber(event.target.value),
                  } as Partial<EnagarFormField>)
                }
              />
            </label>
          </div>
        </div>
      ) : null}
      {field.type === 'date' ? (
        <div className={sectionClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Date validation
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Min and max dates are enforced on citizen submit and in JSON-Schema export.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className={labelClass}>
              Min date
              <input
                type="date"
                className={inputClass}
                value={field.min_date ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    min_date: event.target.value || undefined,
                  } as Partial<EnagarFormField>)
                }
              />
            </label>
            <label className={labelClass}>
              Max date
              <input
                type="date"
                className={inputClass}
                value={field.max_date ?? ''}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    max_date: event.target.value || undefined,
                  } as Partial<EnagarFormField>)
                }
              />
            </label>
          </div>
        </div>
      ) : null}
      {isChoiceField(field) ? (
        <div className={sectionClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Choice options
          </p>
          <label className="mt-2 block text-xs font-medium text-slate-600">
            Options (one `value=Label` per line)
            <textarea
              className="mt-1 h-28 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
              value={field.options.map((option) => `${option.value}=${option.label.en}`).join('\n')}
              onChange={(event) =>
                onUpdateField(field.id, {
                  options: event.target.value
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const parts = line.split('=');
                      const value = parts[0] ?? 'option';
                      const optionLabel = parts[1] ?? value;
                      return {
                        value: slugify(value, 'option'),
                        label: localeMap(optionLabel.trim()),
                      };
                    }),
                } as Partial<EnagarFormField>)
              }
            />
          </label>
        </div>
      ) : null}
      {field.type === 'file' ? (
        <div className={sectionClass}>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            File validation
          </p>
          <div className="mt-2 grid gap-2">
            <label className={labelClass}>
              Accepted MIME types
              <input
                className={inputClass}
                value={field.accept.join(', ')}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    accept: event.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  } as Partial<EnagarFormField>)
                }
              />
            </label>
            <label className={labelClass}>
              Max size MB
              <input
                type="number"
                min={1}
                max={10}
                className={inputClass}
                value={field.max_size_mb}
                onChange={(event) =>
                  onUpdateField(field.id, {
                    max_size_mb: Number(event.target.value),
                  } as Partial<EnagarFormField>)
                }
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
