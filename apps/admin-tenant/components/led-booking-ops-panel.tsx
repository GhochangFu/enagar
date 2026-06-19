'use client';

import { AlertBanner, Button } from '@enagar/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from './tenant-admin-session';

type BookableAssetRow = {
  code: string;
  asset_type: string;
  name: { en?: string; bn?: string; hi?: string };
  location?: { ward?: string; address?: { en?: string } };
  base_rate_paise: number;
  security_deposit_paise: number;
  slot_step_minutes: number;
  is_active: boolean;
};

function formatInr(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function assetLabel(name: BookableAssetRow['name']): string {
  return name.en?.trim() || name.bn?.trim() || name.hi?.trim() || 'LED board';
}

export function LedBookingOpsPanel(): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
  const [status, setStatus] = useState<string | null>(null);
  const [boards, setBoards] = useState<BookableAssetRow[]>([]);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const emptyDraft = {
    code: '',
    name_en: '',
    ward: '',
    address: '',
    base_rate_paise: '100000',
    security_deposit_paise: '100000',
    is_active: true,
  };
  const [draft, setDraft] = useState(emptyDraft);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${apiBase}/admin/tenant/bookings`, { headers });
    if (!res.ok) {
      throw new Error(`Bookings load failed (${res.status})`);
    }
    const json = (await res.json()) as { assets: BookableAssetRow[] };
    setBoards(json.assets.filter((row) => row.asset_type === 'LED_BOARD'));
  }, [apiBase, headers, token]);

  useEffect(() => {
    void load().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : 'Failed to load LED boards');
    });
  }, [load]);

  async function saveBoard(): Promise<void> {
    const code = draft.code.trim();
    const nameEn = draft.name_en.trim();
    if (!code || !nameEn) {
      setStatus('LED board requires a code and English name.');
      return;
    }
    setStatus(null);
    const location: Record<string, unknown> = {};
    if (draft.ward.trim()) {
      location.ward = draft.ward.trim();
    }
    if (draft.address.trim()) {
      location.address = { en: draft.address.trim() };
    }
    const res = await fetch(`${apiBase}/admin/tenant/bookings/assets`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        code,
        asset_type: 'LED_BOARD',
        name: { en: nameEn, bn: nameEn, hi: nameEn },
        location,
        rate_unit: 'HOUR',
        base_rate_paise: Number(draft.base_rate_paise) || 100_000,
        security_deposit_paise: Number(draft.security_deposit_paise) || 100_000,
        slot_step_minutes: 60,
        rules: {
          min_duration_minutes: 60,
          max_duration_minutes: 480,
          advance_booking_hours: 24,
        },
        is_active: draft.is_active,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      setStatus(`Save failed (${res.status}): ${text.slice(0, 200)}`);
      return;
    }
    setStatus(
      `Saved LED board ${code}. It appears under Operations → Bookings. Link it in Services → ad-led → Bookable assets, then add availability windows.`,
    );
    setEditingCode(code);
    await load();
  }

  function loadBoardIntoForm(board: BookableAssetRow): void {
    const loc = board.location;
    setEditingCode(board.code);
    setDraft({
      code: board.code,
      name_en: assetLabel(board.name),
      ward: loc?.ward ?? '',
      address: loc?.address?.en ?? '',
      base_rate_paise: String(board.base_rate_paise),
      security_deposit_paise: String(board.security_deposit_paise),
      is_active: board.is_active,
    });
    setStatus(`Editing ${board.code}. Change fields and click Save LED board.`);
  }

  function startNewBoard(): void {
    setEditingCode(null);
    setDraft(emptyDraft);
    setStatus('New LED board — enter code and details, then Save.');
  }

  return (
    <section className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-bold text-slate-900">LED boards</h3>
        <p className="mt-1 text-sm text-slate-600">
          Hourly LED display slots for citizen <span className="font-mono">ad-led</span> booking.
          Weekday availability 06:00–23:00 IST is seeded for KMC; use Operations → Bookings → bulk
          availability to extend windows.
        </p>
      </div>

      {status ? <AlertBanner tone="info">{status}</AlertBanner> : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-xl border border-dashed border-slate-200 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">
              {editingCode ? `Edit LED board · ${editingCode}` : 'New LED board'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={startNewBoard} type="button" variant="secondary">
                New board
              </Button>
              <Button onClick={() => void saveBoard()} type="button">
                Save LED board
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Code
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100"
                disabled={Boolean(editingCode)}
                onChange={(event) => setDraft((d) => ({ ...d, code: event.target.value }))}
                placeholder="kmc-led-example"
                value={draft.code}
              />
            </label>
            <label className="text-sm">
              Name (EN)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                onChange={(event) => setDraft((d) => ({ ...d, name_en: event.target.value }))}
                placeholder="KMC LED — Example"
                value={draft.name_en}
              />
            </label>
            <label className="text-sm">
              Ward
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                onChange={(event) => setDraft((d) => ({ ...d, ward: event.target.value }))}
                value={draft.ward}
              />
            </label>
            <label className="text-sm">
              Address
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                onChange={(event) => setDraft((d) => ({ ...d, address: event.target.value }))}
                value={draft.address}
              />
            </label>
            <label className="text-sm">
              Hourly rate (paise)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                onChange={(event) => setDraft((d) => ({ ...d, base_rate_paise: event.target.value }))}
                value={draft.base_rate_paise}
              />
            </label>
            <label className="text-sm">
              Security deposit (paise)
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                onChange={(event) =>
                  setDraft((d) => ({ ...d, security_deposit_paise: event.target.value }))
                }
                value={draft.security_deposit_paise}
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                checked={draft.is_active}
                onChange={(event) => setDraft((d) => ({ ...d, is_active: event.target.checked }))}
                type="checkbox"
              />
              Active
            </label>
          </div>
        </article>

        <article className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
          <h4 className="text-sm font-semibold text-slate-800">LED boards</h4>
          <ul className="mt-3 space-y-2">
            {boards.length === 0 ? (
              <li className="text-sm text-slate-500">No LED boards yet — click New board above.</li>
            ) : (
              boards.map((board) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                  key={board.code}
                >
                  <div>
                    <p className="font-medium text-slate-900">{assetLabel(board.name)}</p>
                    <p className="font-mono text-xs text-slate-500">{board.code}</p>
                    <p className="text-xs text-slate-600">
                      {formatInr(board.base_rate_paise)} / hour · deposit{' '}
                      {formatInr(board.security_deposit_paise)} ·{' '}
                      {board.is_active ? 'active' : 'inactive'}
                    </p>
                  </div>
                  <Button
                    onClick={() => loadBoardIntoForm(board)}
                    type="button"
                    size="sm"
                    variant="secondary"
                  >
                    Edit
                  </Button>
                </li>
              ))
            )}
          </ul>
        </article>
      </div>
    </section>
  );
}
