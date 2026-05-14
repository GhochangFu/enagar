import {
  birthCertificateSchema,
  communityHallSchema,
  propertyTaxSchema,
  rtiSchema,
  tradeLicenceSchema,
} from '@enagar/forms/fixtures';

import type { EnagarFormSchema, FormSubmission } from '@enagar/forms';

/** Fixture catalogue mirrored by `@enagar/mobile` and API `ApplicationsService` smoke paths. */
export const serviceFormSchemas = [
  birthCertificateSchema,
  tradeLicenceSchema,
  propertyTaxSchema,
  communityHallSchema,
  rtiSchema,
] as const;

export const schemaByServiceCode = new Map<string, EnagarFormSchema>(
  serviceFormSchemas.map((schema) => [schema.service_code, schema]),
);

/** Dev-friendly defaults aligned with **`@enagar/mobile`** smoke + document simulation. */
export function defaultFormValuesForService(serviceCode: string): FormSubmission {
  if (serviceCode === 'birth-cert') {
    return {
      applicant_name: 'Citizen Test',
      mobile: '9876543210',
      child_name: 'Child Test',
      date_of_birth: '2026-01-01',
      relationship: 'parent',
      hospital_discharge: {
        name: 'birth-proof.pdf',
        mime_type: 'application/pdf',
        size_mb: 1,
      },
    };
  }
  if (serviceCode === 'prop-tax') {
    return {
      holding_number: 'KMC-064-PARK-12B',
      payer_type: 'owner',
    };
  }
  return {};
}
