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
    id: 'service-catalogue',
    label: 'Service Catalogue',
    href: '/dashboard/services',
    icon: 'grid',
    adminOnly: true,
    match: (pathname) =>
      pathname === '/dashboard/services' || pathname.startsWith('/dashboard/services/'),
  },
  {
    id: 'payments',
    label: 'Payments',
    href: '/dashboard/payments',
    icon: 'receipt',
    adminOnly: true,
    match: (pathname) => pathname.startsWith('/dashboard/payments'),
  },
  {
    id: 'bookings',
    label: 'Bookings',
    href: '/dashboard/bookings',
    icon: 'calendar',
    adminOnly: true,
    match: (pathname) => pathname.startsWith('/dashboard/bookings'),
  },
  {
    id: 'masters',
    label: 'Masters',
    href: '/dashboard/masters',
    icon: 'clipboard-list',
    adminOnly: true,
    match: (pathname) => pathname.startsWith('/dashboard/masters'),
  },
  {
    id: 'operations',
    label: 'Operations',
    href: '/dashboard/operations',
    icon: 'layers',
    adminOnly: true,
    match: (pathname) => pathname.startsWith('/dashboard/operations'),
  },
  {
    id: 'rental-assets',
    label: 'Rental Assets',
    href: '/rental-assets',
    icon: 'building',
    adminOnly: true,
    match: (pathname) => pathname.startsWith('/rental-assets'),
  },
  {
    id: 'rental-invoices',
    label: 'Rental Invoices',
    href: '/rental-assets/invoices',
    icon: 'receipt',
    adminOnly: true,
    match: (pathname) => pathname.startsWith('/rental-assets/invoices'),
  },
  {
    id: 'rental-documents',
    label: 'Documents',
    href: '/rental-assets/documents',
    icon: 'file-text',
    adminOnly: true,
    match: (pathname) => pathname.startsWith('/rental-assets/documents'),
  },
];

export function isAdminPortalUser(isAdmin: boolean): boolean {
  return isAdmin;
}
