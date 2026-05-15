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
