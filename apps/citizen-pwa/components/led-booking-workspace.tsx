'use client';

import { BookingWorkspace } from './booking-workspace';

import type { PwaLocaleCode, ServiceSummary, TokenResponse } from '../lib/workspace-types';
import type { JSX } from 'react';

type LedBookingWorkspaceProps = {
  apiBaseUrl: string;
  token: TokenResponse;
  tenantCode: string;
  language: PwaLocaleCode;
  linkedService: ServiceSummary;
  onStatus: (message: string) => void;
  onBack: () => void;
};

/** Sprint 8.5C — LED board slot booking (reuses community-hall booking engine). */
export function LedBookingWorkspace({
  apiBaseUrl,
  token,
  tenantCode,
  language,
  linkedService,
  onStatus,
  onBack,
}: LedBookingWorkspaceProps): JSX.Element {
  return (
    <BookingWorkspace
      apiBaseUrl={apiBaseUrl}
      language={language}
      linkedService={linkedService}
      onBack={onBack}
      onStatus={onStatus}
      tenantCode={tenantCode}
      token={token}
      variant="led"
    />
  );
}
