'use client';

import { applyStateAdminTheme } from '@enagar/tenant-theme';
import { useEffect } from 'react';

export function StateLoginTheme(): null {
  useEffect(() => {
    applyStateAdminTheme();
  }, []);
  return null;
}
