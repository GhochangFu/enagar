'use client';

import {
  categoryLabelFromCatalogue,
  fetchPublicGrievanceCatalogue,
  resolveGrievanceCategoryLabel,
  resolveGrievanceSubtypeLabel,
  sortCatalogueCategories,
  subtypeLabelFromCatalogue,
  type GrievanceCatalogueResponse,
} from '@enagar/grievance-catalogue';
import { t, type Locale } from '@enagar/i18n';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import {
  attachPendingEvidenceToGrievance,
  type PendingGrievanceEvidence,
} from '../lib/grievance-evidence';
import { grievanceCreateWriteScope, grievanceRowTenantScope } from '../lib/grievance-scope';
import { authHeaders, readApiError } from '../lib/workspace-http';

import { GrievanceEvidenceField } from './grievance-evidence-field';
import { GrievanceEvidencePreviewGrid } from './grievance-evidence-preview';
import { GrievanceLocationMap } from './grievance-location-map';

type LanguageCode = Locale;

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

type GrievanceTone = {
  dotClassName: string;
  label: string;
  pillClassName: string;
};

const neutralTone: GrievanceTone = {
  dotClassName: 'bg-slate-400',
  label: 'neutral',
  pillClassName: 'border-slate-200 bg-slate-50 text-slate-700',
};

