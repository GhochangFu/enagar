'use client';

import { Button } from '@enagar/ui';
import { useCallback, useEffect, useState } from 'react';

import { useTenantAdminSession } from './tenant-admin-session';

type CategoryOption = { code: string; label: string };

type SlaRow = {
  id?: string;
  sort_order: number;
  category_match: string;
  grievance_priority_match: string;
  hours_to_resolve: string;
  orphan_category?: boolean;
};

type RoutingRow = {
  id?: string;
  sort_order: number;
  category_match: string;
  grievance_priority_match: string;
  ward_id: string;
  target_role_code: string;
  assign_user_id: string;
  orphan_category?: boolean;
};

const EMPTY_SLA: SlaRow = {
  sort_order: 0,
  category_match: '',
  grievance_priority_match: '',
  hours_to_resolve: '72',
};

const EMPTY_ROUTING: RoutingRow = {
  sort_order: 0,
  category_match: '',
  grievance_priority_match: '',
  ward_id: '',
  target_role_code: 'municipality_admin',
  assign_user_id: '',
};

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Untitled';
  }
  return 'Untitled';
}

export function GrievanceOperationsPanel(): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [slaRows, setSlaRows] = useState<SlaRow[]>([]);
  const [routingRows, setRoutingRows] = useState<RoutingRow[]>([]);

  const headers = {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };

  const load = useCallback(async () => {
    const [catRes, slaRes, routeRes] = await Promise.all([
      fetch(`${apiBase}/admin/tenant/grievance-catalogue/categories`, { headers }),
      fetch(`${apiBase}/admin/tenant/sla-policies`, { headers }),
      fetch(`${apiBase}/admin/tenant/grievance-routing-rules`, { headers }),
    ]);
    if (!catRes.ok || !slaRes.ok || !routeRes.ok) {
      throw new Error(`Load failed (${catRes.status}/${slaRes.status}/${routeRes.status})`);
    }
    const catJson = (await catRes.json()) as Array<{ code: string; name: unknown }>;
    setCategories(
      catJson.map((row) => ({ code: row.code, label: `${pickLabel(row.name)} (${row.code})` })),
    );
    const slaJson = (await slaRes.json()) as Array<{
      id: string;
      sort_order: number;
      category_match: string | null;
      grievance_priority_match: string | null;
      hours_to_resolve: number;
      orphan_category: boolean;
    }>;
    setSlaRows(
      slaJson.map((row) => ({
        id: row.id,
        sort_order: row.sort_order,
        category_match: row.category_match ?? '',
        grievance_priority_match: row.grievance_priority_match ?? '',
        hours_to_resolve: String(row.hours_to_resolve),
        orphan_category: row.orphan_category,
      })),
    );
    const routeJson = (await routeRes.json()) as Array<{
      id: string;
      sort_order: number;
      category_match: string | null;
      grievance_priority_match: string | null;
      ward_id: string | null;
      target_role_code: string;
      assign_user_id: string | null;
      orphan_category: boolean;
    }>;
    setRoutingRows(
      routeJson.map((row) => ({
        id: row.id,
        sort_order: row.sort_order,
        category_match: row.category_match ?? '',
        grievance_priority_match: row.grievance_priority_match ?? '',
        ward_id: row.ward_id ?? '',
        target_role_code: row.target_role_code,
        assign_user_id: row.assign_user_id ?? '',
        orphan_category: row.orphan_category,
      })),
    );
    setStatus(null);
  }, [apiBase, token]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setStatus(err instanceof Error ? err.message : 'Failed to load grievance operations');
    });
  }, [load]);

  async function saveSla(): Promise<void> {
    const policies = slaRows.map((row, index) => ({
      sort_order: row.sort_order ?? index,
      category_match: row.category_match.trim() || null,
      grievance_priority_match: row.grievance_priority_match.trim() || null,
      hours_to_resolve: Number.parseInt(row.hours_to_resolve, 10) || 72,
    }));
    const res = await fetch(`${apiBase}/admin/tenant/sla-policies`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ policies }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `SLA save failed (${res.status})`);
    }
    setSlaRows(
      (
        (await res.json()) as Array<{
          id: string;
          sort_order: number;
          category_match: string | null;
          grievance_priority_match: string | null;
          hours_to_resolve: number;
          orphan_category: boolean;
        }>
      ).map((row) => ({
        id: row.id,
        sort_order: row.sort_order,
        category_match: row.category_match ?? '',
        grievance_priority_match: row.grievance_priority_match ?? '',
        hours_to_resolve: String(row.hours_to_resolve),
        orphan_category: row.orphan_category,
      })),
    );
    setStatus('SLA policies saved.');
  }

  async function saveRouting(): Promise<void> {
    const rules = routingRows.map((row, index) => ({
      sort_order: row.sort_order ?? index,
      category_match: row.category_match.trim() || null,
      grievance_priority_match: row.grievance_priority_match.trim() || null,
      ward_id: row.ward_id.trim() || null,
      target_role_code: row.target_role_code.trim() || 'municipality_admin',
      assign_user_id: row.assign_user_id.trim() || null,
    }));
    const res = await fetch(`${apiBase}/admin/tenant/grievance-routing-rules`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ rules }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Routing save failed (${res.status})`);
    }
    setRoutingRows(
      (
        (await res.json()) as Array<{
          id: string;
          sort_order: number;
          category_match: string | null;
          grievance_priority_match: string | null;
          ward_id: string | null;
          target_role_code: string;
          assign_user_id: string | null;
          orphan_category: boolean;
        }>
      ).map((row) => ({
        id: row.id,
        sort_order: row.sort_order,
        category_match: row.category_match ?? '',
        grievance_priority_match: row.grievance_priority_match ?? '',
        ward_id: row.ward_id ?? '',
        target_role_code: row.target_role_code,
        assign_user_id: row.assign_user_id ?? '',
        orphan_category: row.orphan_category,
      })),
    );
    setStatus('Routing rules saved.');
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-forest">
              Sprint 6.22 · SLA policies
            </p>
            <h2 className="text-lg font-semibold text-ink-primary">Grievance SLA hours</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              First matching row wins. Leave category blank for a catch-all rule.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setSlaRows((rows) => [...rows, { ...EMPTY_SLA, sort_order: rows.length }])
              }
            >
              Add row
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void saveSla().catch((e) => setStatus(String(e)))}
            >
              Save SLA
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {slaRows.map((row, index) => (
            <SlaRuleRowEditor
              key={row.id ?? `sla-${index}`}
              row={row}
              categories={categories}
              onChange={(next) =>
                setSlaRows((rows) => rows.map((r, i) => (i === index ? next : r)))
              }
              onRemove={() => setSlaRows((rows) => rows.filter((_, i) => i !== index))}
            />
          ))}
          {!slaRows.length ? (
            <p className="text-sm text-ink-secondary">
              No SLA policies — add a row to define hours.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-forest">
              Sprint 6.22 · Routing
            </p>
            <h2 className="text-lg font-semibold text-ink-primary">Grievance routing rules</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Auto-assign role (and optional user) when a grievance is filed.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setRoutingRows((rows) => [...rows, { ...EMPTY_ROUTING, sort_order: rows.length }])
              }
            >
              Add row
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void saveRouting().catch((e) => setStatus(String(e)))}
            >
              Save routing
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {routingRows.map((row, index) => (
            <RoutingRuleRowEditor
              key={row.id ?? `route-${index}`}
              row={row}
              categories={categories}
              onChange={(next) =>
                setRoutingRows((rows) => rows.map((r, i) => (i === index ? next : r)))
              }
              onRemove={() => setRoutingRows((rows) => rows.filter((_, i) => i !== index))}
            />
          ))}
          {!routingRows.length ? (
            <p className="text-sm text-ink-secondary">No routing rules configured.</p>
          ) : null}
        </div>
      </section>

      {status ? <p className="text-sm text-ink-secondary">{status}</p> : null}
    </div>
  );
}

function SlaRuleRowEditor({
  row,
  categories,
  onChange,
  onRemove,
}: {
  row: SlaRow;
  categories: CategoryOption[];
  onChange: (row: SlaRow) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div
      className={[
        'grid gap-2 rounded-xl border p-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]',
        row.orphan_category ? 'border-amber-400 bg-amber-50/50' : 'border-warm-border',
      ].join(' ')}
    >
      <CategorySelect
        value={row.category_match}
        categories={categories}
        onChange={(value) => onChange({ ...row, category_match: value })}
      />
      <input
        className="rounded border border-warm-border px-2 py-1.5 text-sm"
        placeholder="Priority (optional)"
        value={row.grievance_priority_match}
        onChange={(e) => onChange({ ...row, grievance_priority_match: e.target.value })}
      />
      <input
        className="rounded border border-warm-border px-2 py-1.5 text-sm"
        placeholder="Hours"
        value={row.hours_to_resolve}
        onChange={(e) => onChange({ ...row, hours_to_resolve: e.target.value })}
      />
      {row.orphan_category ? (
        <span className="self-center text-xs text-amber-900">Unknown category</span>
      ) : (
        <span className="self-center text-xs text-ink-secondary">sort {row.sort_order}</span>
      )}
      <Button type="button" size="sm" variant="danger" onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

function RoutingRuleRowEditor({
  row,
  categories,
  onChange,
  onRemove,
}: {
  row: RoutingRow;
  categories: CategoryOption[];
  onChange: (row: RoutingRow) => void;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div
      className={[
        'grid gap-2 rounded-xl border p-3 md:grid-cols-2 lg:grid-cols-3',
        row.orphan_category ? 'border-amber-400 bg-amber-50/50' : 'border-warm-border',
      ].join(' ')}
    >
      <CategorySelect
        value={row.category_match}
        categories={categories}
        onChange={(value) => onChange({ ...row, category_match: value })}
      />
      <input
        className="rounded border border-warm-border px-2 py-1.5 text-sm"
        placeholder="Priority (optional)"
        value={row.grievance_priority_match}
        onChange={(e) => onChange({ ...row, grievance_priority_match: e.target.value })}
      />
      <input
        className="rounded border border-warm-border px-2 py-1.5 text-sm"
        placeholder="Target role code"
        value={row.target_role_code}
        onChange={(e) => onChange({ ...row, target_role_code: e.target.value })}
      />
      <input
        className="rounded border border-warm-border px-2 py-1.5 text-sm"
        placeholder="Ward UUID (optional)"
        value={row.ward_id}
        onChange={(e) => onChange({ ...row, ward_id: e.target.value })}
      />
      <input
        className="rounded border border-warm-border px-2 py-1.5 text-sm"
        placeholder="Assign user UUID (optional)"
        value={row.assign_user_id}
        onChange={(e) => onChange({ ...row, assign_user_id: e.target.value })}
      />
      <div className="flex items-center gap-2">
        {row.orphan_category ? (
          <span className="text-xs text-amber-900">Unknown category</span>
        ) : null}
        <Button type="button" size="sm" variant="danger" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function CategorySelect({
  value,
  categories,
  onChange,
}: {
  value: string;
  categories: CategoryOption[];
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <select
      className="rounded border border-warm-border px-2 py-1.5 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Any category</option>
      {categories.map((cat) => (
        <option key={cat.code} value={cat.code}>
          {cat.label}
        </option>
      ))}
    </select>
  );
}
