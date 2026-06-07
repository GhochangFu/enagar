'use client';

import { Button } from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { subtypesVisibleForCategory } from '../lib/grievance-catalogue-helpers';

import { RecordListItem, RecordListPanel } from './record-list-panel';
import { useTenantAdminSession } from './tenant-admin-session';

type CategoryRow = {
  id: string;
  code: string;
  name: unknown;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  subtype_count: number;
  source?: string;
  row_kind?: 'tenant' | 'global_available';
  can_adopt?: boolean;
  can_fork?: boolean;
  can_deactivate?: boolean;
};

type SubtypeRow = {
  id: string;
  code: string;
  name: unknown;
  sort_order: number;
  is_active: boolean;
};

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Untitled';
  }
  return 'Untitled';
}

const EMPTY_CATEGORY = {
  code: '',
  name_en: '',
  name_bn: '',
  name_hi: '',
  icon: 'MoreHorizontal',
  sort_order: '500',
  is_active: true,
};

const EMPTY_SUBTYPE = {
  code: '',
  name_en: '',
  name_bn: '',
  name_hi: '',
  sort_order: '0',
  is_active: true,
};

function formatPanelError(err: unknown): string {
  return err instanceof Error ? err.message : 'Save failed';
}

function validateCategoryDraft(draft: typeof EMPTY_CATEGORY, isEdit: boolean): string | null {
  const code = draft.code.trim();
  if (!isEdit && !code) {
    return 'Category code is required.';
  }
  if (!isEdit && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) {
    return 'Category code must be kebab-case (e.g. noise-pollution).';
  }
  if (!draft.name_en.trim()) {
    return 'English label is required.';
  }
  return null;
}

function nameToDraft(json: unknown): Pick<typeof EMPTY_SUBTYPE, 'name_en' | 'name_bn' | 'name_hi'> {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return {
      name_en: typeof record.en === 'string' ? record.en : '',
      name_bn: typeof record.bn === 'string' ? record.bn : '',
      name_hi: typeof record.hi === 'string' ? record.hi : '',
    };
  }
  return { name_en: '', name_bn: '', name_hi: '' };
}