function grievanceStatusTone(status: string): GrievanceTone {
  const normalized = status.trim().toLowerCase().replaceAll('_', ' ');
  if (['closed', 'resolved'].includes(normalized)) {
    return {
      dotClassName: 'bg-emerald-600',
      label: normalized,
      pillClassName: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }
  if (['submitted', 'open', 'new'].includes(normalized)) {
    return {
      dotClassName: 'bg-sky-600',
      label: normalized,
      pillClassName: 'border-sky-200 bg-sky-50 text-sky-800',
    };
  }
  if (['in progress', 'assigned', 'acknowledged'].includes(normalized)) {
    return {
      dotClassName: 'bg-indigo-600',
      label: normalized,
      pillClassName: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    };
  }
  if (['reopened', 'escalated'].includes(normalized)) {
    return {
      dotClassName: 'bg-orange-600',
      label: normalized,
      pillClassName: 'border-orange-200 bg-orange-50 text-orange-800',
    };
  }
  return { ...neutralTone, label: normalized || status };
}

function grievancePriorityTone(priority: string): GrievanceTone {
  const normalized = priority.trim().toLowerCase();
  if (normalized === 'urgent') {
    return {
      dotClassName: 'bg-rose-600',
      label: normalized,
      pillClassName: 'border-rose-200 bg-rose-50 text-rose-800',
    };
  }
  if (normalized === 'high') {
    return {
      dotClassName: 'bg-orange-600',
      label: normalized,
      pillClassName: 'border-orange-200 bg-orange-50 text-orange-800',
    };
  }
  if (normalized === 'medium') {
    return {
      dotClassName: 'bg-amber-600',
      label: normalized,
      pillClassName: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }
  if (normalized === 'low') {
    return {
      dotClassName: 'bg-emerald-600',
      label: normalized,
      pillClassName: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }
  return { ...neutralTone, label: normalized || priority };
}

/** Optional WGS-84 coordinate from grievance compose form — blank means omit. */
function parseLatLngField(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const n = Number.parseFloat(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/** Same calendar window as `@enagar/api` `GRIEVANCE_REOPEN_WINDOW_MS` — keep in sync mentally. */
const GRIEVANCE_REOPEN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function grievanceEligibleForCitizenReopen(g: GrievanceApiRow): boolean {
  if (g.status !== 'resolved') {
    return false;
  }
  if (!g.resolved_at) {
    return false;
  }
  const resolvedAtMs = Date.parse(g.resolved_at);
  if (Number.isNaN(resolvedAtMs)) {
    return false;
  }
  return Date.now() - resolvedAtMs <= GRIEVANCE_REOPEN_WINDOW_MS;
}

export type GrievanceApiRow = {
  id: string;
  tenant_id: string;
  citizen_id: string;
  grievance_no: string;
  category: string;
  subtype_code?: string | null;
  description: string;
  location: unknown;
  photo_keys: string[];
  /** Present on detail responses when structured attachments are registered. */
  attachments?: {
    id: string;
    storage_key: string;
    content_type: string;
    created_at: string;
  }[];
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

/** Minimal tenant row for hub grievance filing (portal JWT needs ULB scope on POST). */
export type HubGrievanceTenantOption = {
  id: string;
  code: string;
  name: string;
  district: string;
  theme_color: string;
};

function tenantMatchesHubPickQuery(row: HubGrievanceTenantOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.code.toLowerCase().includes(q) ||
    row.name.toLowerCase().includes(q) ||
    row.district.toLowerCase().includes(q)
  );
}

function hubTenantCodeForRow(
  row: { tenant_id: string },
  hubMunicipalityCatalogue: readonly HubGrievanceTenantOption[] | null | undefined,
): string | null {
  return (
    hubMunicipalityCatalogue?.find((tenantRow) => tenantRow.id === row.tenant_id)?.code ?? null
  );
}

function catalogueForGrievanceRow(
  row: GrievanceApiRow,
  workspaceScope: string | undefined,
  workspaceCatalogue: GrievanceCatalogueResponse | null,
  hubCatalogues: Record<string, GrievanceCatalogueResponse>,
  hubMunicipalityCatalogue: readonly HubGrievanceTenantOption[] | null | undefined,
): GrievanceCatalogueResponse | null {
  if (workspaceScope) {
    return workspaceCatalogue;
  }
  const tenantCode = hubTenantCodeForRow(row, hubMunicipalityCatalogue);
  return tenantCode ? (hubCatalogues[tenantCode] ?? null) : null;
}

export function GrievancesWorkspace({
  apiBaseUrl,
  language,
  mobileDigits,
  onBanner,
  onGrievancesMutated,
  tenantScopeCode,
  hubMunicipalityCatalogue,
  token,
  deepLinkGrievanceRef,
}: {
  apiBaseUrl: string;
  language: LanguageCode;
  mobileDigits: string;
  onBanner: (message: string) => void;
  onGrievancesMutated?: () => void;
  /** Active ULB when filing with a portal (WBPORTAL) JWT — same as X-Enagar-Tenant-Code. */
  tenantScopeCode?: string | null;
  /** Hub aggregate mode: catalogue from `GET /tenants` so the citizen can pick a target ULB before filing. */
  hubMunicipalityCatalogue?: readonly HubGrievanceTenantOption[] | null;
  token: TokenResponse | null;
  /** Open detail for grievance UUID or grievance_no (e.g. `?grievance=` deep link — Sprint 5.4). */
  deepLinkGrievanceRef?: string | null;
}): JSX.Element {
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [registerName, setRegisterName] = useState('');
  const [list, setList] = useState<GrievanceApiRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  /** Hub-only: ULB chosen for the current filing attempt (writes use this as X-Enagar-Tenant-Code). */
  const [filingTenantCode, setFilingTenantCode] = useState<string | null>(null);
  const [tenantPickQuery, setTenantPickQuery] = useState('');

  /** list | selectTenant | pick | pickSubtype | compose | done | detail */
  const [surface, setSurface] = useState<
    'list' | 'selectTenant' | 'pick' | 'pickSubtype' | 'compose' | 'done' | 'detail'
  >('list');

  const workspaceScope = tenantScopeCode?.trim() || undefined;
  /** Scope for grievance POST (and other writes that require a target ULB under portal JWT). */
  const grievanceWriteScope = grievanceCreateWriteScope({
    workspaceTenantCode: tenantScopeCode,
    filingTenantCode,
  });

  const [catalogue, setCatalogue] = useState<GrievanceCatalogueResponse | null>(null);
  /** Hub aggregate list: per-ULB catalogues for label resolution on cross-tenant inbox rows. */
  const [hubCatalogues, setHubCatalogues] = useState<Record<string, GrievanceCatalogueResponse>>(
    {},
  );
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [pickedCategory, setPickedCategory] = useState<string | null>(null);
  const [pickedSubtype, setPickedSubtype] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('medium');
  const [locNote, setLocNote] = useState('');
  const [wardHint, setWardHint] = useState('');
  const [latitudeStr, setLatitudeStr] = useState('');
  const [longitudeStr, setLongitudeStr] = useState('');
  const [mapPin, setMapPin] = useState<{ lat: number; lng: number } | null>(null);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [pendingEvidence, setPendingEvidence] = useState<PendingGrievanceEvidence[]>([]);
  const [submittingGrievance, setSubmittingGrievance] = useState(false);
  const [slaInboxUnread, setSlaInboxUnread] = useState(0);
  const [lastCreated, setLastCreated] = useState<GrievanceApiRow | null>(null);
  const [detailPayload, setDetailPayload] = useState<GrievanceDetailResponse | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [reopenDraft, setReopenDraft] = useState('');
  const deepLinkHandledRef = useRef<string | null>(null);

  const reloadList = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    setLoadingList(true);
    try {
      const response = await fetch(`${apiBaseUrl}/grievances`, {
        headers: authHeaders(token, false, workspaceScope),
      });
      if (!response.ok) {
        throw new Error(await readApiError(response));
      }
      setList((await response.json()) as GrievanceApiRow[]);
      try {
        const inboxRes = await fetch(`${apiBaseUrl}/citizen/notifications`, {
          headers: authHeaders(token, false, workspaceScope),
        });
        if (inboxRes.ok) {
          const notes = (await inboxRes.json()) as Array<{ type: string; is_read: boolean }>;
          const unread = notes.filter((n) => n.type === 'sla_breach' && !n.is_read).length;
          setSlaInboxUnread(unread);
        } else {
          setSlaInboxUnread(0);
        }
      } catch {
        setSlaInboxUnread(0);
      }
      onBanner(t('status.ready', language));
    } catch (e: unknown) {
      onBanner(e instanceof Error ? e.message : t('grievance.loadError', language));
    } finally {
      setLoadingList(false);
    }
  }, [apiBaseUrl, language, onBanner, workspaceScope, token]);

  useEffect(() => {
    if (workspaceScope) {
      setFilingTenantCode(null);
      setTenantPickQuery('');
    }
  }, [workspaceScope]);

  useEffect(() => {
    if (surface === 'pick' && !workspaceScope && !filingTenantCode) {
      setSurface('selectTenant');
    }
  }, [surface, workspaceScope, filingTenantCode]);

  const catalogueTenantCode =
    grievanceWriteScope ?? workspaceScope ?? filingTenantCode?.trim() ?? null;

  useEffect(() => {
    const tenantCode = catalogueTenantCode;
    if (!tenantCode) {
      setCatalogue(null);
      setCatalogueError(null);
      return;
    }
    let cancelled = false;
    setCatalogueLoading(true);
    setCatalogueError(null);
    void fetchPublicGrievanceCatalogue(apiBaseUrl, tenantCode)
      .then((data) => {
        if (!cancelled) {
          setCatalogue(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCatalogue(null);
          setCatalogueError(
            err instanceof Error ? err.message : t('grievance.loadError', language),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCatalogueLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, catalogueTenantCode, language]);

  useEffect(() => {
    if (workspaceScope || !hubMunicipalityCatalogue?.length || !list.length) {
      return;
    }
    let cancelled = false;
    const tenantCodes = new Set<string>();
    for (const row of list) {
      const code = hubTenantCodeForRow(row, hubMunicipalityCatalogue);
      if (code) {
        tenantCodes.add(code);
      }
    }
    for (const tenantCode of tenantCodes) {
      void fetchPublicGrievanceCatalogue(apiBaseUrl, tenantCode)
        .then((data) => {
          if (!cancelled) {
            setHubCatalogues((prev) => (prev[tenantCode] ? prev : { ...prev, [tenantCode]: data }));
          }
        })
        .catch(() => {
          /* list still shows category code until catalogue loads */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, hubMunicipalityCatalogue, list, workspaceScope]);

  const refreshProfileGate = useCallback(async (): Promise<void> => {
    if (!token) {
      setProfileReady(null);
      return;
    }
    setProfileReady(null);
    try {
      const response = await fetch(`${apiBaseUrl}/citizen/profile`, {
        headers: authHeaders(token, false, workspaceScope),
      });
      if (!response.ok) {
        setProfileReady(false);
        onBanner(t('grievance.registerTitle', language));
        return;
      }
      const profile = (await response.json()) as { mobile?: string };
      const digits = (profile.mobile ?? '').replace(/\D/g, '').slice(-10);
      const ready = /^[6-9]\d{9}$/.test(digits);
      setProfileReady(ready);
      if (!ready) {
        onBanner(t('grievance.registerTitle', language));
      }
    } catch {
      setProfileReady(false);
      onBanner(t('grievance.profileError', language));
    }
  }, [apiBaseUrl, language, onBanner, workspaceScope, token]);

  useEffect(() => {
    void refreshProfileGate();
  }, [refreshProfileGate]);

  useEffect(() => {
    if (profileReady === true && token) {
      void reloadList();
    }
  }, [profileReady, reloadList, token]);

  useEffect(() => {
    if (!deepLinkGrievanceRef?.trim()) {
      deepLinkHandledRef.current = null;
    }
  }, [deepLinkGrievanceRef]);

  useEffect(() => {
    const ref = deepLinkGrievanceRef?.trim();
    if (!ref || !token || profileReady !== true) {
      return;
    }
    if (deepLinkHandledRef.current === ref) {
      return;
    }
    deepLinkHandledRef.current = ref;

    void (async () => {
      setSurface('detail');
      setCommentDraft('');
      setFeedbackComment('');
      setReopenDraft('');
      setRating(5);
      try {
        const response = await fetch(`${apiBaseUrl}/grievances/${encodeURIComponent(ref)}`, {
          headers: authHeaders(token, false, workspaceScope),
        });
        if (!response.ok) {
          onBanner(await readApiError(response));
          setSurface('list');
          return;
        }
        setDetailPayload((await response.json()) as GrievanceDetailResponse);
        onBanner(t('status.ready', language));
      } catch (e: unknown) {
        const message =
          e instanceof TypeError
            ? 'Network error — check the API is reachable and NEXT_PUBLIC_API_BASE_URL is correct.'
            : e instanceof Error
              ? e.message
              : 'Request failed';
        onBanner(message);
        setSurface('list');
      }
    })();
  }, [apiBaseUrl, deepLinkGrievanceRef, language, onBanner, profileReady, token, workspaceScope]);

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
      headers: authHeaders(token, true, workspaceScope),
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
    setReopenDraft('');
    setRating(5);
    const scope = grievanceRowTenantScope({
      workspaceTenantCode: tenantScopeCode,
      grievanceTenantId: ref.tenant_id,
      hubCatalogue: hubMunicipalityCatalogue,
    });

    try {
      const response = await fetch(
        `${apiBaseUrl}/grievances/${encodeURIComponent(ref.grievance_no)}`,
        { headers: authHeaders(token, false, scope) },
      );
      if (!response.ok) {
        onBanner(await readApiError(response));
        setSurface('list');
        return;
      }
      setDetailPayload((await response.json()) as GrievanceDetailResponse);
    } catch (e: unknown) {
      const message =
        e instanceof TypeError
          ? 'Network error — check the API is reachable and NEXT_PUBLIC_API_BASE_URL is correct.'
          : e instanceof Error
            ? e.message
            : 'Request failed';
      onBanner(message);
      setSurface('list');
    }
  }

  async function postComment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !detailPayload || !commentDraft.trim()) {
      return;
    }
    const ref = detailPayload.grievance.grievance_no;
    const scope = grievanceRowTenantScope({
      workspaceTenantCode: tenantScopeCode,
      grievanceTenantId: detailPayload.grievance.tenant_id,
      hubCatalogue: hubMunicipalityCatalogue,
    });
    try {
      const response = await fetch(`${apiBaseUrl}/grievances/${encodeURIComponent(ref)}/comment`, {
        method: 'POST',
        headers: authHeaders(token, true, scope),
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
      onGrievancesMutated?.();
      onBanner(t('status.ready', language));
    } catch (e: unknown) {
      onBanner(
        e instanceof TypeError
          ? 'Network error — check the API is reachable and NEXT_PUBLIC_API_BASE_URL is correct.'
          : e instanceof Error
            ? e.message
            : 'Request failed',
      );
    }
  }

  async function postFeedback(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !detailPayload) {
      return;
    }
    const ref = detailPayload.grievance.grievance_no;
    const scope = grievanceRowTenantScope({
      workspaceTenantCode: tenantScopeCode,
      grievanceTenantId: detailPayload.grievance.tenant_id,
      hubCatalogue: hubMunicipalityCatalogue,
    });
    const response = await fetch(`${apiBaseUrl}/grievances/${encodeURIComponent(ref)}/feedback`, {
      method: 'POST',
      headers: authHeaders(token, true, scope),
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
    const detailScope = grievanceRowTenantScope({
      workspaceTenantCode: tenantScopeCode,
      grievanceTenantId: row.tenant_id,
      hubCatalogue: hubMunicipalityCatalogue,
    });

    try {
      const detailRes = await fetch(
        `${apiBaseUrl}/grievances/${encodeURIComponent(row.grievance_no)}`,
        { headers: authHeaders(token, false, detailScope) },
      );
      if (!detailRes.ok) {
        setDetailPayload({
          grievance: row,
          timeline: [],
        });
      } else {
        setDetailPayload((await detailRes.json()) as GrievanceDetailResponse);
      }
    } catch {
      setDetailPayload({
        grievance: row,
        timeline: [],
      });
    }
    await reloadList();
    onGrievancesMutated?.();
    onBanner(t('status.ready', language));
  }

  async function postReopen(): Promise<void> {
    if (!token || !detailPayload) {
      return;
    }
    const ref = detailPayload.grievance.grievance_no;
    const scope = grievanceRowTenantScope({
      workspaceTenantCode: tenantScopeCode,
      grievanceTenantId: detailPayload.grievance.tenant_id,
      hubCatalogue: hubMunicipalityCatalogue,
    });
    const response = await fetch(`${apiBaseUrl}/grievances/${encodeURIComponent(ref)}/reopen`, {
      method: 'POST',
      headers: authHeaders(token, true, scope),
      body: JSON.stringify({
        ...(reopenDraft.trim() ? { reason: reopenDraft.trim() } : {}),
      }),
    });
    if (!response.ok) {
      onBanner(await readApiError(response));
      return;
    }
    const row = (await response.json()) as GrievanceApiRow;

    try {
      const detailRes = await fetch(
        `${apiBaseUrl}/grievances/${encodeURIComponent(row.grievance_no)}`,
        { headers: authHeaders(token, false, scope) },
      );
      if (!detailRes.ok) {
        setDetailPayload({
          grievance: row,
          timeline: [],
        });
      } else {
        setDetailPayload((await detailRes.json()) as GrievanceDetailResponse);
      }
    } catch {
      setDetailPayload({
        grievance: row,
        timeline: [],
      });
    }

    setReopenDraft('');
    await reloadList();
    onGrievancesMutated?.();
    onBanner(t('status.ready', language));
  }

  async function submitNew(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !pickedCategory || description.trim().length < 3) {
      onBanner(t('grievance.submitError', language));
      return;
    }

    const categoryRow = catalogue?.categories.find((row) => row.code === pickedCategory);
    if (categoryRow && categoryRow.subtypes.length > 0 && !pickedSubtype) {
      onBanner(t('grievance.chooseSubtype', language));
      setSurface('pickSubtype');
      return;
    }

    const location: Record<string, string | number> = {};
    if (locNote.trim()) {
      location.address = locNote.trim();
    }
    if (wardHint.trim()) {
      location.ward_hint = wardHint.trim();
    }
    const latFromMap = mapPin?.lat;
    const lngFromMap = mapPin?.lng;
    const lat = latFromMap ?? parseLatLngField(latitudeStr);
    const lng = lngFromMap ?? parseLatLngField(longitudeStr);
    if (latitudeStr.trim() && lat === undefined) {
      onBanner('Latitude must be a valid number between -90 and 90, or leave the field blank.');
      return;
    }
    if (longitudeStr.trim() && lng === undefined) {
      onBanner('Longitude must be a valid number between -180 and 180, or leave the field blank.');
      return;
    }
    if (lat !== undefined && lng === undefined && !longitudeStr.trim()) {
      onBanner('Longitude is required when latitude is provided.');
      return;
    }
    if (lng !== undefined && lat === undefined && !latitudeStr.trim()) {
      onBanner('Latitude is required when longitude is provided.');
      return;
    }
    if (lat !== undefined && (lat < -90 || lat > 90)) {
      onBanner('Latitude must be between -90 and 90.');
      return;
    }
    if (lng !== undefined && (lng < -180 || lng > 180)) {
      onBanner('Longitude must be between -180 and 180.');
      return;
    }
    if (lat !== undefined) {
      location.latitude = lat;
    }
    if (lng !== undefined) {
      location.longitude = lng;
    }

    if (!grievanceWriteScope) {
      onBanner(
        'Choose a municipality before filing — use “File grievance” from the hub again and pick a ULB.',
      );
      return;
    }

    setSubmittingGrievance(true);
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/grievances`, {
        method: 'POST',
        headers: authHeaders(token, true, grievanceWriteScope),
        body: JSON.stringify({
          category: pickedCategory,
          ...(pickedSubtype ? { subtype_code: pickedSubtype } : {}),
          description: description.trim(),
          grievance_priority: priority,
          ...(Object.keys(location).length > 0 ? { location } : {}),
        }),
      });
    } catch (e: unknown) {
      setSubmittingGrievance(false);
      onBanner(
        e instanceof TypeError
          ? 'Network error — check the API is reachable and NEXT_PUBLIC_API_BASE_URL is correct.'
          : e instanceof Error
            ? e.message
            : 'Request failed',
      );
      return;
    }

    if (!response.ok) {
      setSubmittingGrievance(false);
      onBanner(await readApiError(response));
      return;
    }

    const row = (await response.json()) as GrievanceApiRow;

    if (pendingEvidence.length > 0) {
      try {
        await attachPendingEvidenceToGrievance(
          apiBaseUrl,
          authHeaders(token, true, grievanceWriteScope),
          row.id,
          pendingEvidence.map((item) => item.file),
        );
      } catch (e: unknown) {
        setSubmittingGrievance(false);
        onBanner(
          e instanceof Error
            ? `Grievance filed (${row.grievance_no}) but evidence upload failed: ${e.message}`
            : 'Grievance filed but evidence upload failed.',
        );
        setLastCreated(row);
        setSurface('done');
        return;
      }
    }

    setSubmittingGrievance(false);
    setLastCreated(row);
    setSurface('done');
    setDescription('');
    setLocNote('');
    setWardHint('');
    setLatitudeStr('');
    setLongitudeStr('');
    setMapPin(null);
    setShowManualCoords(false);
    setPendingEvidence([]);
    setPickedCategory(null);
    if (!workspaceScope) {
      setFilingTenantCode(null);
      setTenantPickQuery('');
    }
    await reloadList();
    onGrievancesMutated?.();
    onBanner(t('grievance.filedTitle', language));
  }

  function resetFlow(): void {
    setSurface('list');
    setPickedCategory(null);
    setLastCreated(null);
    setDetailPayload(null);
    if (!workspaceScope) {
      setFilingTenantCode(null);
      setTenantPickQuery('');
    }
  }

  function beginFileNewFlow(): void {
    setPickedCategory(null);
    if (workspaceScope) {
      setSurface('pick');
      return;
    }
    const catalogue = hubMunicipalityCatalogue ?? [];
    if (catalogue.length === 0) {
      onBanner('Municipality list not loaded — use Refresh hub, then try again.');
      return;
    }
    setTenantPickQuery('');
    setSurface('selectTenant');
  }

  const filteredHubTenantsForPick = (hubMunicipalityCatalogue ?? []).filter((row) =>
    tenantMatchesHubPickQuery(row, tenantPickQuery),
  );

  const filingTenantLabel =
    workspaceScope ??
    (filingTenantCode
      ? (hubMunicipalityCatalogue?.find((row) => row.code === filingTenantCode)?.name ??
        filingTenantCode)
      : null);

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

  if (surface === 'selectTenant') {
    return (
      <section className="space-y-4">
        <button
          className="text-sm font-semibold text-brand"
          onClick={() => {
            setFilingTenantCode(null);
            setTenantPickQuery('');
            setSurface('list');
          }}
          type="button"
        >
          ← {t('grievance.back', language)}
        </button>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">Choose municipality</h3>
          <p className="mt-2 text-sm text-slate-600">
            Grievances are filed under one ULB at a time. Pick the municipality where this grievance
            applies — the API needs your selection before submit (same as workspace filing).
          </p>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Search by code, name, or district
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              onChange={(event) => setTenantPickQuery(event.target.value)}
              placeholder="e.g. KMC or Kolkata"
              type="search"
              value={tenantPickQuery}
            />
          </label>
          <ul className="mt-6 max-h-[min(55vh,420px)] space-y-2 overflow-y-auto">
            {filteredHubTenantsForPick.map((tenantRow) => (
              <li key={tenantRow.code}>
                <button
                  className="flex w-full rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-brand/40"
                  onClick={() => {
                    setFilingTenantCode(tenantRow.code);
                    setSurface('pick');
                  }}
                  type="button"
                >
                  <span
                    className="mr-3 mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tenantRow.theme_color }}
                  />
                  <span>
                    <span className="block font-semibold">{tenantRow.code}</span>
                    <span className="block text-sm text-slate-600">{tenantRow.name}</span>
                    <span className="block text-[11px] uppercase text-slate-400">
                      {tenantRow.district}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {filteredHubTenantsForPick.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">No municipalities match your search.</p>
          ) : null}
        </div>
      </section>
    );
  }

  if (surface === 'pick') {
    return (
      <section className="space-y-4">
        <button
          className="text-sm font-semibold text-brand"
          onClick={() => {
            if (!workspaceScope && filingTenantCode) {
              setSurface('selectTenant');
              return;
            }
            setSurface('list');
          }}
          type="button"
        >
          ← {t('grievance.back', language)}
        </button>
        {!workspaceScope && filingTenantCode ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand/25 bg-brand/5 px-4 py-3 text-sm">
            <span className="text-slate-800">
              <strong>Filing under:</strong> {filingTenantCode}
              {filingTenantLabel && filingTenantLabel !== filingTenantCode ? (
                <span className="text-slate-600"> · {filingTenantLabel}</span>
              ) : null}
            </span>
            <button
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
              onClick={() => setSurface('selectTenant')}
              type="button"
            >
              Change municipality
            </button>
          </div>
        ) : null}
        <h3 className="text-xl font-bold">{t('grievance.chooseCategory', language)}</h3>
        {catalogueLoading ? (
          <p className="text-sm text-slate-600">{t('status.sendingOtp', language)}</p>
        ) : null}
        {catalogueError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {catalogueError}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {sortCatalogueCategories(catalogue?.categories ?? []).map((row) => (
            <button
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand"
              key={row.code}
              onClick={() => {
                setPickedCategory(row.code);
                setPickedSubtype(null);
                if (row.subtypes.length > 0) {
                  setSurface('pickSubtype');
                } else {
                  setSurface('compose');
                }
              }}
              type="button"
            >
              <span className="font-semibold">
                {resolveGrievanceCategoryLabel(row.code, row.name, language)}
              </span>
            </button>
          ))}
        </div>
        {!catalogueLoading && !catalogueError && !(catalogue?.categories.length ?? 0) ? (
          <p className="text-sm text-slate-600">
            No grievance categories are available for this municipality.
          </p>
        ) : null}
      </section>
    );
  }

  if (surface === 'pickSubtype' && pickedCategory) {
    const categoryRow = catalogue?.categories.find((row) => row.code === pickedCategory);
    const subtypes = categoryRow?.subtypes ?? [];
    return (
      <section className="space-y-4">
        <button
          className="text-sm font-semibold text-brand"
          onClick={() => setSurface('pick')}
          type="button"
        >
          ← {t('grievance.back', language)}
        </button>
        <h3 className="text-xl font-bold">{t('grievance.chooseSubtype', language)}</h3>
        <p className="text-sm text-slate-600">
          {resolveGrievanceCategoryLabel(pickedCategory, categoryRow?.name, language)}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {subtypes.map((subtype) => (
            <button
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand"
              key={subtype.code}
              onClick={() => {
                setPickedSubtype(subtype.code);
                setSurface('compose');
              }}
              type="button"
            >
              <span className="font-semibold">
                {resolveGrievanceSubtypeLabel(subtype, language)}
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (surface === 'compose' && pickedCategory) {
    const composeCategory = catalogue?.categories.find((row) => row.code === pickedCategory);
    return (
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <button
          className="text-sm font-semibold text-brand"
          onClick={() => {
            if (composeCategory && composeCategory.subtypes.length > 0) {
              setSurface('pickSubtype');
              return;
            }
            setSurface('pick');
          }}
          type="button"
        >
          ← {t('grievance.back', language)}
        </button>
        {!workspaceScope && filingTenantCode ? (
          <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-2 text-xs text-slate-700">
            Municipality for this grievance: <strong>{filingTenantCode}</strong>
            {' · '}
            <button
              className="font-semibold text-brand underline"
              onClick={() => setSurface('selectTenant')}
              type="button"
            >
              Change
            </button>
          </p>
        ) : null}
        <h3 className="mt-2 text-xl font-bold">
          {resolveGrievanceCategoryLabel(pickedCategory, composeCategory?.name, language)}
          {pickedSubtype
            ? ` · ${subtypeLabelFromCatalogue(catalogue, pickedCategory, pickedSubtype, language) ?? pickedSubtype}`
            : ''}
        </h3>
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
            <span className="flex flex-wrap items-center justify-between gap-2">
              {t('grievance.priority', language)}
              <ToneChip label="Selected" tone={grievancePriorityTone(priority)} />
            </span>
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

          <GrievanceEvidenceField
            language={language}
            items={pendingEvidence}
            onChange={setPendingEvidence}
            onError={onBanner}
          />

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-700">
              {t('grievance.mapPinTitle', language)}
            </legend>
            <p className="text-xs text-slate-600">{t('grievance.mapPinHelp', language)}</p>
            <GrievanceLocationMap
              latitude={mapPin?.lat ?? null}
              longitude={mapPin?.lng ?? null}
              onPinChange={(lat, lng) => {
                setMapPin({ lat, lng });
                setLatitudeStr(String(lat));
                setLongitudeStr(String(lng));
              }}
              onError={onBanner}
            />
            <button
              type="button"
              className="text-xs font-semibold text-brand underline"
              onClick={() => setShowManualCoords((value) => !value)}
            >
              {showManualCoords
                ? t('grievance.mapHideManual', language)
                : t('grievance.mapShowManual', language)}
            </button>
            {showManualCoords ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-slate-600">
                  Latitude
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                    inputMode="decimal"
                    onChange={(event) => {
                      setLatitudeStr(event.target.value);
                      const parsed = parseLatLngField(event.target.value);
                      const lngParsed = parseLatLngField(longitudeStr);
                      if (parsed !== undefined && lngParsed !== undefined) {
                        setMapPin({ lat: parsed, lng: lngParsed });
                      }
                    }}
                    placeholder="-90 … 90"
                    value={latitudeStr}
                  />
                </label>
                <label className="block text-xs text-slate-600">
                  Longitude
                  <input
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                    inputMode="decimal"
                    onChange={(event) => {
                      setLongitudeStr(event.target.value);
                      const parsed = parseLatLngField(event.target.value);
                      const latParsed = parseLatLngField(latitudeStr);
                      if (parsed !== undefined && latParsed !== undefined) {
                        setMapPin({ lat: latParsed, lng: parsed });
                      }
                    }}
                    placeholder="-180 … 180"
                    value={longitudeStr}
                  />
                </label>
              </div>
            ) : null}
          </fieldset>

          <button
            className="w-full rounded-2xl bg-brand px-5 py-3 font-semibold text-white disabled:opacity-60"
            type="submit"
            disabled={submittingGrievance}
          >
            {submittingGrievance
              ? t('grievance.submitting', language)
              : t('grievance.submit', language)}
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
    const showReopen = grievanceEligibleForCitizenReopen(g);
    const statusTone = grievanceStatusTone(g.status);
    const priorityTone = grievancePriorityTone(g.grievance_priority);

    return (
      <section className="space-y-4">
        <button className="text-sm font-semibold text-brand" onClick={resetFlow} type="button">
          ← {t('grievance.nav', language)}
        </button>
        <div className="overflow-hidden rounded-[2rem] border border-warm-border bg-white shadow-sm">
          <div className="border-b border-warm-border bg-mint-band p-6">
            <p className="font-mono text-xs font-black uppercase tracking-[0.16em] text-brand">
              {g.grievance_no}
            </p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-3xl font-black leading-tight text-ink-primary">
                  {tTryCategoryLabel(
                    g.category,
                    language,
                    catalogueForGrievanceRow(
                      g,
                      workspaceScope,
                      catalogue,
                      hubCatalogues,
                      hubMunicipalityCatalogue,
                    ),
                    g.subtype_code,
                  )}
                </h3>
                <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-ink-secondary">
                  {g.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ToneChip label="Status" tone={statusTone} />
                <ToneChip label="Priority" tone={priorityTone} />
              </div>
            </div>
          </div>
          <div className="p-6">
            {typeof g.location === 'object' &&
            g.location !== null &&
            'latitude' in g.location &&
            'longitude' in g.location ? (
              <p className="mt-2 text-sm font-medium text-slate-700">
                Map pin (WGS-84): {(g.location as { latitude: number }).latitude},{' '}
                {(g.location as { longitude: number }).longitude}
              </p>
            ) : null}
            <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
              <DetailStat
                label={t('grievance.categoryLabel', language)}
                value={tTryCategoryLabel(
                  g.category,
                  language,
                  catalogueForGrievanceRow(
                    g,
                    workspaceScope,
                    catalogue,
                    hubCatalogues,
                    hubMunicipalityCatalogue,
                  ),
                  g.subtype_code,
                )}
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
            {token && Array.isArray(g.attachments) && g.attachments.length > 0 ? (
              <GrievanceEvidencePreviewGrid
                apiBaseUrl={apiBaseUrl}
                token={token}
                grievanceId={g.id}
                tenantScopeCode={grievanceRowTenantScope({
                  workspaceTenantCode: tenantScopeCode,
                  grievanceTenantId: g.tenant_id,
                  hubCatalogue: hubMunicipalityCatalogue,
                })}
                attachments={g.attachments}
              />
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-warm-border bg-white p-6 shadow-sm">
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

        <div className="rounded-3xl border border-warm-border bg-white p-6 shadow-sm">
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

        {showReopen ? (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
            <h4 className="font-bold text-rose-900">
              {t('grievance.reopenSectionTitle', language)}
            </h4>
            <p className="mt-2 text-sm text-rose-900/90">{t('grievance.reopenHelp', language)}</p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void postReopen();
              }}
            >
              <label className="block text-sm font-medium text-rose-950">
                {t('grievance.reopenReasonPlaceholder', language)}
                <textarea
                  className="mt-2 w-full rounded-2xl border border-rose-200 bg-white px-4 py-3"
                  onChange={(event) => setReopenDraft(event.target.value)}
                  rows={3}
                  value={reopenDraft}
                />
              </label>
              <button
                className="rounded-2xl bg-rose-700 px-4 py-2 font-semibold text-white"
                type="submit"
              >
                {t('grievance.reopenSubmit', language)}
              </button>
            </form>
          </div>
        ) : null}

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

        {g.status === 'closed' ? (
          <p className="text-center text-xs text-slate-500">
            {t('grievance.caseClosedFootnote', language)}
          </p>
        ) : null}

        {g.status !== 'closed' && g.status !== 'resolved' ? (
          <p className="text-center text-xs text-slate-500">
            {t('grievance.caseProgressFootnote', language)}
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
            onClick={beginFileNewFlow}
            type="button"
          >
            {t('grievance.fileNew', language)}
          </button>
        </div>
      </div>

      {slaInboxUnread > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Service alerts:</strong> you have {slaInboxUnread} unread SLA{' '}
          {slaInboxUnread === 1 ? 'notice' : 'notices'} — open a grievance below and review the
          timeline.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((item) => {
          const tenantColor =
            hubMunicipalityCatalogue?.find(
              (tenantRow) => tenantRow.id === item.tenant_id || tenantRow.code === tenantScopeCode,
            )?.theme_color ?? 'rgb(var(--brand-rgb))';
          const statusTone = grievanceStatusTone(item.status);
          const priorityTone = grievancePriorityTone(item.grievance_priority);

          return (
            <article
              className="group relative overflow-hidden rounded-[1.75rem] border border-warm-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              key={item.id}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1.5"
                style={{ backgroundColor: tenantColor }}
              />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-black text-brand">{item.grievance_no}</p>
                  <h4 className="mt-2 text-xl font-black leading-tight text-ink-primary">
                    {tTryCategoryLabel(
                      item.category,
                      language,
                      catalogueForGrievanceRow(
                        item,
                        workspaceScope,
                        catalogue,
                        hubCatalogues,
                        hubMunicipalityCatalogue,
                      ),
                      item.subtype_code,
                    )}
                  </h4>
                </div>
                <span
                  className="h-3 w-3 rounded-full shadow-sm ring-4 ring-white"
                  style={{ backgroundColor: tenantColor }}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-secondary">
                {item.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 rounded-2xl bg-slate-50/80 p-3">
                <ToneChip label={t('grievance.statusLabel', language)} tone={statusTone} />
                <ToneChip label={t('grievance.priorityLabel', language)} tone={priorityTone} />
              </div>
              <button
                className="mt-4 w-full rounded-2xl border border-brand px-4 py-2 text-sm font-black text-brand transition group-hover:bg-brand group-hover:text-brand-fg"
                onClick={() => void openDetail(item)}
                type="button"
              >
                {t('grievance.open', language)}
              </button>
            </article>
          );
        })}
      </div>
      {!loadingList && list.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-brand-muted bg-brand-surface/70 p-6 text-center text-sm leading-6 text-ink-secondary">
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

function ToneChip({ label, tone }: { label: string; tone: GrievanceTone }): JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${tone.pillClassName}`}
    >
      <span className={`h-2 w-2 rounded-full ${tone.dotClassName}`} />
      <span className="text-[10px] opacity-70">{label}</span>
      {tone.label}
    </span>
  );
}

function tTryCategoryLabel(
  category: string,
  locale: LanguageCode,
  catalogue?: GrievanceCatalogueResponse | null,
  subtypeCode?: string | null,
): string {
  const categoryLabel = categoryLabelFromCatalogue(catalogue, category, locale);
  const subtypeLabel = subtypeLabelFromCatalogue(catalogue, category, subtypeCode, locale);
  if (subtypeLabel) {
    return `${categoryLabel} · ${subtypeLabel}`;
  }
  return categoryLabel;
}
