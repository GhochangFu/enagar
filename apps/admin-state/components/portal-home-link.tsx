'use client';

import { resolvePortalHubHomeUrl } from '../lib/portal-hub-url';

export function PortalHomeLink({ className }: { className?: string }): JSX.Element {
  const href =
    typeof window !== 'undefined'
      ? resolvePortalHubHomeUrl(window.location.hostname)
      : resolvePortalHubHomeUrl();

  return (
    <a
      href={href}
      className={
        className ??
        'text-sm font-semibold text-platform-accent underline decoration-platform-accent/30 underline-offset-2 hover:opacity-90'
      }
    >
      Home — eNagar portal
    </a>
  );
}
