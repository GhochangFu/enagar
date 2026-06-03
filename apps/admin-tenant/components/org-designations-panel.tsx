'use client';

import { Button } from '@enagar/ui';
import { useCallback, useEffect, useState } from 'react';

import { RecordListItem, RecordListPanel } from './record-list-panel';
import { useTenantAdminSession } from './tenant-admin-session';

type DepartmentRow = {
  id: string;
  code: string;
  name: unknown;
  sort_order: number;
  is_active: boolean;
  designation_count: number;
};

type DesignationRow = {
  id: string;
  code: string;
  name: unknown;
  scope: string;
  department_id: string | null;
  department_code: string | null;
  is_active: boolean;
  is_department_head: boolean;
  can_reject_municipal: boolean;
  user_count: number;
};

type StaffRow = {
  id: string;
  username: string;
  display_name: string;
};

type UserDesignationRow = {
  designation_id: string;
  designation_code: string;
};

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Untitled';
  }
  return 'Untitled';
}

const EMPTY_DEPT = { code: '', name_en: '', sort_order: '500', is_active: true };
const EMPTY_DESIG = {
  code: '',
  name_en: '',
  scope: 'department' as 'department' | 'municipality',
  department_id: '',
  is_department_head: false,
  can_reject_municipal: false,
  is_active: true,
};

