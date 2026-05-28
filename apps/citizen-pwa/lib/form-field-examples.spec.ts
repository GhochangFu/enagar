import {
  applyFieldExamplesToRenderPlan,
  fieldExamplesForSchema,
  fieldExamplesForService,
} from './form-field-examples';

describe('fieldExamplesForService', () => {
  it('uses published birth-cert field ids', () => {
    expect(fieldExamplesForService('birth-cert')).toMatchObject({
      applicant_name: expect.any(String),
      mobile: '9876543210',
      child_name: expect.any(String),
      date_of_birth: expect.any(String),
      relationship: 'parent',
    });
    expect(fieldExamplesForService('birth-cert')).not.toHaveProperty('applicant_dob');
  });
});

describe('fieldExamplesForSchema', () => {
  it('filters examples to schema field ids', () => {
    expect(
      fieldExamplesForSchema('birth-cert', {
        schema_version: 1,
        service_code: 'birth-cert',
        version: 1,
        title: { en: 'Birth Certificate', bn: '', hi: '' },
        fields: [
          { id: 'applicant_name', type: 'text', label: { en: 'Name', bn: '', hi: '' } },
          { id: 'mobile', type: 'text', label: { en: 'Mobile', bn: '', hi: '' } },
        ],
      }),
    ).toEqual({
      applicant_name: 'Citizen Test',
      mobile: '9876543210',
    });
  });
});

describe('applyFieldExamplesToRenderPlan', () => {
  it('adds example help text without overwriting schema help', () => {
    const plan = applyFieldExamplesToRenderPlan(
      {
        schema_version: 1,
        service_code: 'birth-cert',
        version: 1,
        title: 'Birth Certificate',
        platform: 'web',
        nodes: [
          {
            id: 'applicant_name',
            field_type: 'text',
            widget: 'text-input',
            label: 'Applicant name',
            required: true,
            visible: true,
          },
          {
            id: 'mobile',
            field_type: 'text',
            widget: 'text-input',
            label: 'Mobile',
            help_text: 'Enter a 10-digit number',
            required: true,
            visible: true,
          },
        ],
      },
      { applicant_name: 'Citizen Test' },
    );

    expect(plan.nodes[0]?.help_text).toBe('Example: Citizen Test');
    expect(plan.nodes[1]?.help_text).toBe('Enter a 10-digit number');
  });
});
