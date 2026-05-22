'use client';

import { cn } from '../cn';

import { Icon, type IconName } from './Icon';

import type { ButtonHTMLAttributes, JSX } from 'react';

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
  ...rest
}: ButtonProps): JSX.Element {
  const iconSize = iconSizeByButtonSize[size];
  const glyph = icon && !loading ? <Icon className="shrink-0" name={icon} size={iconSize} /> : null;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {!loading && iconPosition === 'start' ? glyph : null}
      {children}
      {!loading && iconPosition === 'end' ? glyph : null}
    </button>
  );
}
