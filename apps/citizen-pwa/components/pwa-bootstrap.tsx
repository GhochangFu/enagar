'use client';

import { useEffect, type ReactNode } from 'react';

/** Registers the minimal service worker in production builds (Master Sprint 5.4). */
export function PwaBootstrap({ children }: { children: ReactNode }): JSX.Element {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return <>{children}</>;
}
