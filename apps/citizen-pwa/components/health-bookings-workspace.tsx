'use client';

import { HealthFleetBookingInner } from './health-fleet-booking-inner';

import type { PwaLocaleCode, ServiceSummary, TokenResponse } from '../lib/workspace-types';
import type { JSX } from 'react';

type HealthBookingsWorkspaceProps = {
  apiBaseUrl: string;
  token: TokenResponse;
  tenantCode: string;
  language: PwaLocaleCode;
  linkedService: ServiceSummary;
  onStatus: (message: string) => void;
  onBack: () => void;
};

/** Sprint 8.5F — Health fleet booking (ambulance / hearse pool). */
export function HealthBookingsWorkspace(props: HealthBookingsWorkspaceProps): JSX.Element {
  return <HealthFleetBookingInner {...props} />;
}
