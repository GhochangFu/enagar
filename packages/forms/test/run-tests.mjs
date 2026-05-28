import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';

import { birthCertificateSchema, tradeLicenceSchema } from '../dist/fixtures.js';
import {
  MOBILE_GRIEVANCE_DRAFT_SCHEMA,
  assertValidFormSchema,
  createBlankFormSchemaDraft,
  createFormDraftEnvelope,
  createRenderPlan,
  exportToJsonSchema,
  parseFormDraftJson,
  validateFormSchema,
  validateSubmission,
} from '../dist/index.js';

test('validates Sprint 2.2 priority schemas', () => {
  assert.equal(validateFormSchema(birthCertificateSchema).ok, true);
  assert.equal(validateFormSchema(tradeLicenceSchema).ok, true);
});

test('creates a valid admin form-builder starter draft', () => {
  const draft = createBlankFormSchemaDraft('pet-licence', { en: 'Pet Licence' }, 3);

  assert.equal(draft.service_code, 'pet-licence');
  assert.equal(draft.version, 3);
  assert.equal(validateFormSchema(draft).ok, true);
  assert.equal(assertValidFormSchema(draft), draft);
});

test('rejects invalid schema structure before seeding', () => {
  const invalid = {
    ...birthCertificateSchema,
    fields: [
      birthCertificateSchema.fields[0],
      { ...birthCertificateSchema.fields[1], id: birthCertificateSchema.fields[0].id },
      {
        id: 'bad-conditional',
        type: 'text',
        label: { en: 'Bad', bn: 'Bad', hi: 'Bad' },
        show_if: { field: 'missing-field', equals: 'yes' },
      },
      {
        id: 'bad_type',
        type: 'map',
        label: { en: 'Bad', bn: 'Bad', hi: 'Bad' },
      },
    ],
  };

  const result = validateFormSchema(invalid);

  assert.equal(result.ok, false);
  assert.match(
    result.issues.map((issue) => issue.message).join('\n'),
    /duplicate field id|unsupported field type|unknown field/,
  );
});

test('builds equivalent web and native render plans from one schema', () => {
  const webPlan = createRenderPlan(tradeLicenceSchema, {
    platform: 'web',
    values: { trade_type: 'food' },
  });
  const nativePlan = createRenderPlan(tradeLicenceSchema, {
    platform: 'native',
    values: { trade_type: 'food' },
  });

  assert.deepEqual(
    webPlan.nodes.map((node) => node.id),
    nativePlan.nodes.map((node) => node.id),
  );
  assert.equal(webPlan.nodes.find((node) => node.id === 'fssai_certificate')?.visible, true);
  assert.equal(nativePlan.nodes.find((node) => node.id === 'fssai_certificate')?.visible, true);
});

test('keeps conditional hidden fields out of required validation', () => {
  const result = validateSubmission(tradeLicenceSchema, {
    applicant_name: 'Asha Sen',
    business_name: 'Asha Stores',
    trade_type: 'retail',
    premises_proof: {
      name: 'proof.pdf',
      mime_type: 'application/pdf',
      size_mb: 1,
    },
  });

  assert.equal(result.ok, true);
});

test('rejects invalid visible submission values', () => {
  const result = validateSubmission(birthCertificateSchema, {
    applicant_name: 'A',
    mobile: '123',
    child_name: 'Riya',
    date_of_birth: '2026-05-07',
    relationship: 'parent',
  });

  assert.equal(result.ok, false);
  assert.match(
    result.issues.map((issue) => `${issue.path}:${issue.message}`).join('\n'),
    /mobile|hospital_discharge/,
  );
});

test('validates date min and max bounds on schema and submission', () => {
  const schema = {
    schema_version: 1,
    service_code: 'event-booking',
    version: 1,
    title: { en: 'Event booking', bn: 'Event booking', hi: 'Event booking' },
    fields: [
      {
        id: 'event_date',
        type: 'date',
        label: { en: 'Event date', bn: 'Event date', hi: 'Event date' },
        required: true,
        min_date: '2026-01-01',
        max_date: '2026-12-31',
      },
    ],
  };

  assert.equal(validateFormSchema(schema).ok, true);

  const invalidSchema = {
    ...schema,
    fields: [{ ...schema.fields[0], min_date: '2026-12-31', max_date: '2026-01-01' }],
  };
  const schemaResult = validateFormSchema(invalidSchema);
  assert.equal(schemaResult.ok, false);
  assert.match(
    schemaResult.issues.map((entry) => entry.message).join('\n'),
    /max_date must be on or after min_date/,
  );

  const tooEarly = validateSubmission(schema, { event_date: '2025-12-31' });
  assert.equal(tooEarly.ok, false);
  assert.match(
    tooEarly.issues.map((entry) => entry.message).join('\n'),
    /date must be on or after 2026-01-01/,
  );

  const tooLate = validateSubmission(schema, { event_date: '2027-01-01' });
  assert.equal(tooLate.ok, false);
  assert.match(
    tooLate.issues.map((entry) => entry.message).join('\n'),
    /date must be on or before 2026-12-31/,
  );

  const valid = validateSubmission(schema, { event_date: '2026-06-15' });
  assert.equal(valid.ok, true);

  const jsonSchema = exportToJsonSchema(schema);
  assert.equal(jsonSchema.properties.event_date.minimum, '2026-01-01');
  assert.equal(jsonSchema.properties.event_date.maximum, '2026-12-31');
});

