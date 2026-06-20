'use client';

import { Button } from '@enagar/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { JSX } from 'react';

export type DeptMultiSelectOption = {
  code: string;
  label: string;
};

export function DeptMultiSelect({
  departments,
  selectedCodes,
  onChange,
}: {
  departments: DeptMultiSelectOption[];
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (dept) => dept.label.toLowerCase().includes(q) || dept.code.toLowerCase().includes(q),
    );
  }, [departments, query]);

  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);

  const triggerLabel = useMemo(() => {
    if (selectedCodes.length === 0) {
      return 'All departments';
    }
    if (selectedCodes.length === 1) {
      const dept = departments.find((d) => d.code === selectedCodes[0]);
      return dept?.label ?? selectedCodes[0];
    }
    const preview = selectedCodes
      .slice(0, 2)
      .map((code) => departments.find((d) => d.code === code)?.label ?? code)
      .join(', ');
    const extra = selectedCodes.length > 2 ? ` +${selectedCodes.length - 2}` : '';
    return `${preview}${extra}`;
  }, [departments, selectedCodes]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function toggleCode(code: string): void {
    if (selectedSet.has(code)) {
      onChange(selectedCodes.filter((entry) => entry !== code));
      return;
    }
    onChange([...selectedCodes, code]);
  }

  function selectAll(): void {
    onChange(departments.map((dept) => dept.code));
  }

  function clearAll(): void {
    onChange([]);
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-warm-border bg-surface px-3 py-2 text-left text-sm text-ink-primary hover:border-brand/40"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 truncate">
          <span className="font-semibold">Departments · </span>
          <span className="text-ink-secondary">{triggerLabel}</span>
        </span>
        <span className="text-xs text-ink-secondary">{open ? '▴' : '▾'}</span>
      </button>

      {open ? (
        <div
          className="absolute z-20 mt-2 w-full min-w-[16rem] rounded-xl border border-warm-border bg-surface p-3 shadow-lg"
          role="listbox"
          aria-multiselectable="true"
          aria-label="Filter by department"
        >
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search departments…"
            className="mb-3 w-full rounded-lg border border-warm-border px-3 py-2 text-sm"
          />
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {filtered.length ? (
              filtered.map((dept) => {
                const checked = selectedSet.has(dept.code);
                return (
                  <li key={dept.code}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-brand-muted/30">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() => toggleCode(dept.code)}
                      />
                      <span className="text-sm text-ink-primary">{dept.label}</span>
                    </label>
                  </li>
                );
              })
            ) : (
              <li className="px-2 py-2 text-sm text-ink-secondary">No departments match.</li>
            )}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-warm-border pt-3">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={selectAll}>
                Select all
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
                Clear
              </Button>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
