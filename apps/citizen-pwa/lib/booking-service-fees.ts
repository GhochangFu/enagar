import { resolveFeeLineAmount } from './service-payment';

import type { ServiceSummary } from './workspace-types';

/** Municipal service processing fee (e.g. community-hall ₹5,000 application fee). */
export function resolveServiceProcessingFeePaise(
  service: ServiceSummary | null | undefined,
): number {
  if (!service) {
    return 0;
  }
  const fromLine = resolveFeeLineAmount(service, 'application');
  if (fromLine != null) {
    return fromLine;
  }
  if (service.fee_type === 'fixed') {
    const amount = (service.fee_config as { amount_paise?: unknown }).amount_paise;
    if (typeof amount === 'number' && Number.isInteger(amount) && amount > 0) {
      return amount;
    }
  }
  return 0;
}
