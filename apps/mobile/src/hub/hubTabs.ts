import { t } from '@enagar/i18n';
import type { Locale } from '@enagar/i18n';

export type CitizenHubTabId =
  | 'home'
  | 'shortcuts'
  | 'services'
  | 'apply'
  | 'applications'
  | 'payments'
  | 'grievances'
  | 'sahayak';

export type HubTabEntry<T extends string = CitizenHubTabId> = {
  id: T;
  label: string;
};

/** Tab labels aligned with Citizen PWA `citizenWorkspaceHubTabs`. */
export function citizenHubTabs(locale: Locale): readonly HubTabEntry[] {
  return [
    { id: 'home', label: 'Home' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'services', label: 'Services' },
    { id: 'apply', label: 'Apply' },
    { id: 'applications', label: 'Applications' },
    { id: 'payments', label: 'Payments' },
    { id: 'grievances', label: t('grievance.nav', locale) },
    { id: 'sahayak', label: 'Sahayak' },
  ];
}

export type WorkspaceTabId =
  | 'home'
  | 'services'
  | 'apply'
  | 'applications'
  | 'payments'
  | 'grievances'
  | 'sahayak';

export function municipalityWorkspaceTabs(locale: Locale): readonly HubTabEntry<WorkspaceTabId>[] {
  return [
    { id: 'home', label: 'Home' },
    { id: 'services', label: 'Services' },
    { id: 'apply', label: 'Apply' },
    { id: 'applications', label: 'Applications' },
    { id: 'payments', label: 'Payments' },
    { id: 'grievances', label: t('grievance.nav', locale) },
    { id: 'sahayak', label: 'Sahayak' },
  ];
}
