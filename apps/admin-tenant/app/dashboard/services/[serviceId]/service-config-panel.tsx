'use client';

type BocPolicy = 'never' | 'always' | 'officer_may_require';

type MunicipalSignoffPolicy = 'never' | 'high_value_only' | 'always';

type PaymentSchedule = 'upfront_only' | 'deferred_only' | 'upfront_and_deferred';

type FeeLineCode = 'application' | 'approval';

type ServiceConfigResponse = {
  fee_rule: unknown;
  fee_preview_paise: number | null;
  payment_schedule: PaymentSchedule;
  fee_lines: unknown;
  fee_line_previews: Partial<Record<FeeLineCode, number | null>>;
  payment_schedule_inferred?: boolean;
  required_documents: unknown;
  boc_policy: BocPolicy;
  municipal_signoff_policy: MunicipalSignoffPolicy;
  municipal_signoff_threshold_paise: number;
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

export type FeeLineDraft = {
  label: { en: string; bn: string; hi: string };
  rule: FeeRuleDraft;
};

export type FeeLinesDraft = Partial<Record<FeeLineCode, FeeLineDraft>>;

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

function coerceSlab(value: unknown): { upto: number | null; amount_paise: number } | null {
  if (!isRecord(value)) {
    return null;
  }
  const upto = value.upto === null ? null : Number(value.upto);
  const amount_paise = Number(value.amount_paise);
  if (upto !== null && (!Number.isFinite(upto) || upto <= 0)) {
    return null;
  }
  if (!Number.isFinite(amount_paise) || amount_paise < 0) {
    return null;
  }
  return { upto, amount_paise };
}

const DEFAULT_FEE_SLABS: Array<{ upto: number | null; amount_paise: number }> = [
  { upto: 100, amount_paise: 1000 },
  { upto: null, amount_paise: 2500 },
];

function coerceFeeRule(value: unknown): FeeRuleDraft {
  if (!isRecord(value) || !('type' in value)) {
    return { type: 'free', currency: 'INR' };
  }

  const type = String(value.type);
  if (type === 'fixed') {
    return {
      type: 'fixed',
      amount_paise: typeof value.amount_paise === 'number' ? value.amount_paise : 0,
      ...(value.currency === 'INR' ? { currency: 'INR' } : {}),
    };
  }
  if (type === 'slab') {
    const slabs = Array.isArray(value.slabs)
      ? value.slabs
          .map(coerceSlab)
          .filter((slab): slab is NonNullable<typeof slab> => slab !== null)
      : [];
    const slabSet = typeof value.slab_set === 'string' ? value.slab_set : '';
    const input_key =
      typeof value.input_key === 'string' && value.input_key.trim()
        ? value.input_key
        : slabSet.includes('trade')
          ? 'trade_type'
          : 'amount';
    return {
      type: 'slab',
      input_key,
      slabs: slabs.length > 0 ? slabs : DEFAULT_FEE_SLABS,
      ...(value.currency === 'INR' ? { currency: 'INR' } : {}),
    };
  }
  if (type === 'computed') {
    return {
      type: 'computed',
      input_key:
        typeof value.input_key === 'string' && value.input_key.trim()
          ? value.input_key
          : 'quantity',
      base_amount_paise: typeof value.base_amount_paise === 'number' ? value.base_amount_paise : 0,
      unit_amount_paise: typeof value.unit_amount_paise === 'number' ? value.unit_amount_paise : 0,
      ...(value.currency === 'INR' ? { currency: 'INR' } : {}),
    };
  }
  if (type === 'external') {
    return {
      type: 'external',
      provider:
        typeof value.provider === 'string' && value.provider.trim()
          ? value.provider
          : 'external-ledger',
      ...(value.currency === 'INR' ? { currency: 'INR' } : {}),
    };
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

export function coerceDocuments(value: unknown): DocumentDraft[] {
  return Array.isArray(value) ? value.map(coerceDocument) : [];
}

function blankFeeLine(code: FeeLineCode): FeeLineDraft {
  const label =
    code === 'application'
      ? { en: 'Application fee', bn: 'আবেদন ফি', hi: 'आवेदन शुल्क' }
      : { en: 'Licence fee', bn: 'লাইসেন্স ফি', hi: 'लाइसेंस शुल्क' };
  return { label, rule: { type: 'fixed', amount_paise: 1000, currency: 'INR' } };
}

function coerceFeeLine(value: unknown, code: FeeLineCode): FeeLineDraft {
  if (!isRecord(value)) {
    return blankFeeLine(code);
  }
  const label = coerceLabel(
    value.label,
    code === 'application' ? 'Application fee' : 'Licence fee',
  );
  return {
    label,
    rule: coerceFeeRule(value.rule),
  };
}

function coerceFeeLines(value: unknown, schedule: PaymentSchedule): FeeLinesDraft {
  const lines: FeeLinesDraft = {};
  if (isRecord(value)) {
    if (schedule === 'upfront_only' || schedule === 'upfront_and_deferred') {
      lines.application = coerceFeeLine(value.application, 'application');
    }
    if (schedule === 'deferred_only' || schedule === 'upfront_and_deferred') {
      lines.approval = coerceFeeLine(value.approval, 'approval');
    }
  }
  if (schedule === 'upfront_only' || schedule === 'upfront_and_deferred') {
    lines.application ??= blankFeeLine('application');
  }
  if (schedule === 'deferred_only' || schedule === 'upfront_and_deferred') {
    lines.approval ??= blankFeeLine('approval');
  }
  return lines;
}

function previewFixedFee(rule: FeeRuleDraft): number | null {
  if (rule.type === 'free') {
    return 0;
  }
  if (rule.type === 'fixed') {
    return rule.amount_paise;
  }
  return null;
}

function formatPreview(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) {
    return 'external/invalid';
  }
  return `₹${(paise / 100).toFixed(2)}`;
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
  paymentSchedule,
  feeLines,
  feeText,
  documentsText,
  revenueHeadCode,
  parsedFee,
  parsedDocuments,
  onPaymentScheduleChange,
  onFeeLinesChange,
  onFeeTextChange,
  onDocumentsTextChange,
  onRevenueHeadCodeChange,
  bocPolicy,
  onBocPolicyChange,
  municipalSignoffPolicy,
  onMunicipalSignoffPolicyChange,
  municipalSignoffThresholdRupees,
  onMunicipalSignoffThresholdRupeesChange,
  onSave,
}: {
  serviceConfig: ServiceConfigResponse;
  revenueHeads: RevenueHeadRow[];
  paymentSchedule: PaymentSchedule;
  feeLines: FeeLinesDraft;
  feeText: string;
  documentsText: string;
  revenueHeadCode: string;
  parsedFee: ParsedValue;
  parsedDocuments: ParsedValue;
  onPaymentScheduleChange: (value: PaymentSchedule) => void;
  onFeeLinesChange: (value: FeeLinesDraft) => void;
  onFeeTextChange: (value: string) => void;
  onDocumentsTextChange: (value: string) => void;
  onRevenueHeadCodeChange: (value: string) => void;
  bocPolicy: BocPolicy;
  onBocPolicyChange: (value: BocPolicy) => void;
  municipalSignoffPolicy: MunicipalSignoffPolicy;
  onMunicipalSignoffPolicyChange: (value: MunicipalSignoffPolicy) => void;
  municipalSignoffThresholdRupees: string;
  onMunicipalSignoffThresholdRupeesChange: (value: string) => void;
  onSave: () => void;
}): JSX.Element {
  const legacyFeeRule = coerceFeeRule(parsedFee.value);
  const documents = coerceDocuments(parsedDocuments.value);
  const legacySlabSet =
    isRecord(parsedFee.value) && typeof parsedFee.value.slab_set === 'string'
      ? parsedFee.value.slab_set
      : null;

  function setFeeRule(next: FeeRuleDraft): void {
    onFeeTextChange(pretty(next));
  }

  function updateFeeLine(code: FeeLineCode, next: FeeLineDraft): void {
    onFeeLinesChange({ ...feeLines, [code]: next });
    if (code === 'application' && paymentSchedule !== 'deferred_only') {
      onFeeTextChange(pretty(next.rule));
    }
    if (code === 'approval' && paymentSchedule === 'deferred_only') {
      onFeeTextChange(pretty(next.rule));
    }
  }

  function setDocuments(next: DocumentDraft[]): void {
    onDocumentsTextChange(pretty(next));
  }

  const activeLineCodes: FeeLineCode[] =
    paymentSchedule === 'upfront_and_deferred'
      ? ['application', 'approval']
      : paymentSchedule === 'deferred_only'
        ? ['approval']
        : ['application'];

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
            Primary preview: {formatPreview(serviceConfig.fee_preview_paise)}
            {serviceConfig.payment_schedule_inferred ? ' · schedule inferred from workflow' : ''}
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
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900">Payment schedule (ADR-0013)</h3>
          <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-slate-500">
            When fees are collected
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
              value={paymentSchedule}
              onChange={(event) => {
                const schedule = event.target.value as PaymentSchedule;
                onPaymentScheduleChange(schedule);
                onFeeLinesChange(coerceFeeLines(feeLines, schedule));
              }}
            >
              <option value="upfront_only">Upfront only — pay before submit</option>
              <option value="deferred_only">Deferred only — dept head issues link later</option>
              <option value="upfront_and_deferred">
                Dual fee — application upfront + approval later
              </option>
            </select>
          </label>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {activeLineCodes.map((code) => {
              const line = feeLines[code] ?? blankFeeLine(code);
              const savedPreview = serviceConfig.fee_line_previews?.[code];
              const draftPreview = previewFixedFee(line.rule);
              return (
                <div key={code} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold capitalize text-slate-900">{code} fee</h4>
                    <span className="text-xs text-slate-500">
                      Preview: {formatPreview(draftPreview ?? savedPreview)}
                    </span>
                  </div>
                  <TextInput
                    label="Label EN"
                    value={line.label.en}
                    onChange={(en) =>
                      updateFeeLine(code, {
                        ...line,
                        label: { ...line.label, en, bn: en, hi: en },
                      })
                    }
                  />
                  <FeeRuleFields
                    feeRule={line.rule}
                    onChange={(rule) => updateFeeLine(code, { ...line, rule })}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Legacy fee rule (primary line)</h3>
          <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Rule type
            <select
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal"
              value={legacyFeeRule.type}
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
          {legacySlabSet ? (
            <p className="mt-2 text-xs text-amber-800">
              Catalogue slab reference <span className="font-mono">{legacySlabSet}</span> —
              configure fee tiers below, then save to replace the seed placeholder.
            </p>
          ) : null}
          <FeeRuleFields feeRule={legacyFeeRule} onChange={setFeeRule} />
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
        Municipal sign-off policy
        <select
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal text-slate-900"
          value={municipalSignoffPolicy}
          onChange={(event) =>
            onMunicipalSignoffPolicyChange(event.target.value as MunicipalSignoffPolicy)
          }
        >
          <option value="never">Never — skip EO/CIC/VC/Chairperson ladder</option>
          <option value="high_value_only">
            High value only — ladder when fee ≥ threshold or form flag
          </option>
          <option value="always">Always — every application uses municipal ladder</option>
        </select>
        <p className="mt-1 text-xs font-normal normal-case text-slate-500">
          Use the PWD works or municipal ladder template with guarded forward edges from{' '}
          <span className="font-mono">dept-head-review</span>.
        </p>
      </label>

      {municipalSignoffPolicy === 'high_value_only' ? (
        <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Municipal sign-off threshold (₹)
          <input
            type="number"
            min={0}
            step="0.01"
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal text-slate-900"
            value={municipalSignoffThresholdRupees}
            onChange={(event) => onMunicipalSignoffThresholdRupeesChange(event.target.value)}
          />
          <p className="mt-1 text-xs font-normal normal-case text-slate-500">
            Default ₹5,00,000. Fee preview for this service:{' '}
            {serviceConfig.fee_preview_paise != null
              ? `₹${(serviceConfig.fee_preview_paise / 100).toFixed(2)}`
              : 'not computed'}
          </p>
        </label>
      ) : null}

      <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        Board of Councillors (BOC) policy
        <select
          className="mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-sm normal-case tracking-normal text-slate-900"
          value={bocPolicy}
          onChange={(event) => onBocPolicyChange(event.target.value as BocPolicy)}
        >
          <option value="never">Never — skip BOC stage (guards block route-to-boc)</option>
          <option value="always">Always — every application requires BOC resolution</option>
          <option value="officer_may_require">
            Officer may require — hoarding officer can flag BOC at technical scrutiny
          </option>
        </select>
        <p className="mt-1 text-xs font-normal normal-case text-slate-500">
          Publish a workflow with <span className="font-mono">boc-resolution</span> and guarded
          edges from <span className="font-mono">technical-scrutiny</span> (use the hoarding
          scrutiny template).
        </p>
      </label>

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
    const slabs = feeRule.slabs ?? [];
    return (
      <div className="mt-3 space-y-3">
        <TextInput
          label="Input key"
          value={feeRule.input_key ?? ''}
          onChange={(input_key) => onChange({ ...feeRule, input_key })}
        />
        {slabs.map((slab, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <TextInput
              label="Up to (blank = open)"
              value={slab.upto === null ? '' : String(slab.upto)}
              onChange={(value) =>
                onChange({
                  ...feeRule,
                  slabs: slabs.map((item, itemIndex) =>
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
                  slabs: slabs.map((item, itemIndex) =>
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
                  slabs: slabs.filter((_, itemIndex) => itemIndex !== index),
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
            onChange({ ...feeRule, slabs: [...slabs, { upto: null, amount_paise: 0 }] })
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
