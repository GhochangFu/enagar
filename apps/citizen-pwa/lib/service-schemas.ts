import type { EnagarFormSchema, FormSubmission } from '@enagar/forms';

/** Dev-friendly defaults only; runtime schemas now come from published API catalogue rows. */
export function defaultFormValuesForService(serviceCode: string): FormSubmission {
  if (serviceCode === 'birth-cert') {
    return {
      applicant_name: 'Citizen Test',
      mobile: '9876543210',
      child_name: 'Child Test',
      date_of_birth: '2020-06-15',
      relationship: 'parent',
    };
  }
  if (serviceCode === 'trade-licence') {
    return {
      applicant_name: 'Citizen Test',
      business_name: 'Test Business LLP',
      trade_type: 'retail',
    };
  }
  if (serviceCode === 'prop-tax') {
    return {
      holding_number: 'KMC-064-PARK-12B',
      payer_type: 'owner',
    };
  }
  if (serviceCode === 'community-hall') {
    return {
      applicant_name: 'Citizen Test',
      event_date: '2026-12-15',
      guest_count: 50,
      event_details: 'Community hall booking smoke test event details for local dev.',
    };
  }
  if (serviceCode === 'rti') {
    return {
      applicant_name: 'Citizen Test',
      information_requested:
        'Please provide municipal records related to this RTI smoke test application for local development validation.',
      bpl_applicant: 'no',
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