export function OrgDesignationsPanel({
  onOrgChanged,
}: {
  /** Called after department/designation mutations so parent views (e.g. catalogue) can refresh lists. */
  onOrgChanged?: () => void;
} = {}): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [tab, setTab] = useState<'departments' | 'designations' | 'staff'>('departments');
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [designations, setDesignations] = useState<DesignationRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [selectedDeptCode, setSelectedDeptCode] = useState<string | null>(null);
  const [selectedDesigCode, setSelectedDesigCode] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [deptDraft, setDeptDraft] = useState(EMPTY_DEPT);
  const [desigDraft, setDesigDraft] = useState(EMPTY_DESIG);
  const [staffDesignationIds, setStaffDesignationIds] = useState<string[]>([]);

  const headers = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const loadAll = useCallback(async () => {
    if (!token) {
      setStatus('Sign in required to load organisation data.');
      return;
    }
    const errors: string[] = [];
    try {
      const [deptRes, desigRes, staffRes] = await Promise.all([
        fetch(`${apiBase}/admin/tenant/org/departments`, { headers: headers() }),
        fetch(`${apiBase}/admin/tenant/org/designations`, { headers: headers() }),
        fetch(`${apiBase}/admin/tenant/staff`, { headers: headers() }),
      ]);

      if (deptRes.ok) {
        setDepartments((await deptRes.json()) as DepartmentRow[]);
      } else {
        errors.push(`departments (${deptRes.status})`);
      }

      if (desigRes.ok) {
        setDesignations((await desigRes.json()) as DesignationRow[]);
      } else {
        errors.push(`designations (${desigRes.status})`);
      }

      if (staffRes.ok) {
        const staffRows = (await staffRes.json()) as Array<{
          id: string;
          username: string;
          display_name: string;
        }>;
        setStaff(
          staffRows.map((r) => ({
            id: r.id,
            username: r.username,
            display_name: r.display_name,
          })),
        );
      } else {
        errors.push(`staff (${staffRes.status})`);
      }

      if (errors.length > 0) {
        setStatus(
          `Could not load: ${errors.join(', ')}. Use a municipality/tenant admin account (not clerk-only). API: ${apiBase}`,
        );
      } else {
        setStatus(null);
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Load failed');
    }
  }, [apiBase, headers, token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadStaffDesignations = useCallback(
    async (userId: string) => {
      const res = await fetch(`${apiBase}/admin/tenant/org/users/${userId}/designations`, {
        headers: headers(),
      });
      if (!res.ok) {
        throw new Error('Failed to load staff designations');
      }
      const rows = (await res.json()) as UserDesignationRow[];
      setStaffDesignationIds(rows.map((r) => r.designation_id));
    },
    [apiBase, headers],
  );

  useEffect(() => {
    if (selectedStaffId) {
      void loadStaffDesignations(selectedStaffId).catch((err) =>
        setStatus(err instanceof Error ? err.message : 'Load failed'),
      );
    }
  }, [loadStaffDesignations, selectedStaffId]);

  async function saveDepartment(): Promise<void> {
    const isEdit = Boolean(selectedDeptCode);
    const url = isEdit
      ? `${apiBase}/admin/tenant/org/departments/${encodeURIComponent(selectedDeptCode!)}`
      : `${apiBase}/admin/tenant/org/departments`;
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: headers(),
      body: JSON.stringify(
        isEdit
          ? {
              name: { en: deptDraft.name_en, bn: deptDraft.name_en, hi: deptDraft.name_en },
              sort_order: Number(deptDraft.sort_order),
              is_active: deptDraft.is_active,
            }
          : {
              code: deptDraft.code.trim(),
              name: { en: deptDraft.name_en, bn: deptDraft.name_en, hi: deptDraft.name_en },
              sort_order: Number(deptDraft.sort_order),
              is_active: deptDraft.is_active,
            },
      ),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Save failed');
    }
    setSelectedDeptCode(null);
    setDeptDraft(EMPTY_DEPT);
    await loadAll();
    onOrgChanged?.();
    setStatus('Department saved.');
  }

  function newDepartment(): void {
    setSelectedDeptCode(null);
    setDeptDraft(EMPTY_DEPT);
    setStatus(null);
  }

  async function saveDesignation(): Promise<void> {
    const isEdit = Boolean(selectedDesigCode);
    const url = isEdit
      ? `${apiBase}/admin/tenant/org/designations/${encodeURIComponent(selectedDesigCode!)}`
      : `${apiBase}/admin/tenant/org/designations`;
    const body = isEdit
      ? {
          name: { en: desigDraft.name_en, bn: desigDraft.name_en, hi: desigDraft.name_en },
          is_active: desigDraft.is_active,
          is_department_head: desigDraft.is_department_head,
          can_reject_municipal: desigDraft.can_reject_municipal,
        }
      : {
          code: desigDraft.code.trim(),
          name: { en: desigDraft.name_en, bn: desigDraft.name_en, hi: desigDraft.name_en },
          scope: desigDraft.scope,
          department_id:
            desigDraft.scope === 'department' ? desigDraft.department_id || null : null,
          is_active: desigDraft.is_active,
          is_department_head: desigDraft.is_department_head,
          can_reject_municipal: desigDraft.can_reject_municipal,
        };
    const res = await fetch(url, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    setSelectedDesigCode(null);
    setDesigDraft(EMPTY_DESIG);
    await loadAll();
    onOrgChanged?.();
    setStatus('Designation saved.');
  }

  async function saveStaffDesignations(): Promise<void> {
    if (!selectedStaffId) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/org/users/${selectedStaffId}/designations`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ designation_ids: staffDesignationIds }),
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    setStatus('Staff designations updated.');
    await loadAll();
  }

  function toggleStaffDesignation(id: string): void {
    setStaffDesignationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-4">
      {status ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {status}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(['departments', 'designations', 'staff'] as const).map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            variant={tab === t ? 'primary' : 'secondary'}
            onClick={() => setTab(t)}
          >
            {t === 'departments' ? 'Departments' : t === 'designations' ? 'Designations' : 'Staff'}
          </Button>
        ))}
        <Button type="button" size="sm" variant="secondary" onClick={() => void loadAll()}>
          Refresh
        </Button>
      </div>

      {tab === 'departments' ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <RecordListPanel
            title="Departments"
            selectedKey={selectedDeptCode}
            onNew={newDepartment}
            newLabel="New department"
            emptyLabel="No departments yet. Use New department to add one."
          >
            {departments.map((row) => (
              <RecordListItem
                key={row.id}
                itemKey={row.code}
                selected={selectedDeptCode === row.code}
                onSelect={() => {
                  setSelectedDeptCode(row.code);
                  setDeptDraft({
                    code: row.code,
                    name_en: pickLabel(row.name),
                    sort_order: String(row.sort_order),
                    is_active: row.is_active,
                  });
                }}
                title={pickLabel(row.name)}
                subtitle={`${row.designation_count} designations`}
              />
            ))}
          </RecordListPanel>
          <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-ink-primary">
              {selectedDeptCode ? 'Edit department' : 'New department'}
            </h3>
            <div className="grid gap-3">
              <label className="text-xs font-medium uppercase text-ink-secondary">
                Code
                <input
                  className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case"
                  value={deptDraft.code}
                  disabled={Boolean(selectedDeptCode)}
                  onChange={(e) => setDeptDraft({ ...deptDraft, code: e.target.value })}
                />
              </label>
              <label className="text-xs font-medium uppercase text-ink-secondary">
                English name
                <input
                  className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case"
                  value={deptDraft.name_en}
                  onChange={(e) => setDeptDraft({ ...deptDraft, name_en: e.target.value })}
                />
              </label>
              <Button
                type="button"
                size="sm"
                onClick={() => void saveDepartment().catch((e) => setStatus(String(e)))}
              >
                Save department
              </Button>
            </div>
          </article>
        </section>
      ) : null}

      {tab === 'designations' ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <RecordListPanel
            title="Designations"
            emptyLabel="No designations. KMC seed includes hoarding/PWD samples; other ULBs get municipal roles only until you add department designations."
          >
            {designations.map((row) => (
              <RecordListItem
                key={row.id}
                itemKey={row.code}
                selected={selectedDesigCode === row.code}
                onSelect={() => {
                  setSelectedDesigCode(row.code);
                  setDesigDraft({
                    code: row.code,
                    name_en: pickLabel(row.name),
                    scope: row.scope as 'department' | 'municipality',
                    department_id: row.department_id ?? '',
                    is_department_head: row.is_department_head,
                    can_reject_municipal: row.can_reject_municipal,
                    is_active: row.is_active,
                  });
                }}
                title={pickLabel(row.name)}
                subtitle={`${row.scope}${row.department_code ? ` · ${row.department_code}` : ''}`}
              />
            ))}
          </RecordListPanel>
          <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-ink-primary">
              {selectedDesigCode ? 'Edit designation' : 'New designation'}
            </h3>
            <div className="grid gap-3">
              <label className="text-xs font-medium uppercase text-ink-secondary">
                Code (snake_case ok)
                <input
                  className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case"
                  value={desigDraft.code}
                  disabled={Boolean(selectedDesigCode)}
                  onChange={(e) => setDesigDraft({ ...desigDraft, code: e.target.value })}
                />
              </label>
              <label className="text-xs font-medium uppercase text-ink-secondary">
                English name
                <input
                  className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case"
                  value={desigDraft.name_en}
                  onChange={(e) => setDesigDraft({ ...desigDraft, name_en: e.target.value })}
                />
              </label>
              <label className="text-xs font-medium uppercase text-ink-secondary">
                Scope
                <select
                  className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case"
                  value={desigDraft.scope}
                  disabled={Boolean(selectedDesigCode)}
                  onChange={(e) =>
                    setDesigDraft({
                      ...desigDraft,
                      scope: e.target.value as 'department' | 'municipality',
                    })
                  }
                >
                  <option value="department">department</option>
                  <option value="municipality">municipality</option>
                </select>
              </label>
              {desigDraft.scope === 'department' && !selectedDesigCode ? (
                <label className="text-xs font-medium uppercase text-ink-secondary">
                  Department
                  <select
                    className="mt-1 w-full rounded border border-warm-border px-3 py-2 text-sm normal-case"
                    value={desigDraft.department_id}
                    onChange={(e) =>
                      setDesigDraft({ ...desigDraft, department_id: e.target.value })
                    }
                  >
                    <option value="">Select…</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {pickLabel(d.name)} ({d.code})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm normal-case">
                <input
                  type="checkbox"
                  checked={desigDraft.is_department_head}
                  onChange={(e) =>
                    setDesigDraft({ ...desigDraft, is_department_head: e.target.checked })
                  }
                />
                Department head (may reject)
              </label>
              <label className="flex items-center gap-2 text-sm normal-case">
                <input
                  type="checkbox"
                  checked={desigDraft.can_reject_municipal}
                  onChange={(e) =>
                    setDesigDraft({ ...desigDraft, can_reject_municipal: e.target.checked })
                  }
                />
                Municipal reject (Chairperson)
              </label>
              <Button
                type="button"
                size="sm"
                onClick={() => void saveDesignation().catch((e) => setStatus(String(e)))}
              >
                Save designation
              </Button>
            </div>
          </article>
        </section>
      ) : null}

      {tab === 'staff' ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <RecordListPanel title="Staff" emptyLabel="No staff users.">
            {staff.map((row) => (
              <RecordListItem
                key={row.id}
                itemKey={row.username}
                selected={selectedStaffId === row.id}
                onSelect={() => setSelectedStaffId(row.id)}
                title={row.display_name}
                subtitle={row.username}
              />
            ))}
          </RecordListPanel>
          <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
            <h3 className="mb-3 text-lg font-semibold text-ink-primary">Assign designations</h3>
            {!selectedStaffId ? (
              <p className="text-sm text-ink-secondary">Select a staff member.</p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {designations
                  .filter((d) => d.is_active)
                  .map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={staffDesignationIds.includes(d.id)}
                        onChange={() => toggleStaffDesignation(d.id)}
                      />
                      {pickLabel(d.name)} ({d.code})
                    </label>
                  ))}
              </div>
            )}
            <Button
              type="button"
              size="sm"
              className="mt-4"
              disabled={!selectedStaffId}
              onClick={() => void saveStaffDesignations().catch((e) => setStatus(String(e)))}
            >
              Save assignments
            </Button>
          </article>
        </section>
      ) : null}
    </div>
  );
}
