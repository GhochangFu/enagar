'use client';

import Link from 'next/link';

import type { WorkflowDefinition } from '@enagar/workflow';
import type { Route } from 'next';

type BookableAssetRow = {
  code: string;
  name: unknown;
  is_active: boolean;
};

function pickAssetLabel(name: unknown, code: string): string {
  if (name && typeof name === 'object' && !Array.isArray(name)) {
    const record = name as Record<string, unknown>;
    if (typeof record.en === 'string' && record.en.trim()) {
      return record.en;
    }
  }
  return code;
}

/** True when the workflow draft uses the hall booking pattern (template or equivalent stages). */
export function workflowDefinitionIsBooking(
  workflow: Pick<WorkflowDefinition, 'code' | 'stages' | 'transitions'> | null | undefined,
): boolean {
  if (!workflow) {
    return false;
  }
  const code = workflow.code?.trim() ?? '';
  if (code === 'booking-v1' || code.endsWith('-booking-v1')) {
    return true;
  }
  if (workflow.stages?.some((stage) => stage.code === 'slot-review')) {
    return true;
  }
  if (workflow.transitions?.some((transition) => transition.verb === 'review-slot')) {
    return true;
  }
  return false;
}

export function BookableAssetsMappingPanel({
  serviceCode,
  selectedCodes,
  assets,
  onToggle,
  onSave,
}: {
  serviceCode: string;
  selectedCodes: string[];
  assets: BookableAssetRow[];
  onToggle: (code: string, checked: boolean) => void;
  onSave: () => void;
}): JSX.Element {
  const activeAssets = assets.filter((asset) => asset.is_active);
  const selectedSet = new Set(selectedCodes);

  return (
    <article className="rounded-xl border border-warm-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
            Hall &amp; facility booking
          </p>
          <h2 className="text-lg font-semibold text-ink-primary">
            Bookable assets for this service
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-ink-secondary">
            Citizens applying for{' '}
            <span className="font-medium text-ink-primary">{serviceCode}</span> only see the assets
            you select here. Create assets and availability under{' '}
            <Link
              href={'/dashboard/operations' as Route}
              className="font-medium text-brand hover:underline"
            >
              Operations → Bookings
            </Link>
            , then link them below. Save and publish the workflow after applying the booking
            template.
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          className="rounded bg-brand px-3 py-2 text-xs font-medium text-brand-fg hover:bg-brand-hover"
        >
          Save asset mapping
        </button>
      </div>

      {activeAssets.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No active bookable assets yet. Add one in Operations → Bookings, generate availability,
          then return here to link it to this service.
        </p>
      ) : (
        <ul className="space-y-2">
          {activeAssets.map((asset) => {
            const checked = selectedSet.has(asset.code);
            return (
              <li
                key={asset.code}
                className="flex items-start gap-3 rounded-lg border border-warm-border bg-canvas px-4 py-3"
              >
                <input
                  id={`bookable-asset-${asset.code}`}
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  onChange={(event) => onToggle(asset.code, event.target.checked)}
                />
                <label
                  htmlFor={`bookable-asset-${asset.code}`}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <span className="block text-sm font-medium text-ink-primary">
                    {pickAssetLabel(asset.name, asset.code)}
                  </span>
                  <span className="font-mono text-xs text-ink-secondary">{asset.code}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {selectedCodes.length === 0 && activeAssets.length > 0 ? (
        <p className="mt-3 text-xs text-amber-800">
          No assets selected — citizens will not see any halls for this service until you save at
          least one.
        </p>
      ) : null}

      {assets.some((asset) => !asset.is_active) ? (
        <p className="mt-3 text-xs text-ink-secondary">
          Inactive assets are hidden here. Reactivate them in Operations → Bookings if needed.
        </p>
      ) : null}
    </article>
  );
}