export function GrievanceCataloguePanel(): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subtypes, setSubtypes] = useState<SubtypeRow[]>([]);
  /** Category code the current `subtypes` array belongs to (null while loading or stale). */
  const [subtypesLoadedForCode, setSubtypesLoadedForCode] = useState<string | null>(null);
  const [subtypesLoading, setSubtypesLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState(EMPTY_CATEGORY);
  const [editingCategoryCode, setEditingCategoryCode] = useState<string | null>(null);
  const [subtypeDraft, setSubtypeDraft] = useState(EMPTY_SUBTYPE);
  const [editingSubtypeCode, setEditingSubtypeCode] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const refreshCategories = useCallback(async () => {
    const res = await fetch(`${apiBase}/admin/tenant/grievance-catalogue/governance`, { headers });
    if (!res.ok) {
      throw new Error(`Catalogue failed (${res.status})`);
    }
    setCategories((await res.json()) as CategoryRow[]);
  }, [apiBase, headers]);

  useEffect(() => {
    void refreshCategories().catch((err: unknown) => {
      setStatus(err instanceof Error ? err.message : 'Failed to load categories');
    });
  }, [refreshCategories]);

  useEffect(() => {
    if (!selectedCode) {
      setSubtypes([]);
      setSubtypesLoadedForCode(null);
      setSubtypesLoading(false);
      return;
    }

    const selectedRow = categories.find((row) => row.code === selectedCode);
    if (selectedRow?.row_kind === 'global_available') {
      setSubtypes([]);
      setSubtypesLoadedForCode(null);
      setSubtypesLoading(false);
      return;
    }

    const code = selectedCode;
    setSubtypes([]);
    setSubtypesLoadedForCode(null);
    setSubtypesLoading(true);
    setEditingSubtypeCode(null);
    setSubtypeDraft(EMPTY_SUBTYPE);

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${apiBase}/admin/tenant/grievance-catalogue/categories/${encodeURIComponent(code)}/subtypes`,
          { headers },
        );
        if (!res.ok) {
          throw new Error(`Subtypes failed (${res.status})`);
        }
        const rows = (await res.json()) as SubtypeRow[];
        if (cancelled) {
          return;
        }
        setSubtypes(rows);
        setSubtypesLoadedForCode(code);
      } catch (err: unknown) {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : 'Failed to load subtypes');
        }
      } finally {
        if (!cancelled) {
          setSubtypesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBase, headers, selectedCode, categories]);

  const visibleSubtypes = subtypesVisibleForCategory(selectedCode, subtypesLoadedForCode, subtypes);

  async function adoptGlobal(code: string): Promise<void> {
    setStatus(null);
    const res = await fetch(
      `${apiBase}/admin/tenant/grievance-catalogue/global/${encodeURIComponent(code)}/adopt`,
      { method: 'POST', headers },
    );
    if (!res.ok) {
      throw new Error(`Adopt failed (${res.status})`);
    }
    await refreshCategories();
    selectCategory((await res.json()) as CategoryRow);
    setStatus('Global category adopted.');
  }

  async function forkCategory(code: string): Promise<void> {
    setStatus(null);
    const res = await fetch(
      `${apiBase}/admin/tenant/grievance-catalogue/categories/${encodeURIComponent(code)}/fork`,
      { method: 'POST', headers },
    );
    if (!res.ok) {
      throw new Error(`Fork failed (${res.status})`);
    }
    const row = (await res.json()) as CategoryRow;
    await refreshCategories();
    selectCategory(row);
    setStatus(`Forked as ${row.code}.`);
  }

  async function deactivateCategory(code: string): Promise<void> {
    setStatus(null);
    const res = await fetch(
      `${apiBase}/admin/tenant/grievance-catalogue/categories/${encodeURIComponent(code)}/deactivate`,
      { method: 'POST', headers },
    );
    if (!res.ok) {
      throw new Error(`Deactivate failed (${res.status})`);
    }
    await refreshCategories();
    setSelectedCode(null);
    setEditingCategoryCode(null);
    setCategoryDraft(EMPTY_CATEGORY);
    setStatus('Category deactivated (hidden from citizens).');
  }

  function selectCategory(row: CategoryRow): void {
    if (row.row_kind === 'global_available') {
      setSelectedCode(row.code);
      setEditingCategoryCode(null);
      setCategoryDraft(EMPTY_CATEGORY);
      setEditingSubtypeCode(null);
      setSubtypeDraft(EMPTY_SUBTYPE);
      setStatus(null);
      return;
    }
    setSelectedCode(row.code);
    setEditingCategoryCode(row.code);
    setCategoryDraft({
      code: row.code,
      ...nameToDraft(row.name),
      icon: row.icon ?? 'MoreHorizontal',
      sort_order: String(row.sort_order),
      is_active: row.is_active,
    });
    setStatus(null);
  }

  function beginNewCategory(): void {
    setSelectedCode(null);
    setEditingCategoryCode(null);
    setCategoryDraft(EMPTY_CATEGORY);
    setSubtypes([]);
    setSubtypesLoadedForCode(null);
    setSubtypesLoading(false);
    setEditingSubtypeCode(null);
    setSubtypeDraft(EMPTY_SUBTYPE);
    setStatus(null);
  }

  function selectSubtypeForEdit(row: SubtypeRow): void {
    setEditingSubtypeCode(row.code);
    setSubtypeDraft({
      code: row.code,
      ...nameToDraft(row.name),
      sort_order: String(row.sort_order),
      is_active: row.is_active,
    });
    setStatus(null);
  }

  function beginNewSubtype(): void {
    setEditingSubtypeCode(null);
    setSubtypeDraft(EMPTY_SUBTYPE);
    setStatus(null);
  }

  async function saveCategory(): Promise<void> {
    const validationError = validateCategoryDraft(categoryDraft, Boolean(editingCategoryCode));
    if (validationError) {
      setStatus(validationError);
      return;
    }

    setSavingCategory(true);
    setStatus(null);
    try {
      const namePayload = {
        en: categoryDraft.name_en.trim(),
        bn: categoryDraft.name_bn.trim() || categoryDraft.name_en.trim(),
        hi: categoryDraft.name_hi.trim() || categoryDraft.name_en.trim(),
      };
      const sortOrder = Number.parseInt(categoryDraft.sort_order, 10) || 500;

      if (editingCategoryCode) {
        const res = await fetch(
          `${apiBase}/admin/tenant/grievance-catalogue/categories/${encodeURIComponent(editingCategoryCode)}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              name: namePayload,
              icon: categoryDraft.icon.trim() || 'MoreHorizontal',
              sort_order: sortOrder,
              is_active: categoryDraft.is_active,
            }),
          },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(body?.message ?? `Category update failed (${res.status})`);
        }
        await refreshCategories();
        setStatus('Category updated.');
        return;
      }

      const res = await fetch(`${apiBase}/admin/tenant/grievance-catalogue/categories`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code: categoryDraft.code.trim(),
          name: namePayload,
          icon: categoryDraft.icon.trim() || 'MoreHorizontal',
          sort_order: sortOrder,
          is_active: categoryDraft.is_active,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Create failed (${res.status})`);
      }
      const row = (await res.json()) as CategoryRow;
      await refreshCategories();
      selectCategory(row);
      setStatus('Category saved.');
    } catch (err: unknown) {
      setStatus(formatPanelError(err));
    } finally {
      setSavingCategory(false);
    }
  }

  function handleCategoryFormSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void saveCategory();
  }

  async function saveSubtype(): Promise<void> {
    if (!selectedCode) {
      return;
    }
    setStatus(null);
    const namePayload = {
      en: subtypeDraft.name_en.trim(),
      bn: subtypeDraft.name_bn.trim() || subtypeDraft.name_en.trim(),
      hi: subtypeDraft.name_hi.trim() || subtypeDraft.name_en.trim(),
    };
    const sortOrder = Number.parseInt(subtypeDraft.sort_order, 10) || 0;

    if (editingSubtypeCode) {
      const res = await fetch(
        `${apiBase}/admin/tenant/grievance-catalogue/categories/${encodeURIComponent(selectedCode)}/subtypes/${encodeURIComponent(editingSubtypeCode)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            name: namePayload,
            sort_order: sortOrder,
            is_active: subtypeDraft.is_active,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Subtype update failed (${res.status})`);
      }
      setEditingSubtypeCode(null);
      setSubtypeDraft(EMPTY_SUBTYPE);
      const code = selectedCode;
      setSubtypesLoadedForCode(null);
      setSubtypesLoading(true);
      const refreshRes = await fetch(
        `${apiBase}/admin/tenant/grievance-catalogue/categories/${encodeURIComponent(code)}/subtypes`,
        { headers },
      );
      if (refreshRes.ok) {
        setSubtypes((await refreshRes.json()) as SubtypeRow[]);
        setSubtypesLoadedForCode(code);
      }
      setSubtypesLoading(false);
      await refreshCategories();
      setStatus('Sub-type updated.');
      return;
    }

    const res = await fetch(
      `${apiBase}/admin/tenant/grievance-catalogue/categories/${encodeURIComponent(selectedCode)}/subtypes`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code: subtypeDraft.code.trim(),
          name: namePayload,
          sort_order: sortOrder,
          is_active: subtypeDraft.is_active,
        }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? `Subtype create failed (${res.status})`);
    }
    setSubtypeDraft(EMPTY_SUBTYPE);
    const code = selectedCode;
    setSubtypesLoadedForCode(null);
    setSubtypesLoading(true);
    const refreshRes = await fetch(
      `${apiBase}/admin/tenant/grievance-catalogue/categories/${encodeURIComponent(code)}/subtypes`,
      { headers },
    );
    if (refreshRes.ok) {
      setSubtypes((await refreshRes.json()) as SubtypeRow[]);
      setSubtypesLoadedForCode(code);
    }
    setSubtypesLoading(false);
    await refreshCategories();
    setStatus('Sub-type saved.');
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <RecordListPanel
        title="Grievance categories"
        emptyLabel="No grievance categories yet."
        selectedKey={selectedCode}
        onNew={beginNewCategory}
        newLabel="New category"
      >
        {categories.map((row) => (
          <RecordListItem
            key={row.id}
            itemKey={row.code}
            title={pickLabel(row.name)}
            subtitle={`${row.source ?? 'tenant'} · ${row.subtype_count} sub-types · ${row.is_active ? 'active' : 'inactive'}`}
            selected={selectedCode === row.code}
            onSelect={() => selectCategory(row)}
          />
        ))}
      </RecordListPanel>

      <div className="space-y-6">
        {selectedCode && categories.find((row) => row.code === selectedCode && row.can_adopt) ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void adoptGlobal(selectedCode).catch((e) => setStatus(String(e)))}
            >
              Adopt global category
            </Button>
          </div>
        ) : null}

        {selectedCode && categories.find((row) => row.code === selectedCode && row.can_fork) ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void forkCategory(selectedCode).catch((e) => setStatus(String(e)))}
            >
              Fork local copy
            </Button>
            {categories.find((row) => row.code === selectedCode && row.can_deactivate) ? (
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() =>
                  void deactivateCategory(selectedCode).catch((e) => setStatus(String(e)))
                }
              >
                Deactivate
              </Button>
            ) : null}
          </div>
        ) : null}

        <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-ink-primary">
              {editingCategoryCode ? `Edit category · ${editingCategoryCode}` : 'Add category'}
            </h3>
            {editingCategoryCode ? (
              <Button type="button" size="sm" variant="secondary" onClick={beginNewCategory}>
                Add new
              </Button>
            ) : null}
          </div>
          <form className="mt-4 grid gap-3" onSubmit={handleCategoryFormSubmit}>
            <input
              className="rounded border border-warm-border px-3 py-2 text-sm disabled:bg-canvas"
              placeholder="code (e.g. noise-pollution)"
              value={categoryDraft.code}
              disabled={Boolean(editingCategoryCode)}
              required={!editingCategoryCode}
              onChange={(e) => setCategoryDraft({ ...categoryDraft, code: e.target.value })}
            />
            <input
              className="rounded border border-warm-border px-3 py-2 text-sm"
              placeholder="English label"
              value={categoryDraft.name_en}
              required
              onChange={(e) => setCategoryDraft({ ...categoryDraft, name_en: e.target.value })}
            />
            <input
              className="rounded border border-warm-border px-3 py-2 text-sm"
              placeholder="Bengali label (optional)"
              value={categoryDraft.name_bn}
              onChange={(e) => setCategoryDraft({ ...categoryDraft, name_bn: e.target.value })}
            />
            <input
              className="rounded border border-warm-border px-3 py-2 text-sm"
              placeholder="Hindi label (optional)"
              value={categoryDraft.name_hi}
              onChange={(e) => setCategoryDraft({ ...categoryDraft, name_hi: e.target.value })}
            />
            <input
              className="rounded border border-warm-border px-3 py-2 text-sm"
              placeholder="Icon (Lucide name)"
              value={categoryDraft.icon}
              onChange={(e) => setCategoryDraft({ ...categoryDraft, icon: e.target.value })}
            />
            <input
              className="rounded border border-warm-border px-3 py-2 text-sm"
              placeholder="Sort order"
              inputMode="numeric"
              value={categoryDraft.sort_order}
              onChange={(e) => setCategoryDraft({ ...categoryDraft, sort_order: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-ink-primary">
              <input
                type="checkbox"
                checked={categoryDraft.is_active}
                onChange={(e) =>
                  setCategoryDraft({ ...categoryDraft, is_active: e.target.checked })
                }
              />
              Active (shown to citizens)
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" loading={savingCategory} disabled={savingCategory}>
                {editingCategoryCode ? 'Save changes' : 'Save category'}
              </Button>
              {editingCategoryCode ? (
                <Button type="button" size="sm" variant="secondary" onClick={beginNewCategory}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </article>

        {selectedCode &&
        categories.find((row) => row.code === selectedCode)?.row_kind !== 'global_available' ? (
          <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-ink-primary">
                Sub-types for {selectedCode}
              </h3>
              {editingSubtypeCode ? (
                <Button type="button" size="sm" variant="secondary" onClick={beginNewSubtype}>
                  Add new
                </Button>
              ) : null}
            </div>
            {subtypesLoading ? (
              <p className="mt-3 text-sm text-ink-secondary">Loading sub-types…</p>
            ) : null}
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
              {visibleSubtypes.map((row) => (
                <li key={row.id}>
                  <RecordListItem
                    itemKey={row.code}
                    selected={editingSubtypeCode === row.code}
                    title={pickLabel(row.name)}
                    subtitle={`${row.is_active ? 'active' : 'inactive'} · sort ${row.sort_order}`}
                    onSelect={() => selectSubtypeForEdit(row)}
                  />
                </li>
              ))}
              {!subtypesLoading && !visibleSubtypes.length ? (
                <li className="rounded-xl border border-dashed border-warm-border px-3 py-4 text-center text-ink-secondary">
                  No sub-types yet.
                </li>
              ) : null}
            </ul>
            <div className="mt-4 grid gap-3">
              <p className="text-sm font-semibold text-ink-primary">
                {editingSubtypeCode ? `Edit sub-type · ${editingSubtypeCode}` : 'Add sub-type'}
              </p>
              <input
                className="rounded border border-warm-border px-3 py-2 text-sm disabled:bg-canvas"
                placeholder="subtype code"
                value={subtypeDraft.code}
                disabled={Boolean(editingSubtypeCode)}
                onChange={(e) => setSubtypeDraft({ ...subtypeDraft, code: e.target.value })}
              />
              <input
                className="rounded border border-warm-border px-3 py-2 text-sm"
                placeholder="English label"
                value={subtypeDraft.name_en}
                onChange={(e) => setSubtypeDraft({ ...subtypeDraft, name_en: e.target.value })}
              />
              <input
                className="rounded border border-warm-border px-3 py-2 text-sm"
                placeholder="Bengali label (optional)"
                value={subtypeDraft.name_bn}
                onChange={(e) => setSubtypeDraft({ ...subtypeDraft, name_bn: e.target.value })}
              />
              <input
                className="rounded border border-warm-border px-3 py-2 text-sm"
                placeholder="Hindi label (optional)"
                value={subtypeDraft.name_hi}
                onChange={(e) => setSubtypeDraft({ ...subtypeDraft, name_hi: e.target.value })}
              />
              <input
                className="rounded border border-warm-border px-3 py-2 text-sm"
                placeholder="Sort order"
                inputMode="numeric"
                value={subtypeDraft.sort_order}
                onChange={(e) => setSubtypeDraft({ ...subtypeDraft, sort_order: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm text-ink-primary">
                <input
                  type="checkbox"
                  checked={subtypeDraft.is_active}
                  onChange={(e) =>
                    setSubtypeDraft({ ...subtypeDraft, is_active: e.target.checked })
                  }
                />
                Active (shown to citizens)
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveSubtype().catch((e) => setStatus(String(e)))}
                >
                  {editingSubtypeCode ? 'Save changes' : 'Save sub-type'}
                </Button>
                {editingSubtypeCode ? (
                  <Button type="button" size="sm" variant="secondary" onClick={beginNewSubtype}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ) : null}

        {status ? <p className="text-sm text-ink-secondary">{status}</p> : null}
      </div>
    </div>
  );
}
