'use client';

import { Button, Card, PageHeader } from '@enagar/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  BookingSummaryPanel,
  type BookingSummaryResponse,
} from '../../../components/booking-summary-panel';
import { BookingsCalendarPanel } from '../../../components/bookings-calendar-panel';
import { useTenantAdminSession } from '../../../components/tenant-admin-session';

type BookingsPayload = {
  assets: Array<{
    id: string;
    code: string;
    name: unknown;
    asset_type: string;
    capacity: number | null;
    is_active: boolean;
  }>;
  availability: Array<{
    id: string;
    asset_code: string;
    kind: string;
    starts_at: string;
    ends_at: string;
    note: string | null;
  }>;
  reservations: Array<{
    id: string;
    asset_code: string;
    docket_no: string | null;
    holder_name: string;
    starts_at: string;
    ends_at: string;
    status: string;
  }>;
};

function pickLabel(json: unknown): string {
  if (typeof json === 'string') return json;
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const rec = json as Record<string, unknown>;
    for (const key of ['en', 'bn', 'hi']) {
      const v = rec[key];
      if (typeof v === 'string' && v.trim()) return v;
    }
  }
  return '—';
}

export default function BookingsClient(): JSX.Element {
  const searchParams = useSearchParams();
  const { token, apiBase } = useTenantAdminSession();
  const [summary, setSummary] = useState<BookingSummaryResponse | null>(null);
  const [bookings, setBookings] = useState<BookingsPayload | null>(null);
  const [assetTypeFilter, setAssetTypeFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const loadAll = useCallback(async () => {
    if (!token) return;
    const [summaryRes, bookingsRes] = await Promise.all([
      fetch(`${apiBase}/admin/tenant/dashboard/booking-summary`, { headers: authHeaders() }),
      fetch(`${apiBase}/admin/tenant/bookings`, { headers: authHeaders() }),
    ]);
    if (summaryRes.ok) {
      setSummary((await summaryRes.json()) as BookingSummaryResponse);
    }
    if (bookingsRes.ok) {
      setBookings((await bookingsRes.json()) as BookingsPayload);
    }
  }, [apiBase, authHeaders, token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const asset = searchParams.get('asset');
    if (asset) {
      setAssetTypeFilter(asset.toUpperCase());
    }
  }, [searchParams]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Bookings"
        subtitle="Bookable assets — calendar, reservations, and recent activity"
        actions={
          <Button type="button" variant="secondary" onClick={() => void loadAll()}>
            Refresh
          </Button>
        }
      />

      <BookingSummaryPanel summary={summary} variant="full" />

      {bookings ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink-primary">Availability calendar</h2>
          <BookingsCalendarPanel
            assetFilter={assetFilter}
            assetTypeFilter={assetTypeFilter}
            assets={bookings.assets}
            availability={bookings.availability}
            onAssetFilterChange={setAssetFilter}
            onAssetTypeFilterChange={setAssetTypeFilter}
            onSelectEvent={() => undefined}
            pickLabel={pickLabel}
            reservations={bookings.reservations}
          />
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-ink-secondary">Loading calendar…</p>
        </Card>
      )}

      <p className="text-sm text-ink-secondary">
        Advanced ops (LED, health fleet, availability editing):{' '}
        <Link
          className="font-semibold text-brand hover:underline"
          href="/dashboard/operations?section=bookings"
        >
          Operations → Bookings
        </Link>
      </p>
    </div>
  );
}
