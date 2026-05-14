import { citizenTenantFetch } from './citizenTenantHttp';

import type { Locale } from '@enagar/i18n';

/** Best-effort profile row for applications/payments (`apps/citizen-pwa` parity). */
export async function registerCitizenProfile(options: {
  apiRoot: string;
  accessToken: string;
  mobileDigits10: string;
  locale: Locale;
}): Promise<boolean> {
  const response = await citizenTenantFetch(
    'POST',
    options.apiRoot,
    options.accessToken,
    undefined,
    '/citizen/register',
    {
      body: {
        mobile: options.mobileDigits10,
        language_pref: options.locale,
      },
    },
  );
  return response.ok;
}
