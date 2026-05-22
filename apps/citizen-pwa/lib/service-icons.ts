import type { IconName } from '@enagar/ui';

/** Maps catalogue category codes to hub/service card icons. */
export function serviceCategoryIcon(categoryCode: string): IconName {
  switch (categoryCode) {
    case 'certificates':
      return 'file-text';
    case 'tax-property':
      return 'receipt';
    case 'trade-licence':
      return 'clipboard-list';
    case 'bookings':
      return 'layers';
    case 'grievances':
      return 'megaphone';
    case 'rti':
      return 'file-text';
    case 'health':
      return 'user';
    default:
      return 'file-text';
  }
}
