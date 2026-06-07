'use client';

import {
  formatIstTimeRange,
  isSlotInsideSelection,
  type BookableSlot,
  type BookingDurationRules,
  type SlotSelection,
} from '../lib/booking-slot-grid';

import type { PwaLocaleCode } from '../lib/workspace-types';
import type { JSX } from 'react';

type BookingHourGridProps = {
  slots: BookableSlot[];
  selected: SlotSelection;
  rules: BookingDurationRules;
  locale: PwaLocaleCode;
  onSelectSlot: (slot: BookableSlot) => void;
  selectionAnnouncement: string | null;
};

export function BookingHourGrid({
  slots,
  selected,
  rules,
  locale,
  onSelectSlot,
  selectionAnnouncement,
}: BookingHourGridProps): JSX.Element {
  const localeTag = locale === 'bn' ? 'bn-IN' : locale === 'hi' ? 'hi-IN' : 'en-IN';

  return (
    <div>
      <p className="text-sm text-slate-600">
        Select contiguous free hours ({rules.minMinutes / 60}–{rules.maxMinutes / 60} h max).
      </p>
      <div
        aria-label="Hourly booking slots"
        className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3"
        role="list"
      >
        {slots.map((slot) => {
          const taken = slot.status === 'taken';
          const active = isSlotInsideSelection(slot, selected);
          const label = formatIstTimeRange(slot.starts_at, slot.ends_at, localeTag);
          if (taken) {
            return (
              <div
                aria-label={`${label}, taken`}
                className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-sm text-slate-500"
                key={slot.starts_at}
                role="listitem"
              >
                <span className="font-medium">{label}</span>
                <span className="mt-1 block text-xs uppercase tracking-wide">Taken</span>
              </div>
            );
          }
          return (
            <button
              aria-label={`${label}, available${active ? ', selected' : ''}`}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                active
                  ? 'border-brand bg-brand/10 font-semibold text-brand'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-brand'
              }`}
              key={slot.starts_at}
              onClick={() => onSelectSlot(slot)}
              type="button"
            >
              <span className="font-medium">{label}</span>
              <span className="mt-1 block text-xs uppercase tracking-wide text-emerald-800">
                Free
              </span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="sr-only">
        {selectionAnnouncement}
      </p>
    </div>
  );
}
