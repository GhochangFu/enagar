import type { EnagarFormSchema, FormRenderPlan } from '@enagar/forms';

/** Sample values shown as field help only — never submitted as form data. */
export function fieldExamplesForService(serviceCode: string): Record<string, string> {
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
      guest_count: '50',
      event_details:
        'Community hall booking smoke test event details for local development validation.',
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

/** Keeps examples aligned with the published form schema field ids. */
export function fieldExamplesForSchema(
  serviceCode: string,
  schema: EnagarFormSchema | null | undefined,
): Record<string, string> {
  const base = fieldExamplesForService(serviceCode);
  if (!schema?.fields?.length) {
    return base;
  }
  const allowed = new Set(
    schema.fields.filter((field) => field.type !== 'section').map((field) => field.id),
  );
  return Object.fromEntries(Object.entries(base).filter(([key]) => allowed.has(key)));
}

/** Adds example help text when the schema field has no `help_text` already. */
export function applyFieldExamplesToRenderPlan(
  plan: FormRenderPlan,
  examples: Record<string, string>,
): FormRenderPlan {
  if (Object.keys(examples).length === 0) {
    return plan;
  }
  return {
    ...plan,
    nodes: plan.nodes.map((node) => {
      if (node.widget === 'section' || node.help_text) {
        return node;
      }
      const example = examples[node.id];
      if (!example) {
        return node;
      }
      return { ...node, help_text: `Example: ${example}` };
    }),
  };
}
