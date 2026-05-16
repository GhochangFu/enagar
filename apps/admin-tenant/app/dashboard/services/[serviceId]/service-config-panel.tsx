'use client';

type ServiceConfigResponse = {
  fee_rule: unknown;
  fee_preview_paise: number | null;
  required_documents: unknown;
  revenue_head: { code: string; accounting_code: string } | null;
};

type RevenueHeadRow = {
  code: string;
  name: unknown;
  accounting_code: string;
  is_active: boolean;
};

type FeeRuleDraft =
  | { type: 'free'; currency?: 'INR' }
  | { type: 'fixed'; amount_paise: number; currency?: 'INR' }
  | { type: 'slab'; input_key: string; slabs: Array<{ upto: number | null; amount_paise: number }> }
  | {
      type: 'computed';
      input_key: string;
      base_amount_paise: number;
      unit_amount_paise: number;
    }
  | { type: 'external'; provider: string; currency?: 'INR' };

type DocumentDraft = {
  code: string;
  label: { en: string; bn: string; hi: string };
  required: boolean;
  accept: string[];
  max_size_mb: number;
};

type ParsedValue = { value: unknown; valid: boolean };

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function rupeesToPaise(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function paiseToRupees(value: unknown): string {
  return typeof value === 'number' ? (value / 100).toFixed(2) : '0.00';
}

function coerceFeeRule(value: unknown): FeeRuleDraft {
  if (value && typeof value === 'object' && 'type' in value) {
    return value as FeeRuleDraft;
  }
  return { type: 'free', currency: 'INR' };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function titleFromCode(code: string): string {
  return code
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function coerceLabel(value: unknown, fallback: string): DocumentDraft['label'] {
  if (typeof value === 'string' && value.trim()) {
    return { en: value, bn: value, hi: value };
  }
  if (isRecord(value)) {
    const en = typeof value.en === 'string' && value.en.trim() ? value.en : fallback;
    const bn = typeof value.bn === 'string' && value.bn.trim() ? value.bn : en;
    const hi = typeof value.hi === 'string' && value.hi.trim() ? value.hi : en;
    return { en, bn, hi };
  }
  return { en: fallback, bn: fallback, hi: fallback };
}

function coerceDocument(value: unknown, index: number): DocumentDraft {
  if (typeof value === 'string') {
    const code = value.trim() || `document-${index + 1}`;
    const label = titleFromCode(code);
    return {
      code,
      label: { en: label, bn: label, hi: label },
      required: true,
      accept: ['application/pdf', 'image/jpeg'],
      max_size_mb: 5,
    };
  }

  if (isRecord(value)) {
    const code =
      typeof value.code === 'string' && value.code.trim() ? value.code : `document-${index + 1}`;
    const label = coerceLabel(value.label, titleFromCode(code));
    const accept = Array.isArray(value.accept)
      ? value.accept.filter((item): item is string => typeof item === 'string' && Boolean(item))
      : ['application/pdf', 'image/jpeg'];
    const maxSize = Number(value.max_size_mb);
    return {
      code,
      label,
      required: typeof value.required === 'boolean' ? value.required : true,
      accept: accept.length > 0 ? accept : ['application/pdf', 'image/jpeg'],
      max_size_mb: Number.isFinite(maxSize) && maxSize > 0 ? maxSize : 5,
    };
  }

  return blankDocument(index + 1);
}

function coerceDocuments(value: unknown): DocumentDraft[] {
  return Array.isArray(value) ? value.map(coerceDocument) : [];
}

function blankDocument(index: number): DocumentDraft {
  return {
    code: `supporting-document-${index}`,
    label: {
      en: `Supporting document ${index}`,
      bn: `Supporting document ${index}`,
      hi: `Supporting document ${index}`,
    },
    required: true,
    accept: ['application/pdf', 'image/jpeg'],
    max_size_mb: 5,
  };
}

export function ServiceConfigPanel({
  serviceConfig,
  revenueHeads,
  feeText,
  documentsText,
  revenueHeadCode,
  parsedFee,
  parsedDocuments,
  onFeeTextChange,
  onDocumentsTextChange,
  onRevenueHeadCodeChange,
  onSave,
}: {
  serviceConfig: ServiceConfigResponse;
  revenueHeads: RevenueHeadRow[];
  feeText: string;
  documentsText: string;
  revenueHeadCode: string;
  parsedFee: ParsedValue;
  parsedDocuments: ParsedValue;
  onFeeTextChange: (value: string) => void;
  onDocumentsTextChange: (value: string) => void;
  onRevenueHeadCodeChange: (value: string) => void;
  onSave: () => void;
}): JSX.Element {
  const feeRule = coerceFeeRule(parsedFee.value);
  const documents = coerceDocuments(parsedDocuments.value);

  function setFeeRule(next: FeeRuleDraft): void {
    onFeeTextChange(pretty(next));
  }

  function setDocuments(next: DocumentDraft[]): void {
    onDocumentsTextChange(pretty(next));
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sprint 6.8B/C · Guided config UX
          </p>
          <h2 className="text-lg font-semibold text-slate-900">
            Fee, documents, and revenue mapping
          </h2>
          <p className="text-xs text-slate-500">
            Preview fee:{' '}
            {serviceConfig.fee_preview_paise === null
              ? 'external/invalid'
              : `₹${(serviceConfig.fee_preview_paise / 100).toFixed(2)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
        >
          Save config
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Fee rule guided editor</h3>
          <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Rule type
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
              value={feeRule.type}
              onChange={(event) => {
                const type = event.target.value;
                if (type === 'fixed') {
                  setFeeRule({ type, amount_paise: 1000, currency: 'INR' });
                } else if (type === 'slab') {
                  setFeeRule({
                    type,
                    input_key: 'amount',
                    slabs: [
                      { upto: 100, amount_paise: 1000 },
                      { upto: null, amount_paise: 2500 },
                    ],
                  });
                } else if (type === 'computed') {
                  setFeeRule({
                    type,
                    input_key: 'quantity',
                    base_amount_paise: 0,
                    unit_amount_paise: 1000,
                  });
                } else if (type === 'external') {
                  setFeeRule({ type, provider: 'external-ledger', currency: 'INR' });
                } else {
                  setFeeRule({ type: 'free', currency: 'INR' });
                }
              }}
            >
              <option value="free">Free</option>
              <option value="fixed">Fixed</option>
              <option value="slab">Slab</option>
              <option value="computed">Computed</option>
              <option value="external">External</option>
            </select>
          </label>
          <FeeRuleFields feeRule={feeRule} onChange={setFeeRule} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Document checklist</h3>
            <button
              type="button"
              onClick={() => setDocuments([...documents, blankDocument(documents.length + 1)])}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
            >
              Add document
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {documents.map((document, index) => (
              <DocumentRow
                key={`${document.code}-${index}`}
                document={document}
                onChange={(next) =>
                  setDocuments(
                    documents.map((item, itemIndex) => (itemIndex === index ? next : item)),
                  )
                }
                onRemove={() =>
                  setDocuments(documents.filter((_, itemIndex) => itemIndex !== index))
                }
              />
            ))}
          </div>
        </section>
      </div>

      <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        Revenue head
        <select
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal text-slate-900"
          value={revenueHeadCode}
          onChange={(event) => onRevenueHeadCodeChange(event.target.value)}
        >
          <option value="">No revenue head</option>
          {revenueHeads.map((head) => (
            <option key={head.code} value={head.code}>
              {head.code} · {head.accounting_code}
            </option>
          ))}
        </select>
      </label>

      <details className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          JSON fallback
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <JsonFallback
            title="Fee rule JSON"
            value={feeText}
            onChange={onFeeTextChange}
            valid={parsedFee.valid}
          />
          <JsonFallback
            title="Document checklist JSON"
            value={documentsText}
            onChange={onDocumentsTextChange}
            valid={parsedDocuments.valid}
          />
        </div>
      </details>
    </article>
  );
}

function FeeRuleFields({
  feeRule,
  onChange,
}: {
  feeRule: FeeRuleDraft;
  onChange: (feeRule: FeeRuleDraft) => void;
}): JSX.Element {
  if (feeRule.type === 'fixed') {
    return (
      <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-slate-500">
        Amount (₹)
        <input
          type="number"
          min={0}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
          value={paiseToRupees(feeRule.amount_paise)}
          onChange={(event) =>
            onChange({ ...feeRule, amount_paise: rupeesToPaise(event.target.value) })
          }
        />
      </label>
    );
  }
  if (feeRule.type === 'computed') {
    return (
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <TextInput
          label="Input key"
          value={feeRule.input_key}
          onChange={(input_key) => onChange({ ...feeRule, input_key })}
        />
        <TextInput
          label="Base ₹"
          value={paiseToRupees(feeRule.base_amount_paise)}
          onChange={(value) => onChange({ ...feeRule, base_amount_paise: rupeesToPaise(value) })}
        />
        <TextInput
          label="Per unit ₹"
          value={paiseToRupees(feeRule.unit_amount_paise)}
          onChange={(value) => onChange({ ...feeRule, unit_amount_paise: rupeesToPaise(value) })}
        />
      </div>
    );
  }
  if (feeRule.type === 'slab') {
    return (
      <div className="mt-3 space-y-3">
        <TextInput
          label="Input key"
          value={feeRule.input_key}
          onChange={(input_key) => onChange({ ...feeRule, input_key })}
        />
        {feeRule.slabs.map((slab, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <TextInput
              label="Up to (blank = open)"
              value={slab.upto === null ? '' : String(slab.upto)}
              onChange={(value) =>
                onChange({
                  ...feeRule,
                  slabs: feeRule.slabs.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, upto: value === '' ? null : Number(value) }
                      : item,
                  ),
                })
              }
            />
            <TextInput
              label="Amount ₹"
              value={paiseToRupees(slab.amount_paise)}
              onChange={(value) =>
                onChange({
                  ...feeRule,
                  slabs: feeRule.slabs.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, amount_paise: rupeesToPaise(value) } : item,
                  ),
                })
              }
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...feeRule,
                  slabs: feeRule.slabs.filter((_, itemIndex) => itemIndex !== index),
                })
              }
              className="self-end rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({ ...feeRule, slabs: [...feeRule.slabs, { upto: null, amount_paise: 0 }] })
          }
          className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
        >
          Add slab
        </button>
      </div>
    );
  }
  if (feeRule.type === 'external') {
    return (
      <TextInput
        label="Provider"
        value={feeRule.provider}
        onChange={(provider) => onChange({ ...feeRule, provider })}
      />
    );
  }
  return <p className="mt-3 text-sm text-slate-600">No fee is charged for this service.</p>;
}

function DocumentRow({
  document,
  onChange,
  onRemove,
}: {
  document: DocumentDraft;
  onChange: (document: DocumentDraft) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput
          label="Code"
          value={document.code}
          onChange={(code) => onChange({ ...document, code })}
        />
        <TextInput
          label="Label EN"
          value={document.label.en}
          onChange={(en) =>
            onChange({ ...document, label: { ...document.label, en, bn: en, hi: en } })
          }
        />
        <TextInput
          label="Accepted MIME types"
          value={document.accept.join(', ')}
          onChange={(accept) =>
            onChange({
              ...document,
              accept: accept
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
        />
        <TextInput
          label="Max size MB"
          value={String(document.max_size_mb)}
          onChange={(max_size_mb) => onChange({ ...document, max_size_mb: Number(max_size_mb) })}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={document.required}
            onChange={(event) => onChange({ ...document, required: event.target.checked })}
          />
          Required
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-700"
        >
          Remove document
        </button>
      </div>
    </div>
  );
}

function JsonFallback({
  title,
  value,
  onChange,
  valid,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
}): JSX.Element {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <textarea
        className="h-64 w-full rounded-lg border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-slate-50"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className={valid ? 'mt-2 text-xs text-emerald-700' : 'mt-2 text-xs text-red-700'}>
        {valid ? 'Valid JSON.' : 'Invalid JSON.'}
      </p>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
      {label}
      <input
        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
