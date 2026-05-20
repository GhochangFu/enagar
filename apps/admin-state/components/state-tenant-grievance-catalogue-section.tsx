'use client';

import { Button } from '@enagar/ui';
import { useCallback, useEffect, useState } from 'react';

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Untitled';
  }
  return 'Untitled';
}

type OversightPayload = {
  tenant_code: string;
  adopted: Array<{
    code: string;
    name: unknown;
    source: string;
    global_category_code: string | null;
    is_active: boolean;
    subtype_count: number;
  }>;
  global_available: Array<{
    code: string;
    name: unknown;
    subtype_count: number;
    tenant_adoptions: number;
    is_active: boolean;
  }>;
};

export function StateTenantGrievanceCatalogueSection({
  tenantCode,
  api,
}: {
  tenantCode: string;
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}): JSX.Element {
  const [data, setData] = useState<OversightPayload | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const payload = await api<OversightPayload>(
      `/admin/state/tenants/${encodeURIComponent(tenantCode)}/grievance-catalogue`,
    );
    setData(payload);
  }, [api, tenantCode]);

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setStatus(err instanceof Error ? err.message : 'Failed to load grievance catalogue');
    });
  }, [refresh]);

  async function adoptCategory(code: string): Promise<void> {
    setStatus(null);
    await api<{ adopted: string[] }>(
      `/admin/state/tenants/${encodeURIComponent(tenantCode)}/grievance-catalogue/adopt`,
      {
        method: 'POST',
        body: JSON.stringify({ category_codes: [code] }),
      },
    );
    await refresh();
    setStatus(`Adopted ${code} for ${tenantCode}.`);
  }

  if (!data) {
    return (
      <div className="mt-4 rounded-xl border border-warm-border bg-canvas px-3 py-3 text-sm text-ink-secondary">
        {status ?? 'Loading grievance catalogue…'}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-warm-border bg-canvas p-4">
      <p className="text-sm font-semibold text-ink-primary">Grievance catalogue adoption</p>
      <p className="text-xs text-ink-secondary">
        Adopted rows appear in this municipality&apos;s citizen picker. Available global rows can be
        pushed from here without opening Tenant Admin.
      </p>

      <div>
        <p className="text-xs font-semibold uppercase text-ink-secondary">
          Adopted ({data.adopted.length})
        </p>
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
          {data.adopted.map((row) => (
            <li
              key={row.code}
              className="rounded-lg border border-warm-border bg-surface px-2 py-1.5"
            >
              <span className="font-semibold text-ink-primary">{pickLabel(row.name)}</span>
              <span className="block text-ink-secondary">
                {row.code} · {row.source} · {row.subtype_count} sub-types ·{' '}
                {row.is_active ? 'active' : 'inactive'}
              </span>
            </li>
          ))}
          {!data.adopted.length ? (
            <li className="text-ink-secondary">No adopted global categories yet.</li>
          ) : null}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-ink-secondary">
          Global available ({data.global_available.length})
        </p>
        <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs">
          {data.global_available.map((row) => (
            <li
              key={row.code}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warm-border bg-surface px-2 py-1.5"
            >
              <span>
                <span className="font-semibold text-ink-primary">{pickLabel(row.name)}</span>
                <span className="block text-ink-secondary">
                  {row.code} · {row.subtype_count} sub-types
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => void adoptCategory(row.code).catch((e) => setStatus(String(e)))}
              >
                Adopt
              </Button>
            </li>
          ))}
          {!data.global_available.length ? (
            <li className="text-ink-secondary">All active global categories are adopted.</li>
          ) : null}
        </ul>
      </div>

      {status ? <p className="text-xs text-ink-secondary">{status}</p> : null}
    </div>
  );
}
