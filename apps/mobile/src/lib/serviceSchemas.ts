import type { FormSubmission } from '@enagar/forms';

import type { ServiceSummary } from '../types/dossier';

/** Dev-friendly defaults only; runtime schemas now come from published API catalogue rows. */
export function defaultFormValuesForService(serviceCode: string): FormSubmission {
  if (serviceCode === 'birth-cert') {
    return {
      applicant_name: 'Citizen Test',
      child_name: 'Child Test',
      applicant_dob: '1990-05-15',
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
