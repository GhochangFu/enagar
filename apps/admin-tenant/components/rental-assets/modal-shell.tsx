import { Icon } from '@enagar/ui';

import type { JSX, ReactNode } from 'react';

/**
 * Shared modal chrome — overlay, click-to-close, focus trap border, close
 * button. Lets every detail/editor modal below just render its own body and
 * stay focused on the actual content. The `size` prop keeps three widths in
 * one place (sm for editor, md for detail, lg for invoice-detail drawer).
 */
export function ModalShell({
  children,
  onClose,
  labelledBy,
  size = 'md',
  z = 'z-50',
}: {
  children: ReactNode;
  onClose: () => void;
  labelledBy?: string;
  size?: 'sm' | 'md' | 'lg';
  z?: string;
}): JSX.Element {
  const widthClass = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={`fixed inset-0 ${z} flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm`}
      onClick={onClose}
    >
      <div
        className={`relative w-full ${widthClass} rounded-2xl border border-warm-border bg-surface p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-muted transition hover:bg-canvas hover:text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/40"
        >
          <Icon name="close" size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}
