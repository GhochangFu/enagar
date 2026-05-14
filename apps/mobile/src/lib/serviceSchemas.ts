import type { EnagarFormSchema, FormSubmission } from '@enagar/forms';
import {
  birthCertificateSchema,
  communityHallSchema,
  propertyTaxSchema,
  rtiSchema,
  tradeLicenceSchema,
} from '@enagar/forms/fixtures';

import type { ServiceSummary } from '../types/dossier';

/** Same fixture set as `apps/citizen-pwa` + API `ApplicationsService`. */
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

/** Dev-friendly defaults matching PWA smoke values (document simulation). */
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

export function fixedFeePaise(services: ServiceSummary[], serviceCode: string): number | null {
  const svc = services.find((entry) => entry.code === serviceCode);
  if (!svc || svc.fee_type !== 'fixed') {
    return null;
  }
  const raw = (svc.fee_config as { amount_paise?: unknown }).amount_paise;
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null;
}