test('preview show_if smoke values make conditional fields visible', () => {
  const hidden = createRenderPlan(tradeLicenceSchema, {
    platform: 'web',
    values: { trade_type: 'retail' },
  });
  assert.equal(hidden.nodes.find((node) => node.id === 'fssai_certificate')?.visible, false);

  const visible = createRenderPlan(tradeLicenceSchema, {
    platform: 'web',
    values: { trade_type: 'food' },
  });
  assert.equal(visible.nodes.find((node) => node.id === 'fssai_certificate')?.visible, true);
});

test('exports JSON-Schema for API-side validation', () => {
  const jsonSchema = exportToJsonSchema(birthCertificateSchema);

  assert.equal(jsonSchema.type, 'object');
  assert.equal(jsonSchema.additionalProperties, false);
  assert.ok(jsonSchema.required.includes('applicant_name'));
  assert.equal(jsonSchema.properties.mobile.pattern, '^[6-9][0-9]{9}$');
});

test('round-trips grievance composer draft envelopes (Sprint 5.2)', () => {
  const envelope = createFormDraftEnvelope(MOBILE_GRIEVANCE_DRAFT_SCHEMA, 'KMC', {
    category_slug: 'water',
    description: 'Leak near pump',
    priority: 'medium',
  });
  const raw = JSON.stringify(envelope);
  const back = parseFormDraftJson(raw);
  assert.ok(back);
  assert.equal(back.schemaKey, MOBILE_GRIEVANCE_DRAFT_SCHEMA);
  assert.equal(back.tenantCode, 'KMC');
  assert.equal(back.payload.description, 'Leak near pump');
});

test('rejects malformed draft JSON', () => {
  assert.equal(parseFormDraftJson('not-json'), null);
  assert.equal(parseFormDraftJson(JSON.stringify({})), null);
});

test('creates render plans within a local smoke budget', () => {
  const start = performance.now();

  for (let index = 0; index < 500; index += 1) {
    createRenderPlan(tradeLicenceSchema, {
      platform: 'web',
      values: { trade_type: index % 2 === 0 ? 'food' : 'retail' },
    });
  }

  assert.ok(performance.now() - start < 100);
});

test('show_if equals_any controls visibility with OR semantics', () => {
  const schema = {
    schema_version: 1,
    service_code: 'trade-extra',
    version: 1,
    title: { en: 'Trade extra', bn: 'Trade extra', hi: 'Trade extra' },
    fields: [
      {
        id: 'trade_type',
        type: 'select',
        label: { en: 'Trade type', bn: 'Trade type', hi: 'Trade type' },
        options: [
          { value: 'food', label: { en: 'Food', bn: 'Food', hi: 'Food' } },
          { value: 'retail', label: { en: 'Retail', bn: 'Retail', hi: 'Retail' } },
          { value: 'industrial', label: { en: 'Industrial', bn: 'Industrial', hi: 'Industrial' } },
        ],
      },
      {
        id: 'extra_document',
        type: 'file',
        label: { en: 'Extra document', bn: 'Extra document', hi: 'Extra document' },
        accept: ['application/pdf'],
        max_size_mb: 5,
        show_if: { field: 'trade_type', equals_any: ['food', 'retail'] },
      },
    ],
  };

  assert.equal(validateFormSchema(schema).ok, true);

  const foodPlan = createRenderPlan(schema, { platform: 'web', values: { trade_type: 'food' } });
  assert.equal(foodPlan.nodes.find((node) => node.id === 'extra_document')?.visible, true);

  const retailPlan = createRenderPlan(schema, {
    platform: 'web',
    values: { trade_type: 'retail' },
  });
  assert.equal(retailPlan.nodes.find((node) => node.id === 'extra_document')?.visible, true);

  const industrialPlan = createRenderPlan(schema, {
    platform: 'web',
    values: { trade_type: 'industrial' },
  });
  assert.equal(industrialPlan.nodes.find((node) => node.id === 'extra_document')?.visible, false);
});

