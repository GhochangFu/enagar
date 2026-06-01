import { resolveCitizenPaymentTarget } from './payment-eligibility';

import type { ApplicationDetail, PwaLocaleCode, ServiceSummary } from './workspace-types';

export type PaymentSchedule = 'upfront_only' | 'deferred_only' | 'upfront_and_deferred';
export type FeeLineCode = 'application' | 'approval';

export type FeeLineDisplay = {
  feeCode: FeeLineCode;
  amountPaise: number;
  label: string;
};

export function inferPaymentSchedule(service: ServiceSummary): PaymentSchedule | null {
  if (
    service.payment_schedule === 'upfront_only' ||
    service.payment_schedule === 'deferred_only' ||
    service.payment_schedule === 'upfront_and_deferred'
  ) {
    return service.payment_schedule;
  }
  if (service.fee_lines?.application) {
    return service.fee_lines.approval ? 'upfront_and_deferred' : 'upfront_only';
  }
  if (service.fee_lines?.approval) {
    return 'deferred_only';
  }
  return null;
}

export function requiresApplicationFeeBeforeSubmit(schedule: PaymentSchedule | null): boolean {
  return schedule === 'upfront_only' || schedule === 'upfront_and_deferred';
}

export function resolveFeeLineAmount(service: ServiceSummary, feeCode: FeeLineCode): number | null {
  const preview = service.fee_line_previews?.[feeCode];
  if (typeof preview === 'number' && Number.isInteger(preview) && preview > 0) {
    return preview;
  }
  const rule = service.fee_lines?.[feeCode]?.rule as
    | { type?: string; amount_paise?: unknown }
    | undefined;
  if (rule?.type === 'fixed' && typeof rule.amount_paise === 'number' && rule.amount_paise > 0) {
    return rule.amount_paise;
  }
  if (feeCode === 'application' && service.fee_type === 'fixed') {
    const legacy = (service.fee_config as { amount_paise?: unknown }).amount_paise;
    if (typeof legacy === 'number' && Number.isInteger(legacy) && legacy > 0) {
      return legacy;
    }
  }
  return null;
}

export function feeLineLabel(
  service: ServiceSummary,
  feeCode: FeeLineCode,
  locale: PwaLocaleCode,
): string {
  const fromLine = service.fee_lines?.[feeCode]?.label;
  if (fromLine) {
    return fromLine[locale] ?? fromLine.en ?? feeCode;
  }
  if (feeCode === 'application') {
    return locale === 'bn' ? 'আবেদন ফি' : locale === 'hi' ? 'आवेदन शुल्क' : 'Application fee';
  }
  return locale === 'bn' ? 'লাইসেন্স ফি' : locale === 'hi' ? 'लाइसेंस शुल्क' : 'Licence fee';
}

export function applicationFeeLineForService(
  service: ServiceSummary,
  locale: PwaLocaleCode,
): FeeLineDisplay | null {
  const schedule = inferPaymentSchedule(service);
  if (!requiresApplicationFeeBeforeSubmit(schedule)) {
    return null;
  }
  const amountPaise = resolveFeeLineAmount(service, 'application');
  if (amountPaise == null) {
    return null;
  }
  return {
    feeCode: 'application',
    amountPaise,
    label: feeLineLabel(service, 'application', locale),
  };
}

export function approvalFeeLineForService(
  service: ServiceSummary,
  locale: PwaLocaleCode,
): FeeLineDisplay | null {
  const schedule = inferPaymentSchedule(service);
  if (schedule !== 'deferred_only' && schedule !== 'upfront_and_deferred') {
    return null;
  }
  const amountPaise = resolveFeeLineAmount(service, 'approval');
  if (amountPaise == null) {
    return null;
  }
  return {
    feeCode: 'approval',
    amountPaise,
    label: feeLineLabel(service, 'approval', locale),
  };
}

export function resolvePaymentLineForApplication(
  application: ApplicationDetail,
  services: ServiceSummary[],
  locale: PwaLocaleCode,
): FeeLineDisplay | null {
  const target = resolveCitizenPaymentTarget(application);
  if (!target) {
    return null;
  }
  const service = services.find((entry) => entry.code === application.service_code);
  const amountPaise =
    target.amountPaise ?? (service ? resolveFeeLineAmount(service, target.feeCode) : null);
  if (amountPaise == null) {
    return null;
  }
  return {
    feeCode: target.feeCode,
    amountPaise,
    label: service ? feeLineLabel(service, target.feeCode, locale) : target.feeCode,
  };
}
