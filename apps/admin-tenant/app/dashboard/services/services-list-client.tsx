'use client';

import {
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableElement,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  PageHeader,
  PaginationBar,
  useClientPagination,
  useToast,
} from '@enagar/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from '../../../components/tenant-admin-session';

type ServiceRow = {
  id: string;
  code: string;
  name: unknown;
  description: unknown;
  is_active: boolean;
  effective_sla_days: number | null;
  updated_at: string;
};

function pickLabel(json: unknown): string {
  if (typeof json === 'string') {
    return json;
  }
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const rec = json as Record<string, unknown>;
    for (const key of ['en', 'bn', 'hi']) {
      const v = rec[key];
      if (typeof v === 'string' && v.trim()) {
        return v;
      }
    }
    const first = Object.values(rec).find((x) => typeof x === 'string' && x.trim());
    if (typeof first === 'string') {
      return first;
    }
  }
  return '—';
}

export default function ServicesListClient(): JSX.Element {
  const { toast } = useToast();
  const { token, apiBase } = useTenantAdminSession();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [slaDrafts, setSlaDrafts] = useState<Record<string, string>>({});
  const [tableQuery, setTableQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const loadServices = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/admin/tenant/services`, { headers: authHeaders() });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        toast(`Failed to load services (${res.status}): ${body.slice(0, 120)}`, 'danger');
        return;
      }
      const svcJson = (await res.json()) as ServiceRow[];
      setServices(svcJson);
      const drafts: Record<string, string> = {};
      for (const row of svcJson) {
        drafts[row.id] =
          row.effective_sla_days === null || row.effective_sla_days === undefined
            ? ''
            : String(row.effective_sla_days);
      }
      setSlaDrafts(drafts);
    } catch {
      toast('Network error loading services.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [apiBase, authHeaders, toast, token]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  async function patchService(serviceId: string, body: Record<string, unknown>): Promise<void> {
    if (!token) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      toast(`Save failed (${res.status}): ${errText.slice(0, 180)}`, 'danger');
      await loadServices();
      return;
    }
    const updated = (await res.json()) as ServiceRow;
    setServices((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    toast('Service updated.', 'success');
  }

  const filteredServices = useMemo(
    () =>
      services.filter((row) => {
        const q = tableQuery.trim().toLowerCase();
        if (!q) return true;
        return row.code.toLowerCase().includes(q) || pickLabel(row.name).toLowerCase().includes(q);
      }),
    [services, tableQuery],
  );

  const pagination = useClientPagination(filteredServices, { pageSize: 25 });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Tenant Admin"
        title="Service Catalogue"
        subtitle="Published services — activate, set SLA days, and open the designer"
        actions={
          <Button type="button" variant="secondary" onClick={() => void loadServices()}>
            Refresh
          </Button>
        }
      />

      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
          <p className="text-sm text-ink-secondary">
            {loading ? 'Loading…' : `${filteredServices.length} service(s)`}
          </p>
        </div>

        <DataTable
          toolbar={
            <input
              type="search"
              value={tableQuery}
              onChange={(event) => setTableQuery(event.target.value)}
              placeholder="Search services…"
              className="w-full max-w-xs rounded-xl border border-warm-border bg-surface px-3 py-2 text-sm text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 md:max-w-sm"
            />
          }
        >
          <DataTableElement>
            <DataTableHead>
              <tr>
                <DataTableHeaderCell>Active</DataTableHeaderCell>
                <DataTableHeaderCell>Code</DataTableHeaderCell>
                <DataTableHeaderCell>Name</DataTableHeaderCell>
                <DataTableHeaderCell>SLA days</DataTableHeaderCell>
                <DataTableHeaderCell>Updated</DataTableHeaderCell>
                <DataTableHeaderCell>Designer</DataTableHeaderCell>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {pagination.pageItems.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-warm-border"
                      checked={row.is_active}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setServices((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)),
                        );
                        void patchService(row.id, { is_active: next });
                      }}
                    />
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs">{row.code}</DataTableCell>
                  <DataTableCell className="max-w-xs truncate">{pickLabel(row.name)}</DataTableCell>
                  <DataTableCell>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        className="w-24 rounded-lg border border-warm-border px-2 py-1.5 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                        value={slaDrafts[row.id] ?? ''}
                        onChange={(e) => setSlaDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const raw = slaDrafts[row.id]?.trim() ?? '';
                          const n = raw === '' ? undefined : Number.parseInt(raw, 10);
                          if (n === undefined || Number.isNaN(n) || n < 0) {
                            toast('SLA days must be a non-negative integer.', 'warning');
                            return;
                          }
                          void patchService(row.id, { effective_sla_days: n });
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-xs text-ink-secondary">
                    {new Date(row.updated_at).toLocaleString()}
                  </DataTableCell>
                  <DataTableCell>
                    <Link
                      href={`/dashboard/services/${row.id}`}
                      className="inline-flex rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-brand-fg hover:bg-brand-hover"
                    >
                      Configure
                    </Link>
                  </DataTableCell>
                </DataTableRow>
              ))}
              {!loading && !filteredServices.length ? (
                <DataTableRow>
                  <DataTableCell colSpan={6}>
                    <span className="text-sm text-ink-secondary">
                      No services match your search.
                    </span>
                  </DataTableCell>
                </DataTableRow>
              ) : null}
            </DataTableBody>
          </DataTableElement>
        </DataTable>
        {!loading && filteredServices.length > 0 ? (
          <PaginationBar
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        ) : null}
      </section>
    </div>
  );
}