test('validates cross-field compare rules and optional when gate', () => {
  const schema = {
    schema_version: 1,
    service_code: 'event-booking',
    version: 1,
    title: { en: 'Event booking', bn: 'Event booking', hi: 'Event booking' },
    fields: [
      {
        id: 'booking_type',
        type: 'select',
        label: { en: 'Booking type', bn: 'Booking type', hi: 'Booking type' },
        options: [
          { value: 'hall', label: { en: 'Hall', bn: 'Hall', hi: 'Hall' } },
          { value: 'open', label: { en: 'Open', bn: 'Open', hi: 'Open' } },
        ],
      },
      {
        id: 'event_start_date',
        type: 'date',
        label: { en: 'Start date', bn: 'Start date', hi: 'Start date' },
        required: true,
      },
      {
        id: 'event_end_date',
        type: 'date',
        label: { en: 'End date', bn: 'End date', hi: 'End date' },
        required: true,
      },
      {
        id: 'guest_count',
        type: 'number',
        label: { en: 'Guest count', bn: 'Guest count', hi: 'Guest count' },
        required: true,
      },
      {
        id: 'hall_capacity',
        type: 'number',
        label: { en: 'Hall capacity', bn: 'Hall capacity', hi: 'Hall capacity' },
        required: true,
      },
    ],
    cross_field_rules: [
      {
        id: 'end_after_start',
        left: 'event_end_date',
        op: 'gt_field',
        right: 'event_start_date',
        message: {
          en: 'End date must be after start date',
          bn: 'End date must be after start date',
          hi: 'End date must be after start date',
        },
      },
      {
        id: 'guests_within_capacity',
        left: 'guest_count',
        op: 'lte_field',
        right: 'hall_capacity',
        when: { field: 'booking_type', equals: 'hall' },
        message: {
          en: 'Guest count cannot exceed hall capacity',
          bn: 'Guest count cannot exceed hall capacity',
          hi: 'Guest count cannot exceed hall capacity',
        },
      },
    ],
  };

  assert.equal(validateFormSchema(schema).ok, true);

  const invalidDates = validateSubmission(schema, {
    booking_type: 'hall',
    event_start_date: '2026-06-10',
    event_end_date: '2026-06-09',
    guest_count: 50,
    hall_capacity: 100,
  });
  assert.equal(invalidDates.ok, false);
  assert.match(
    invalidDates.issues.map((entry) => entry.message).join('\n'),
    /End date must be after start date/,
  );

  const guestsOverCapacity = validateSubmission(schema, {
    booking_type: 'hall',
    event_start_date: '2026-06-01',
    event_end_date: '2026-06-02',
    guest_count: 120,
    hall_capacity: 100,
  });
  assert.equal(guestsOverCapacity.ok, false);
  assert.match(
    guestsOverCapacity.issues.map((entry) => entry.message).join('\n'),
    /Guest count cannot exceed hall capacity/,
  );

  const openBookingSkipsCapacity = validateSubmission(schema, {
    booking_type: 'open',
    event_start_date: '2026-06-01',
    event_end_date: '2026-06-02',
    guest_count: 120,
    hall_capacity: 100,
  });
  assert.equal(openBookingSkipsCapacity.ok, true);
});

test('show-if smoke value pattern satisfies equals_any visibility rules', () => {
  const schema = {
    schema_version: 1,
    service_code: 'trade-extra',
    version: 1,
    title: { en: 'Trade extra', bn: 'Trade extra', hi: 'Trade extra' },
    fields: [
      {
        id: 'trade_type',
        type: 'select',
        label: { en: 'Trade type', bn: 'Trade type', hi: 'Trade type' },
        options: [
          { value: 'food', label: { en: 'Food', bn: 'Food', hi: 'Food' } },
          { value: 'retail', label: { en: 'Retail', bn: 'Retail', hi: 'Retail' } },
        ],
      },
      {
        id: 'extra_document',
        type: 'text',
        label: { en: 'Extra document', bn: 'Extra document', hi: 'Extra document' },
        show_if: { field: 'trade_type', equals_any: ['food', 'retail'] },
      },
    ],
  };

  const values = { trade_type: 'food' };
  const plan = createRenderPlan(schema, { platform: 'web', values });
  assert.equal(plan.nodes.find((node) => node.id === 'extra_document')?.visible, true);
});

test('rejects invalid cross_field_rules during schema validation', () => {
  const base = {
    schema_version: 1,
    service_code: 'event-booking',
    version: 1,
    title: { en: 'Event booking', bn: 'Event booking', hi: 'Event booking' },
    fields: [
      {
        id: 'event_start_date',
        type: 'date',
        label: { en: 'Start date', bn: 'Start date', hi: 'Start date' },
      },
      {
        id: 'event_end_date',
        type: 'date',
        label: { en: 'End date', bn: 'End date', hi: 'End date' },
      },
    ],
  };

  const sameFieldRule = validateFormSchema({
    ...base,
    cross_field_rules: [
      {
        id: 'bad_same_field',
        left: 'event_start_date',
        op: 'gt_field',
        right: 'event_start_date',
      },
    ],
  });
  assert.equal(sameFieldRule.ok, false);
  assert.match(
    sameFieldRule.issues.map((entry) => entry.message).join('\n'),
    /left and right fields must differ/,
  );

  const duplicateIds = validateFormSchema({
    ...base,
    cross_field_rules: [
      {
        id: 'duplicate_rule',
        left: 'event_end_date',
        op: 'gt_field',
        right: 'event_start_date',
      },
      {
        id: 'duplicate_rule',
        left: 'event_end_date',
        op: 'gte_field',
        right: 'event_start_date',
      },
    ],
  });
  assert.equal(duplicateIds.ok, false);
  assert.match(
    duplicateIds.issues.map((entry) => entry.message).join('\n'),
    /duplicate cross-field rule id/,
  );
});
