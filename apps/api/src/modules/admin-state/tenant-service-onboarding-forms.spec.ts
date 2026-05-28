import { createBlankFormSchemaDraft } from '@enagar/forms';

import {
  classifyOnboardingForm,
  countFormInputFields,
  isUsableFormSchema,
  resolveOnboardingFormSchema,
} from './tenant-service-onboarding-forms';

describe('tenant-service-onboarding-forms', () => {
  const birthCertSchema = {
    schema_version: 1,
    service_code: 'birth-cert',
    version: 1,
    title: { en: 'Birth Certificate', bn: 'Birth Certificate', hi: 'Birth Certificate' },
    fields: [
      {
        id: 'applicant_name',
        type: 'text',
        label: { en: 'Applicant name', bn: 'Applicant name', hi: 'Applicant name' },
        required: true,
        max_length: 120,
      },
    ],
  };

  it('isUsableFormSchema accepts validated global schema', () => {
    expect(isUsableFormSchema(birthCertSchema)).toBe(true);
  });

  it('isUsableFormSchema rejects empty object', () => {
    expect(isUsableFormSchema({})).toBe(false);
  });

  it('resolveOnboardingFormSchema returns global schema when usable', () => {
    const resolved = resolveOnboardingFormSchema(
      'birth-cert',
      { en: 'Birth Certificate' },
      birthCertSchema,
    );
    expect(resolved.service_code).toBe('birth-cert');
    expect(resolved.fields).toHaveLength(1);
  });

  it('resolveOnboardingFormSchema returns blank draft for empty global schema', () => {
    const resolved = resolveOnboardingFormSchema(
      'sanitation-grievance',
      { en: 'Sanitation Grievance' },
      {},
    );
    expect(resolved).toEqual(
      createBlankFormSchemaDraft('sanitation-grievance', {
        en: 'Sanitation Grievance',
        bn: 'Sanitation Grievance',
        hi: 'Sanitation Grievance',
      }),
    );
  });

  it('classifyOnboardingForm distinguishes global vs stub', () => {
    expect(classifyOnboardingForm(birthCertSchema)).toBe('global');
    expect(classifyOnboardingForm({})).toBe('stub');
  });

  it('countFormInputFields ignores section headers', () => {
    expect(
      countFormInputFields({
        fields: [
          { id: 's1', type: 'section', label: { en: 'A', bn: 'A', hi: 'A' } },
          { id: 'f1', type: 'text', label: { en: 'B', bn: 'B', hi: 'B' } },
        ],
      }),
    ).toBe(1);
  });
});
