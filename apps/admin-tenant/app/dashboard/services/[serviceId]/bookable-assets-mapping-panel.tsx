'use client';

import Link from 'next/link';

import {
  filterBookableAssetsForService,
  serviceShowsBookableAssetMapping,
  workflowDefinitionIsBooking,
} from '../../../../lib/bookable-assets-mapping.util';

import type { Route } from 'next';

export { serviceShowsBookableAssetMapping, workflowDefinitionIsBooking };

export type BookableAssetRow = {
  code: string;
  name: unknown;
  asset_type?: string;
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

export function BookableAssetsMappingPanel({
  serviceCode,
  selectedCodes,
  assets,
  configCodesMissingFromDb,
  onToggle,
  onSave,
}: {
  serviceCode: string;
  selectedCodes: string[];
  assets: BookableAssetRow[];
  configCodesMissingFromDb?: string[];
  onToggle: (code: string, checked: boolean) => void;
  onSave: () => void;
}): JSX.Element {
  const activeAssets = filterBookableAssetsForService(serviceCode, assets);
  const selectedSet = new Set(selectedCodes);
  const staleConfigCodes = configCodesMissingFromDb ?? [];
  const isLedService = serviceCode === 'ad-led';
  const operationsPath = isLedService ? 'Operations → Advertising' : 'Operations → Bookings';
  const assetLabel = isLedService ? 'LED boards' : 'halls or facilities';

  return (
    <article className="rounded-xl border border-warm-border bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
            {isLedService ? 'LED slot booking' : 'Hall & facility booking'}
          </p>
          <h2 className="text-lg font-semibold text-ink-primary">
            Bookable assets for this service
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-ink-secondary">
            Citizens booking{' '}
            <span className="font-medium text-ink-primary">{serviceCode}</span> only see the assets
            you select here. Create {isLedService ? 'LED boards' : 'assets and availability'} under{' '}
            <Link
              href={'/dashboard/operations' as Route}
              className="font-medium text-brand hover:underline"
            >
              {operationsPath}
            </Link>
            , then link them below.
            {isLedService
              ? ' No workflow publish is required for direct LED slot booking.'
              : ' Save and publish the workflow after applying the booking template.'}
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

      {staleConfigCodes.length > 0 ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Service config still lists asset codes that are not in Operations → Bookings:{' '}
          <span className="font-mono">{staleConfigCodes.join(', ')}</span>. They are ignored until
          you create matching assets or save mapping with only real assets selected.
        </p>
      ) : null}

      {activeAssets.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No active {assetLabel} yet. Add one in {operationsPath}
          {isLedService ? '' : ', generate availability'}, then return here to link it to this
          service.
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
          No assets selected — citizens will not see any {assetLabel} for this service until you save
          at least one.
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
