import type { EnagarFormSchema, FormSubmission } from '@enagar/forms';

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

/** Keeps dev defaults aligned with the published form schema field ids. */
export function defaultFormValuesForSchema(
  serviceCode: string,
  schema: EnagarFormSchema | null | undefined,
): FormSubmission {
  const base = defaultFormValuesForService(serviceCode);
  if (!schema?.fields?.length) {
    return base;
  }
  const allowed = new Set(
    schema.fields.filter((field) => field.type !== 'section').map((field) => field.id),
  );
  return Object.fromEntries(Object.entries(base).filter(([key]) => allowed.has(key)));
}
