import { Badge, Button, Icon } from '@enagar/ui';
import Link from 'next/link';

import { DataRow } from './data-row';
import { IconHeader } from './icon-header';
import { ModalShell } from './modal-shell';
import {
  ASSET_TYPE_LABELS,
  formatDate,
  formatRate,
  STATUS_LABELS,
  STATUS_TONE,
  type LeaseAgreement,
  type RentalAsset,
} from './types';

export function AssetDetailModal({
  asset,
  onClose,
  onViewLease,
}: {
  asset: RentalAsset | null;
  onClose: () => void;
  onViewLease: (lease: LeaseAgreement) => void;
}): JSX.Element | null {
  if (!asset) return null;
  const typeLabel = ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType;
  const nameEn = asset.name?.en ?? 'Unnamed asset';
  const locDesc =
    typeof asset.location?.description === 'string' ? asset.location.description : null;
  const activeLease = asset.agreements?.[0] ?? null;
  return (
    <ModalShell onClose={onClose} labelledBy="asset-detail-title">
      <IconHeader
        icon="building"
        eyebrow={typeLabel}
        title={nameEn}
        trailing={
          <Badge tone={STATUS_TONE[asset.status]} className="mt-1">
            {STATUS_LABELS[asset.status]}
          </Badge>
        }
      />
      <div className="mt-5 divide-y divide-warm-border rounded-xl border border-warm-border bg-canvas/40 p-4">
        <DataRow
          icon="wallet"
          label="Base Rate"
          value={formatRate(asset.baseLeaseRatePaise, asset.ratePeriod)}
        />
        <DataRow icon="calendar" label="Created" value={formatDate(asset.createdAt)} />
        <DataRow
          icon="map-pin"
          label="Location"
          value={locDesc ?? 'No location specified'}
          tone={locDesc ? undefined : 'neutral'}
        />
      </div>
      {activeLease ? (
        <div className="mt-5 rounded-xl border border-warm-border p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">
            Current Lessor
          </p>
          <p className="mt-1 text-base font-bold text-ink-primary">{activeLease.lessorName}</p>
          {activeLease.lessorPhone ? (
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-ink-secondary">
              <Icon name="phone" size={12} /> {activeLease.lessorPhone}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-ink-muted">
            Lease {formatDate(activeLease.startDate)} → {formatDate(activeLease.endDate)}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            icon="file-text"
            onClick={() => onViewLease(activeLease)}
          >
            View Lease Agreement
          </Button>
        </div>
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {asset.status === 'AVAILABLE' ? (
          <Button asChild icon="file-plus">
            <Link href={`/rental-assets/new?assetId=${asset.id}`}>Create Lease</Link>
          </Button>
        ) : null}
      </div>
    </ModalShell>
  );
}
