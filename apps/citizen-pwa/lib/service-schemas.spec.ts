import { defaultFormValuesForSchema, defaultFormValuesForService } from './service-schemas';

describe('defaultFormValuesForService', () => {
  it('uses published birth-cert field ids', () => {
    expect(defaultFormValuesForService('birth-cert')).toMatchObject({
      applicant_name: expect.any(String),
      mobile: '9876543210',
      child_name: expect.any(String),
      date_of_birth: expect.any(String),
      relationship: 'parent',
    });
    expect(defaultFormValuesForService('birth-cert')).not.toHaveProperty('applicant_dob');
  });
});

describe('defaultFormValuesForSchema', () => {
  it('filters defaults to schema field ids', () => {
    const values = defaultFormValuesForSchema('birth-cert', {
      schema_version: 1,
      service_code: 'birth-cert',
      version: 1,
      title: { en: 'Birth Certificate', bn: '', hi: '' },
      fields: [
        { id: 'applicant_name', type: 'text', label: { en: 'Name', bn: '', hi: '' } },
        { id: 'mobile', type: 'text', label: { en: 'Mobile', bn: '', hi: '' } },
      ],
    });
    expect(values).toEqual({
      applicant_name: 'Citizen Test',
      mobile: '9876543210',
    });
  });
});
