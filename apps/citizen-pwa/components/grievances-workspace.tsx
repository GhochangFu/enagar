'use client';

import { t, type Locale, type MessageKey } from '@enagar/i18n';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type LanguageCode = Locale;

export const GRIEVANCE_CATEGORY_CODES = [
  'roads',
  'sanitation',
  'streetlights',
  'water',
  'drainage',
  'stray_dogs',
  'parks',
  'encroachment',
  'trade',
  'other',
] as const;

export type GrievanceCategoryCode = (typeof GRIEVANCE_CATEGORY_CODES)[number];

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type GrievanceApiRow = {
  id: string;
  tenant_id: string;
  citizen_id: string;
  grievance_no: string;
  category: string;
  description: string;
  location: unknown;
  photo_keys: string[];
  grievance_priority: string;
  status: string;
  routed_role_code: string | null;
  assigned_to_user_id: string | null;
  sla_due_at: string | null;
  sla_breached_at: string | null;
  rating: number | null;
  feedback: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GrievanceTimelineEntryApi = {
  id: string;
  event_type: string;
  actor_subject: string;
  body: string | null;
  metadata: unknown;
  occurred_at: string;
};

export type GrievanceDetailResponse = {
  grievance: GrievanceApiRow;
  timeline: GrievanceTimelineEntryApi[];
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

function grievanceCatKey(code: GrievanceCategoryCode): MessageKey {
  return `grievance.cat.${code}` as MessageKey;
}

function authHeaders(token: TokenResponse, withJson = true): HeadersInit {
  return withJson
    ? {
        authorization: `Bearer ${token.access_token}`,
        'content-type': 'application/json',
      }
    : {
        authorization: `Bearer ${token.access_token}`,
      };
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; error?: string };
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
    if (Array.isArray(body.message)) {
      return body.message.map((part) => String(part)).join('; ');
    }
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
  } catch {
    /* body may not be JSON */
  }
  return `Request failed (${response.status})`;
}

