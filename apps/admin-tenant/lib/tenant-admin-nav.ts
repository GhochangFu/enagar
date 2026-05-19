import type { IconName } from '@enagar/ui';

export type TenantAdminNavItem = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  adminOnly: boolean;
  match: (pathname: string) => boolean;
};

export const TENANT_ADMIN_NAV: TenantAdminNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'home',
    adminOnly: true,
    match: (pathname) => pathname === '/dashboard',
  },
  {
    id: 'desk',
    label: 'Desk',
    href: '/dashboard/desk',
    icon: 'inbox',
    adminOnly: false,
    match: (pathname) => pathname.startsWith('/dashboard/desk'),
  },
  {
    id: 'masters',
    label: 'Masters',
    href: '/dashboard/masters',
    icon: 'building',
    adminOnly: true,
    match: (pathname) => pathname.startsWith('/dashboard/masters'),
  },
  {
    id: 'operations',
    label: 'Operations',
    href: '/dashboard/operations',
    icon: 'user',
    adminOnly: true,
    match: (pathname) => pathname.startsWith('/dashboard/operations'),
  },
];

export function isAdminPortalUser(isAdmin: boolean): boolean {
  return isAdmin;
}
