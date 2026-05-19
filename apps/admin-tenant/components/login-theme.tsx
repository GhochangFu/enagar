'use client';

import { applyPlatformTheme } from '@enagar/tenant-theme';
import { useEffect } from 'react';

export function LoginTheme(): null {
  useEffect(() => {
    applyPlatformTheme();
  }, []);
  return null;
}