export function GrievancesWorkspace({
  apiBaseUrl,
  language,
  mobileDigits,
  onBanner,
  onGrievancesMutated,
  token,
}: {
  apiBaseUrl: string;
  language: LanguageCode;
  mobileDigits: string;
  onBanner: (message: string) => void;
  onGrievancesMutated?: () => void;
  token: TokenResponse | null;
}): JSX.Element {
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [registerName, setRegisterName] = useState('');
  const [list, setList] = useState<GrievanceApiRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  /** list | pick | compose | done | detail */
  const [surface, setSurface] = useState<'list' | 'pick' | 'compose' | 'done' | 'detail'>('list');

  const [pickedCategory, setPickedCategory] = useState<GrievanceCategoryCode | null>(null);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('medium');
  const [locNote, setLocNote] = useState('');
  const [wardHint, setWardHint] = useState('');

  const [lastCreated, setLastCreated] = useState<GrievanceApiRow | null>(null);
  const [detailPayload, setDetailPayload] = useState<GrievanceDetailResponse | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');

  const reloadList = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    setLoadingList(true);
    try {
      const response = await fetch(`${apiBaseUrl}/grievances`, {
        headers: authHeaders(token, false),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      setList((await response.json()) as GrievanceApiRow[]);
      onBanner(t('status.ready', language));
      onGrievancesMutated?.();
    } catch (e: unknown) {
      onBanner(e instanceof Error ? e.message : t('grievance.loadError', language));
    } finally {
      setLoadingList(false);
    }
  }, [apiBaseUrl, language, onBanner, onGrievancesMutated, token]);

  const refreshProfileGate = useCallback(async (): Promise<void> => {
    if (!token) {
      setProfileReady(null);
      return;
    }
    setProfileReady(null);
    try {
      const response = await fetch(`${apiBaseUrl}/citizen/profile`, {
        headers: authHeaders(token, false),
      });
      setProfileReady(response.ok);
      if (!response.ok) {
        onBanner(t('grievance.registerTitle', language));
      }
    } catch {
      setProfileReady(false);
      onBanner(t('grievance.profileError', language));
    }
  }, [apiBaseUrl, language, onBanner, token]);

  useEffect(() => {
    void refreshProfileGate();
  }, [refreshProfileGate]);

  useEffect(() => {
    if (profileReady === true && token) {
      void reloadList();
    }
  }, [profileReady, reloadList, token]);

  async function registerCitizen(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) {
      return;
    }

    const mobile = mobileDigits.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      onBanner('Invalid mobile — re-login with a valid 10-digit number.');
      return;
    }

    const response = await fetch(`${apiBaseUrl}/citizen/register`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        mobile,
        ...(registerName.trim() ? { name: registerName.trim() } : {}),
        language_pref: language,
      }),
    });
    if (!response.ok) {
      onBanner(await readApiError(response));
      return;
    }
    setRegisterName('');
    setProfileReady(true);
    await reloadList();
    onGrievancesMutated?.();
    onBanner(t('status.loginVerified', language));
  }

  async function openDetail(ref: GrievanceApiRow): Promise<void> {
    if (!token) {
      return;
    }
    setSurface('detail');
    setCommentDraft('');
    setFeedbackComment('');
    setRating(5);
    const response = await fetch(
      `${apiBaseUrl}/grievances/${encodeURIComponent(ref.grievance_no)}`,
      { headers: authHeaders(token, false) },
    );
    if (!response.ok) {
      onBanner(await readApiError(response));
      setSurface('list');
      return;
    }
    setDetailPayload((await response.json()) as GrievanceDetailResponse);
  }

  async function postComment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !detailPayload || !commentDraft.trim()) {
      return;
    }
    const ref = detailPayload.grievance.grievance_no;
    const response = await fetch(`${apiBaseUrl}/grievances/${encodeURIComponent(ref)}/comment`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ body: commentDraft.trim() }),
    });
    if (!response.ok) {
      onBanner(await readApiError(response));
      return;
    }
    setCommentDraft('');
    const next = (await response.json()) as GrievanceDetailResponse;
    setDetailPayload(next);
    await reloadList();
    onBanner(t('status.ready', language));
  }

  async function postFeedback(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !detailPayload) {
      return;
    }
    const ref = detailPayload.grievance.grievance_no;
    const response = await fetch(`${apiBaseUrl}/grievances/${encodeURIComponent(ref)}/feedback`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        rating,
        ...(feedbackComment.trim() ? { comment: feedbackComment.trim() } : {}),
      }),
    });
    if (!response.ok) {
      onBanner(await readApiError(response));
      return;
    }

    setFeedbackComment('');
    const row = (await response.json()) as GrievanceApiRow;
    const detailRes = await fetch(
      `${apiBaseUrl}/grievances/${encodeURIComponent(row.grievance_no)}`,
      { headers: authHeaders(token, false) },
    );
    if (!detailRes.ok) {
      setDetailPayload({
        grievance: row,
        timeline: [],
      });
    } else {
      setDetailPayload((await detailRes.json()) as GrievanceDetailResponse);
    }
    await reloadList();
    onBanner(t('status.ready', language));
  }

  async function submitNew(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !pickedCategory || description.trim().length < 3) {
      onBanner(t('grievance.submitError', language));
      return;
    }

    const location: Record<string, string> = {};
    if (locNote.trim()) {
      location.address = locNote.trim();
    }
    if (wardHint.trim()) {
      location.ward_hint = wardHint.trim();
    }

    const response = await fetch(`${apiBaseUrl}/grievances`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        category: pickedCategory,
        description: description.trim(),
        grievance_priority: priority,
        ...(Object.keys(location).length > 0 ? { location } : {}),
      }),
    });

    if (!response.ok) {
      onBanner(await readApiError(response));
      return;
    }

    const row = (await response.json()) as GrievanceApiRow;
    setLastCreated(row);
    setSurface('done');
    setDescription('');
    setLocNote('');
    setWardHint('');
    setPickedCategory(null);
    await reloadList();
    onBanner(t('grievance.filedTitle', language));
  }

  function resetFlow(): void {
    setSurface('list');
    setPickedCategory(null);
    setLastCreated(null);
    setDetailPayload(null);
  }

  if (!token) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-slate-600">{t('grievance.signInRequired', language)}</p>
      </section>
    );
  }

  if (profileReady === null) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-slate-600">…</p>
      </section>
    );
  }

  if (!profileReady) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold">{t('grievance.registerTitle', language)}</h3>
        <p className="mt-2 text-sm text-slate-600">{t('grievance.registerBody', language)}</p>
        <form className="mt-4 space-y-3" onSubmit={registerCitizen}>
          <label className="block text-sm font-medium text-slate-700">
            {t('login.mobile', language)}
            <input
              readOnly
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              value={mobileDigits}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            {t('grievance.yourName', language)}
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              onChange={(event) => setRegisterName(event.target.value)}
              value={registerName}
            />
          </label>
          <button className="rounded-2xl bg-brand px-5 py-3 font-semibold text-white" type="submit">
            {t('grievance.registerCta', language)}
          </button>
        </form>
      </section>
    );
  }

  if (surface === 'pick') {
    return (
      <section className="space-y-4">
        <button
          className="text-sm font-semibold text-brand"
          onClick={() => setSurface('list')}
          type="button"
        >
          ← {t('grievance.back', language)}
        </button>
        <h3 className="text-xl font-bold">{t('grievance.chooseCategory', language)}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {GRIEVANCE_CATEGORY_CODES.map((code) => (
            <button
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand"
              key={code}
              onClick={() => {
                setPickedCategory(code);
                setSurface('compose');
              }}
              type="button"
            >
              <span className="font-semibold">{t(grievanceCatKey(code), language)}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (surface === 'compose' && pickedCategory) {
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <button
          className="text-sm font-semibold text-brand"
          onClick={() => setSurface('pick')}
          type="button"
        >
          ← {t('grievance.back', language)}
        </button>
        <h3 className="mt-2 text-xl font-bold">{t(grievanceCatKey(pickedCategory), language)}</h3>
        <form className="mt-4 space-y-4" onSubmit={submitNew}>
          <label className="block text-sm font-medium text-slate-700">
            {t('grievance.description', language)}
            <textarea
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('grievance.descriptionHelp', language)}
              rows={5}
              value={description}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            {t('grievance.priority', language)}
            <select
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              onChange={(event) => setPriority(event.target.value as (typeof PRIORITIES)[number])}
              value={priority}
            >
              {[...PRIORITIES].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            {t('grievance.optionalLocation', language)}
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              onChange={(event) => setLocNote(event.target.value)}
              value={locNote}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            {t('grievance.optionalWard', language)}
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={wardHint}
              onChange={(event) => setWardHint(event.target.value)}
            />
          </label>

          <button
            className="w-full rounded-2xl bg-brand px-5 py-3 font-semibold text-white"
            type="submit"
          >
            {t('grievance.submit', language)}
          </button>
        </form>
      </section>
    );
  }

  if (surface === 'done' && lastCreated) {
    return (
      <section className="rounded-3xl bg-emerald-50 p-6 shadow-sm ring-1 ring-emerald-200">
        <h3 className="text-xl font-bold text-emerald-950">
          {t('grievance.filedTitle', language)}
        </h3>
        <p className="mt-2 text-emerald-900">{t('grievance.filedBody', language)}</p>
        <p className="mt-4 font-mono text-lg font-bold text-emerald-950">
          {lastCreated.grievance_no}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-2xl bg-brand px-4 py-2 font-semibold text-white"
            onClick={() => void openDetail(lastCreated)}
            type="button"
          >
            {t('grievance.open', language)}
          </button>
          <button
            className="rounded-2xl border border-emerald-800 px-4 py-2 font-semibold text-emerald-900"
            onClick={resetFlow}
            type="button"
          >
            {t('grievance.back', language)}
          </button>
        </div>
      </section>
    );
  }

  if (surface === 'detail' && detailPayload) {
    const { grievance: g } = detailPayload;

    const slaChip =
      g.sla_breached_at != null
        ? `${t('grievance.slaBreached', language)} (${new Date(g.sla_breached_at).toLocaleString()})`
        : g.sla_due_at != null
          ? `${t('grievance.slaDue', language)} · ${new Date(g.sla_due_at).toLocaleString()}`
          : '';

    const showRating = g.status === 'resolved';

    return (
      <section className="space-y-4">
        <button className="text-sm font-semibold text-brand" onClick={resetFlow} type="button">
          ← {t('grievance.nav', language)}
        </button>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-brand">{g.grievance_no}</p>
          <h3 className="mt-2 text-2xl font-bold">{g.category}</h3>
          <p className="mt-3 whitespace-pre-wrap text-slate-700">{g.description}</p>
          <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
            <DetailStat label={t('grievance.statusLabel', language)} value={g.status} />
            <DetailStat
              label={t('grievance.priorityLabel', language)}
              value={g.grievance_priority}
            />
            <DetailStat
              label={t('grievance.categoryLabel', language)}
              value={tTryCategoryLabel(g.category, language)}
            />
            <DetailStat
              label={t('grievance.updatedLabel', language)}
              value={new Date(g.updated_at).toLocaleString()}
            />
          </div>
          {slaChip && (
            <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950">
              {slaChip}
            </p>
          )}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h4 className="font-bold">{t('grievance.timeline', language)}</h4>
          <ul className="mt-4 space-y-3">
            {detailPayload.timeline.length === 0 ? (
              <li className="text-slate-500">{t('grievance.timelineEmpty', language)}</li>
            ) : (
              detailPayload.timeline.map((entry) => (
                <li
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm"
                  key={entry.id}
                >
                  <p className="font-semibold text-slate-800">{entry.event_type}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(entry.occurred_at).toLocaleString()} · {entry.actor_subject}
                  </p>
                  {entry.body && <p className="mt-1 text-slate-700">{entry.body}</p>}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h4 className="font-bold">{t('grievance.addComment', language)}</h4>
          <form className="mt-3 space-y-2" onSubmit={postComment}>
            <textarea
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              onChange={(event) => setCommentDraft(event.target.value)}
              rows={3}
              value={commentDraft}
            />
            <button
              className="rounded-2xl bg-slate-900 px-4 py-2 font-semibold text-white"
              type="submit"
            >
              {t('grievance.sendComment', language)}
            </button>
          </form>
        </div>

        {showRating ? (
          <div className="rounded-3xl bg-brand/10 p-6 shadow-sm">
            <h4 className="font-bold text-brand">{t('grievance.feedbackTitle', language)}</h4>
            <form className="mt-3 space-y-3" onSubmit={postFeedback}>
              <label className="block text-sm font-medium text-slate-800">
                {t('grievance.rating', language)}
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2"
                  max={5}
                  min={1}
                  onChange={(event) => setRating(Number(event.target.value))}
                  type="number"
                  value={rating}
                />
              </label>
              <label className="block text-sm font-medium text-slate-800">
                {t('grievance.feedbackNote', language)}
                <textarea
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                  onChange={(event) => setFeedbackComment(event.target.value)}
                  rows={2}
                  value={feedbackComment}
                />
              </label>
              <button
                className="rounded-2xl bg-brand px-4 py-2 font-semibold text-white"
                type="submit"
              >
                {t('grievance.closeWithFeedback', language)}
              </button>
            </form>
          </div>
        ) : null}

        {!showRating ? (
          <p className="text-center text-xs text-slate-500">
            {t('grievance.closedHint', language)}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold">{t('grievance.title', language)}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{t('grievance.intro', language)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
            onClick={() => void reloadList()}
            type="button"
          >
            {loadingList ? '…' : t('grievance.refresh', language)}
          </button>
          <button
            className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white"
            onClick={() => {
              setSurface('pick');
              setPickedCategory(null);
            }}
            type="button"
          >
            {t('grievance.fileNew', language)}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((item) => (
          <article
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            key={item.id}
          >
            <p className="font-mono text-sm text-brand">{item.grievance_no}</p>
            <h4 className="mt-2 text-lg font-bold">{item.category}</h4>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.description}</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
              <DetailStat label={t('grievance.statusLabel', language)} value={item.status} />
              <DetailStat
                label={t('grievance.priorityLabel', language)}
                value={item.grievance_priority}
              />
            </div>
            <button
              className="mt-4 w-full rounded-2xl border border-brand px-4 py-2 text-sm font-semibold text-brand"
              onClick={() => void openDetail(item)}
              type="button"
            >
              {t('grievance.open', language)}
            </button>
          </article>
        ))}
      </div>
      {!loadingList && list.length === 0 ? (
        <p className="rounded-3xl bg-slate-50 p-6 text-slate-600">
          {t('grievance.empty', language)}
        </p>
      ) : null}
    </section>
  );
}

function DetailStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

/** Show translated label when `category` matches our filing codes; else raw API value */
function tTryCategoryLabel(category: string, locale: LanguageCode): string {
  if (GRIEVANCE_CATEGORY_CODES.includes(category as GrievanceCategoryCode)) {
    return t(grievanceCatKey(category as GrievanceCategoryCode), locale);
  }
  return category;
}
