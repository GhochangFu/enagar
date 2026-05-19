'use client';

import { applyStateAdminTheme } from '@enagar/tenant-theme';
import { useEffect } from 'react';

/** Applies platform teal brand tokens for authenticated state dashboard routes. */
export function StateDashboardTheme(): null {
  useEffect(() => {
    applyStateAdminTheme();
  }, []);
  return null;
}
