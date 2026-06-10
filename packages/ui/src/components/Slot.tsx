'use client';

import { cloneElement, isValidElement } from 'react';

import type { JSX, ReactElement, ReactNode } from 'react';

/**
 * Minimal Radix-Slot-equivalent for `Button asChild`. The child element
 * (e.g. a `next/link` `Link`) is cloned, and the Button's own className
 * + event handlers + icon glyph are merged onto the child. The Button's
 * wrapping `<button>` is NOT rendered.
 *
 * Why not use `@radix-ui/react-slot`? It's a single peer-dependency we
 * don't otherwise need. This ~30-line shim is enough for the only
 * composition the operator surfaces use today (link-as-button).
 */
export function Slot({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  [key: string]: unknown;
}): JSX.Element {
  if (!isValidElement(children)) {
    // Defensive: if the caller passes a non-element child, fall back to
    // rendering it as-is so we don't crash a page on a typo.
    return <>{children}</>;
  }
  const child = children as ReactElement<{
    className?: string;
    children?: ReactNode;
  }>;
  const mergedClass = [child.props.className, className].filter(Boolean).join(' ');
  return cloneElement(child, {
    ...rest,
    className: mergedClass || undefined,
  });
}
