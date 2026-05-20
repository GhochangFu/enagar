'use client';

import { Button } from '@enagar/ui';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { RecordListItem, RecordListPanel } from './record-list-panel';

type CategoryRow = {
  code: string;
  name: unknown;
  icon: string | null;
  docket_code: string | null;
  sort_order: number;
  is_active: boolean;
  subtype_count: number;
  tenant_adoptions: number;
};

type SubtypeRow = {
  id: string;
  code: string;
  name: unknown;
  sort_order: number;
  is_active: boolean;
};

const EMPTY_CATEGORY = {
  code: '',
  name_en: '',
  name_bn: '',
  name_hi: '',
  icon: 'MoreHorizontal',
  docket_code: '',
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

function pickLabel(json: unknown): string {
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const record = json as Record<string, unknown>;
    return typeof record.en === 'string' ? record.en : 'Untitled';
  }
  return 'Untitled';
}

function formatPanelError(err: unknown): string {
  return err instanceof Error ? err.message : 'Save failed';
}

function validateCategoryDraft(draft: typeof EMPTY_CATEGORY, isEdit: boolean): string | null {
  const code = draft.code.trim();
  if (!isEdit && !code) {
    return 'Category code is required.';
  }
  if (!isEdit && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) {
    return 'Category code must be kebab-case (e.g. broken-streetlight).';
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

export function StateGrievanceLibraryPanel({
  api,
}: {
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}): JSX.Element {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subtypes, setSubtypes] = useState<SubtypeRow[]>([]);
  const [subtypesLoadedForCode, setSubtypesLoadedForCode] = useState<string | null>(null);
  const [subtypesLoading, setSubtypesLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState(EMPTY_CATEGORY);
  const [editingCategoryCode, setEditingCategoryCode] = useState<string | null>(null);
  const [subtypeDraft, setSubtypeDraft] = useState(EMPTY_SUBTYPE);
  const [editingSubtypeCode, setEditingSubtypeCode] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingSubtype, setSavingSubtype] = useState(false);

  const refreshCategories = useCallback(async () => {
    const rows = await api<CategoryRow[]>('/admin/state/grievance-library/categories');
    setCategories(rows);
  }, [api]);

  useEffect(() => {
    void refreshCategories().catch((err: unknown) => {
      setStatus(err instanceof Error ? err.message : 'Failed to load global categories');
    });
  }, [refreshCategories]);

  useEffect(() => {
    if (!selectedCode) {
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
        const rows = await api<SubtypeRow[]>(
          `/admin/state/grievance-library/categories/${encodeURIComponent(code)}/subtypes`,
        );
        if (cancelled) {
          return;
        }
        setSubtypes(rows);
        setSubtypesLoadedForCode(code);
      } catch (err: unknown) {
        if (!cancelled) {
          setStatus(err instanceof Error ? err.message : 'Failed to load sub-types');
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
  }, [api, selectedCode]);

  const visibleSubtypes = selectedCode && subtypesLoadedForCode === selectedCode ? subtypes : [];

  function selectCategory(row: CategoryRow): void {
    setSelectedCode(row.code);
    setEditingCategoryCode(row.code);
    setCategoryDraft({
      code: row.code,
      ...nameToDraft(row.name),
      icon: row.icon ?? 'MoreHorizontal',
      docket_code: row.docket_code ?? '',
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
  }

  function beginNewSubtype(): void {
    setEditingSubtypeCode(null);
    setSubtypeDraft(EMPTY_SUBTYPE);
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
        await api<CategoryRow>(
          `/admin/state/grievance-library/categories/${encodeURIComponent(editingCategoryCode)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              name: namePayload,
              icon: categoryDraft.icon.trim() || 'MoreHorizontal',
              docket_code: categoryDraft.docket_code.trim() || null,
              sort_order: sortOrder,
              is_active: categoryDraft.is_active,
            }),
          },
        );
        await refreshCategories();
        setStatus('Global category updated.');
        return;
      }

      const row = await api<CategoryRow>('/admin/state/grievance-library/categories', {
        method: 'POST',
        body: JSON.stringify({
          code: categoryDraft.code.trim(),
          name: namePayload,
          icon: categoryDraft.icon.trim() || 'MoreHorizontal',
          docket_code: categoryDraft.docket_code.trim() || null,
          sort_order: sortOrder,
          is_active: categoryDraft.is_active,
        }),
      });
      await refreshCategories();
      selectCategory(row);
      setStatus('Global category published to library.');
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
    if (!subtypeDraft.code.trim() && !editingSubtypeCode) {
      setStatus('Sub-type code is required.');
      return;
    }
    if (!subtypeDraft.name_en.trim()) {
      setStatus('Sub-type English label is required.');
      return;
    }

    setSavingSubtype(true);
    setStatus(null);
    try {
      const namePayload = {
        en: subtypeDraft.name_en.trim(),
        bn: subtypeDraft.name_bn.trim() || subtypeDraft.name_en.trim(),
        hi: subtypeDraft.name_hi.trim() || subtypeDraft.name_en.trim(),
      };
      const sortOrder = Number.parseInt(subtypeDraft.sort_order, 10) || 0;

      if (editingSubtypeCode) {
        await api<SubtypeRow>(
          `/admin/state/grievance-library/categories/${encodeURIComponent(selectedCode)}/subtypes/${encodeURIComponent(editingSubtypeCode)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              name: namePayload,
              sort_order: sortOrder,
              is_active: subtypeDraft.is_active,
            }),
          },
        );
        setEditingSubtypeCode(null);
        setSubtypeDraft(EMPTY_SUBTYPE);
        const code = selectedCode;
        setSubtypesLoadedForCode(null);
        setSubtypesLoading(true);
        const rows = await api<SubtypeRow[]>(
          `/admin/state/grievance-library/categories/${encodeURIComponent(code)}/subtypes`,
        );
        setSubtypes(rows);
        setSubtypesLoadedForCode(code);
        setSubtypesLoading(false);
        await refreshCategories();
        setStatus('Global sub-type updated.');
        return;
      }

      await api<SubtypeRow>(
        `/admin/state/grievance-library/categories/${encodeURIComponent(selectedCode)}/subtypes`,
        {
          method: 'POST',
          body: JSON.stringify({
            code: subtypeDraft.code.trim(),
            name: namePayload,
            sort_order: sortOrder,
            is_active: subtypeDraft.is_active,
          }),
        },
      );
      setSubtypeDraft(EMPTY_SUBTYPE);
      const code = selectedCode;
      setSubtypesLoadedForCode(null);
      setSubtypesLoading(true);
      const rows = await api<SubtypeRow[]>(
        `/admin/state/grievance-library/categories/${encodeURIComponent(code)}/subtypes`,
      );
      setSubtypes(rows);
      setSubtypesLoadedForCode(code);
      setSubtypesLoading(false);
      await refreshCategories();
      setStatus('Global sub-type saved.');
    } catch (err: unknown) {
      setStatus(formatPanelError(err));
    } finally {
      setSavingSubtype(false);
    }
  }

  function handleSubtypeFormSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void saveSubtype();
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <RecordListPanel
        title="Global grievance categories"
        emptyLabel="No global categories yet."
        onNew={beginNewCategory}
        newLabel="New category"
      >
        {categories.map((row) => (
          <RecordListItem
            key={row.code}
            itemKey={row.code}
            title={pickLabel(row.name)}
            subtitle={`${row.subtype_count} sub-types · ${row.tenant_adoptions} adoptions · ${row.is_active ? 'active' : 'inactive'}`}
            selected={selectedCode === row.code}
            onSelect={() => selectCategory(row)}
          />
        ))}
      </RecordListPanel>

      <div className="space-y-6">
        <article className="rounded-2xl border border-warm-border bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-ink-primary">
              {editingCategoryCode ? `Edit global · ${editingCategoryCode}` : 'New global category'}
            </h3>
          </div>
          <p className="mt-1 text-sm text-ink-secondary">
            Municipalities adopt these rows from Tenant Admin or from the municipality profile
            drawer.
          </p>
          <form className="mt-4 grid gap-3" onSubmit={handleCategoryFormSubmit}>
            <input
              className="rounded border border-warm-border px-3 py-2 text-sm disabled:bg-slate-50"
              placeholder="category code (kebab-case)"
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
              placeholder="Icon key"
              value={categoryDraft.icon}
              onChange={(e) => setCategoryDraft({ ...categoryDraft, icon: e.target.value })}
            />
            <input
              className="rounded border border-warm-border px-3 py-2 text-sm"
              placeholder="Docket code (optional)"
              value={categoryDraft.docket_code}
              onChange={(e) => setCategoryDraft({ ...categoryDraft, docket_code: e.target.value })}
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
              Active (available for adoption)
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

        {selectedCode ? (
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
            <form className="mt-4 grid gap-3" onSubmit={handleSubtypeFormSubmit}>
              <p className="text-sm font-semibold text-ink-primary">
                {editingSubtypeCode ? `Edit sub-type · ${editingSubtypeCode}` : 'Add sub-type'}
              </p>
              <input
                className="rounded border border-warm-border px-3 py-2 text-sm disabled:bg-slate-50"
                placeholder="subtype code"
                value={subtypeDraft.code}
                disabled={Boolean(editingSubtypeCode)}
                required={!editingSubtypeCode}
                onChange={(e) => setSubtypeDraft({ ...subtypeDraft, code: e.target.value })}
              />
              <input
                className="rounded border border-warm-border px-3 py-2 text-sm"
                placeholder="English label"
                value={subtypeDraft.name_en}
                required
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
                Active
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" loading={savingSubtype} disabled={savingSubtype}>
                  {editingSubtypeCode ? 'Save changes' : 'Save sub-type'}
                </Button>
                {editingSubtypeCode ? (
                  <Button type="button" size="sm" variant="secondary" onClick={beginNewSubtype}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </form>
          </article>
        ) : null}

        {status ? <p className="text-sm text-ink-secondary">{status}</p> : null}
      </div>
    </section>
  );
}
