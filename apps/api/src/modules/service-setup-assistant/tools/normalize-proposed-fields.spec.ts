import { createBlankFormSchemaDraft } from '@enagar/forms';

import {
  insertProposedFields,
  normalizeLlmProposedField,
  normalizeLlmProposedFields,
} from './normalize-proposed-fields';

describe('normalize-proposed-fields', () => {
  const base = createBlankFormSchemaDraft('trade-licence', { en: 'Trade licence' });

  it('normalizes Text type and string label with insert after reference label', () => {
    const normalized = normalizeLlmProposedField(
      {
        type: 'Text',
        label: "Guardian's Name",
        position: 'after',
        referenceField: 'Applicant name',
      },
      base.fields,
    );

    expect(normalized).not.toBeNull();
    expect(normalized!.field.id).toBe('guardians_name');
    expect(normalized!.field.type).toBe('text');
    expect(normalized!.field.label.en).toBe("Guardian's Name");
    expect(normalized!.field.label.bn).toBeTruthy();
    expect(normalized!.field.label.hi).toBeTruthy();
    expect(normalized!.insertAfterId).toBe('applicant_name');
  });

  it('inserts new field immediately after applicant_name', () => {
    const normalized = normalizeLlmProposedField(
      {
        type: 'text',
        label: "Guardian's Name",
        referenceField: 'Applicant name',
      },
      base.fields,
    )!;
    const merged = insertProposedFields(base.fields, [normalized]);
    const applicantIdx = merged.findIndex((f) => f.id === 'applicant_name');
    expect(merged[applicantIdx + 1]?.id).toBe('guardians_name');
  });

  it('applies email validation preset from label', () => {
    const normalized = normalizeLlmProposedField(
      { type: 'text', label: 'Contact email' },
      base.fields,
    )!;
    expect((normalized.field as { pattern?: string }).pattern).toBe(
      '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    );
  });

  it('chains multiple proposed fields using updated working list', () => {
    const inserts = normalizeLlmProposedFields(
      [
        {
          type: 'text',
          label: 'Contact phone',
          validationPreset: 'phone',
          referenceField: 'Applicant name',
        },
        {
          type: 'text',
          label: 'Contact email',
          validationPreset: 'email',
          referenceField: 'Contact phone',
        },
      ],
      base.fields,
    );
    const merged = insertProposedFields(base.fields, inserts);
    const phoneIdx = merged.findIndex((f) => f.id === 'contact_phone');
    expect(merged[phoneIdx + 1]?.id).toBe('contact_email');
  });

  it('relocates existing fields when referenceField is set (move below another field)', () => {
    const formFields = [
      {
        id: 'children_name',
        type: 'text',
        label: { en: 'Children Name', bn: 'x', hi: 'y' },
        min_length: 2,
        max_length: 120,
      },
      { id: 'date_of_birth', type: 'date', label: { en: 'Date of birth', bn: 'x', hi: 'y' } },
      {
        id: 'contact_no',
        type: 'text',
        label: { en: 'Contact No', bn: 'x', hi: 'y' },
        required: true,
        min_length: 2,
        max_length: 120,
        pattern: '^[6-9][0-9]{9}$',
      },
      {
        id: 'contact_email',
        type: 'text',
        label: { en: 'Contact Email', bn: 'x', hi: 'y' },
        min_length: 2,
        max_length: 120,
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      },
    ] as import('@enagar/forms').EnagarFormField[];

    const moveInserts = normalizeLlmProposedFields(
      [
        {
          id: 'contact_no',
          type: 'text',
          label: 'Contact No',
          required: true,
          validationPreset: 'phone',
          referenceField: 'Children Name',
        },
        {
          id: 'contact_email',
          type: 'text',
          label: 'Contact Email',
          validationPreset: 'email',
          referenceField: 'Contact No',
        },
      ],
      formFields,
    );
    const relocated = insertProposedFields(formFields, moveInserts);
    const childrenIdx = relocated.findIndex((f) => f.id === 'children_name');
    expect(relocated[childrenIdx + 1]?.id).toBe('contact_no');
    expect(relocated[childrenIdx + 2]?.id).toBe('contact_email');
  });
});
