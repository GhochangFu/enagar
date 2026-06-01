'use client';

import {
  createContext,
  type JSX,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { cn } from '../cn';

import type { AlertBannerTone } from './AlertBanner';

type ToastItem = {
  id: string;
  message: string;
  tone: AlertBannerTone;
};

type ToastContextValue = {
  toast: (message: string, tone?: AlertBannerTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClass: Record<AlertBannerTone, string> = {
  info: 'border-info/30 bg-info-bg text-info',
  success: 'border-success/30 bg-success-bg text-success',
  warning: 'border-warning/40 bg-warning-bg text-warning',
  danger: 'border-danger/30 bg-danger-bg text-danger',
};

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: AlertBannerTone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [...prev, { id, message, tone }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[1000] flex w-full max-w-sm flex-col gap-2"
      >
        {items.map((item) => (
          <ToastItemView key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItemView({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}): JSX.Element {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), 4500);
    return () => window.clearTimeout(timer);
  }, [item.id, onDismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-md',
        toneClass[item.tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p>{item.message}</p>
        <button
          type="button"
          aria-label="Dismiss notification"
          className="shrink-0 text-xs font-semibold opacity-70 hover:opacity-100"
          onClick={() => onDismiss(item.id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
