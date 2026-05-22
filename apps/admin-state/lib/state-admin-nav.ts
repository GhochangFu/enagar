import type { IconName } from '@enagar/ui';

export type StateAdminTabId =
  | 'overview'
  | 'tenants'
  | 'library'
  | 'grievanceLibrary'
  | 'integrations'
  | 'security';

export type StateAdminNavItem = {
  id: StateAdminTabId;
  label: string;
  icon: IconName;
};

export const STATE_ADMIN_NAV: StateAdminNavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'tenants', label: 'Municipalities', icon: 'building' },
  { id: 'library', label: 'Service library', icon: 'clipboard-list' },
  { id: 'grievanceLibrary', label: 'Grievance library', icon: 'megaphone' },
  { id: 'integrations', label: 'Integrations', icon: 'layers' },
  { id: 'security', label: 'Audit & access', icon: 'user' },
];
