import {
  createBlankFormSchemaDraft,
  validateFormSchema,
  type EnagarFormSchema,
} from '@enagar/forms';

export type OnboardingFormSource = 'global' | 'stub';

export type LocalizedServiceLabel = { en: string; bn: string; hi: string };

export function labelFromServiceName(value: unknown): LocalizedServiceLabel {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const map = value as Record<string, unknown>;
    const en = typeof map.en === 'string' && map.en.trim() ? map.en : 'Service';
    return {
      en,
      bn: typeof map.bn === 'string' && map.bn.trim() ? map.bn : en,
      hi: typeof map.hi === 'string' && map.hi.trim() ? map.hi : en,
    };
  }
  return { en: 'Service', bn: 'Service', hi: 'Service' };
}

export function isUsableFormSchema(value: unknown): value is EnagarFormSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  if (Object.keys(value as object).length === 0) {
    return false;
  }
  return validateFormSchema(value as EnagarFormSchema).ok;
}

export function classifyOnboardingForm(globalFormSchema: unknown): OnboardingFormSource {
  return isUsableFormSchema(globalFormSchema) ? 'global' : 'stub';
}

export function resolveOnboardingFormSchema(
  serviceCode: string,
  serviceName: unknown,
  globalFormSchema: unknown,
): EnagarFormSchema {
  if (isUsableFormSchema(globalFormSchema)) {
    return globalFormSchema;
  }
  return createBlankFormSchemaDraft(serviceCode, labelFromServiceName(serviceName));
}

/** Count input fields (excluding section headers) for UI preview / verify scripts. */
export function countFormInputFields(formSchema: unknown): number {
  if (!formSchema || typeof formSchema !== 'object' || Array.isArray(formSchema)) {
    return 0;
  }
  const fields = (formSchema as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) {
    return 0;
  }
  return fields.filter((field) => {
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      return false;
    }
    const type = (field as { type?: unknown }).type;
    return typeof type === 'string' && type !== 'section';
  }).length;
}
