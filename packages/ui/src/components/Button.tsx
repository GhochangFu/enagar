'use client';

import { cn } from '../cn';

import { Icon, type IconName } from './Icon';
import { Slot } from './Slot';

import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react';

const variantClass = {
  primary: 'bg-brand text-brand-fg shadow-sm hover:opacity-95',
  secondary:
    'border border-warm-border bg-white text-ink-primary shadow-sm hover:bg-brand-muted/40',
  ghost: 'text-brand hover:bg-brand-muted',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
} as const;

const sizeClass = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
} as const;

const iconSizeByButtonSize = {
  sm: 14,
  md: 16,
  lg: 16,
} as const;

export type ButtonVariant = keyof typeof variantClass;
export type ButtonSize = keyof typeof sizeClass;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  /**
   * When true, render the single React child element instead of the
   * Button's own `<button>`. The child receives the Button's className,
   * icon glyph, and event handlers merged onto it via `Slot`. Use this
   * to render a `next/link` Link styled as a Button (e.g. a "New Asset"
   * CTA that navigates to a route instead of triggering an action).
   */
  asChild?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'start',
  className,
  disabled,
  children,
  type = 'button',
  asChild = false,
  ...rest
}: ButtonProps): JSX.Element {
  const iconSize = iconSizeByButtonSize[size];
  const glyph = icon && !loading ? <Icon className="shrink-0" name={icon} size={iconSize} /> : null;

  const baseClass = cn(
    'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variantClass[variant],
    sizeClass[size],
    className,
  );

  // Compose the body once. For `asChild` we render the child (a Link,
  // usually) via Slot and the body becomes its inner content; otherwise
  // we wrap the body in a real `<button>`.
  const body: ReactNode = (
    <>
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {!loading && iconPosition === 'start' ? glyph : null}
      {children}
      {!loading && iconPosition === 'end' ? glyph : null}
    </>
  );

  if (asChild) {
    return (
      <Slot className={baseClass} {...rest}>
        {children}
      </Slot>
    );
  }

  return (
    <button type={type} disabled={disabled || loading} className={baseClass} {...rest}>
      {body}
    </button>
  );
}
