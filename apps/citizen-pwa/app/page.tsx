'use client';

import {
  createRenderPlan,
  validateSubmission,
  type EnagarFormSchema,
  type FileSubmission,
  type FormSubmission,
  type FormSubmissionValue,
} from '@enagar/forms';
import { DynamicFormFields } from '@enagar/forms/web';
import { t } from '@enagar/i18n';
import { applyTenantTheme } from '@enagar/tenant-theme';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ApplicationDetailPanel,
  ReceiptPreviewPlaceholder,
} from '../components/application-detail-panel';
import { GrievancesWorkspace } from '../components/grievances-workspace';
import { defaultFormValuesForService, schemaByServiceCode } from '../lib/service-schemas';
import {
  authHeaders,
  CITIZEN_PORTAL_OPTION_A_TENANT_CODE,
  formatInrFromPaise,
  getFixedFeePaise,
  readApiError,
} from '../lib/workspace-http';

import type {
  ApplicationDetail,
  ApplicationSummary,
  CitizenHubDashboardResponse,
  CitizenPreferencesResponse,
  PaymentApiResponse,
  PaymentGatewayMethod,
  ServiceSummary,
  TokenResponse,
  PwaLocaleCode,
} from '../lib/workspace-types';

type LanguageCode = PwaLocaleCode;
type Step = 'splash' | 'language' | 'login' | 'otp' | 'pins' | 'hub' | 'workspace';
type WorkspaceTab = 'home' | 'services' | 'apply' | 'applications' | 'payments' | 'grievances';
type HubTab = WorkspaceTab | 'shortcuts';

interface TenantSummary {
  id: string;
  code: string;
  name: string;
  district: string;
  ward_count: number;
  theme_color: string;
  logo_url: string | null;
  languages_enabled: LanguageCode[];
}

interface HoldingLookupResponse {
  found: boolean;
  holding: {
    holding_number: string;
    owner_display_name: string;
    ward_number: string;
    locality: string;
    outstanding_amount: number;
    source_updated_at: string;
  } | null;
  audit: {
    outcome: 'found' | 'not_found';
  };
}

interface UploadIntentResponse {
  id: string;
  object_key: string;
  scan_status: string;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

async function fetchActiveTenantServices(
  apiRoot: string,
  tenantCode: string,
): Promise<ServiceSummary[]> {
  const response = await fetch(`${apiRoot}/services/tenants/${encodeURIComponent(tenantCode)}`);
  if (!response.ok) {
    throw new Error('Unable to load services');
  }
  const list = (await response.json()) as ServiceSummary[];
  return list.filter((service) => service.active);
}

function tenantMatchesBrowseQuery(tenant: TenantSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    tenant.code.toLowerCase().includes(q) ||
    tenant.name.toLowerCase().includes(q) ||
    tenant.district.toLowerCase().includes(q)
  );
}

async function storeEncryptedToken(token: TokenResponse): Promise<void> {
  const payload = JSON.stringify({
    ...token,
    stored_at: new Date().toISOString(),
  });

  if (!globalThis.crypto?.subtle) {
    sessionStorage.setItem('enagar.auth.dev', payload);
    return;
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('enagarseba-sprint-1.3-browser-key'),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(payload),
  );

  sessionStorage.setItem(
    'enagar.auth',
    JSON.stringify({
      salt: Array.from(salt),
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(encrypted)),
    }),
  );
}

export default function HomePage(): JSX.Element {
  const [step, setStep] = useState<Step>('splash');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('home');
  const [hubTab, setHubTab] = useState<HubTab>('home');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [token, setToken] = useState<TokenResponse | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [hubDashboard, setHubDashboard] = useState<CitizenHubDashboardResponse | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceSummary | null>(null);
  const [formValues, setFormValues] = useState<FormSubmission>({});
  const [holdingLookup, setHoldingLookup] = useState<HoldingLookupResponse | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [payments, setPayments] = useState<PaymentApiResponse[]>([]);
  const [grievanceCount, setGrievanceCount] = useState(0);
  const [hubApplications, setHubApplications] = useState<ApplicationSummary[]>([]);
  const [hubPayments, setHubPayments] = useState<PaymentApiResponse[]>([]);
  /** Per-tenant active services keyed by pinned + shortcut ULBs only (lazy; Sprint 4.16). */
  const [hubTenantServiceMap, setHubTenantServiceMap] = useState<Record<string, ServiceSummary[]>>(
    {},
  );
  const [citizenPreferences, setCitizenPreferences] = useState<CitizenPreferencesResponse | null>(
    null,
  );
  const [municipalityBrowseOpen, setMunicipalityBrowseOpen] = useState(false);
  const [browseQuery, setBrowseQuery] = useState('');
  const [pinsDraftCodes, setPinsDraftCodes] = useState<string[]>([]);
  const [pinsSearch, setPinsSearch] = useState('');
  /** Hub → Shortcuts edit drafts (applied on Save). */
  const [shortcutPinsDraft, setShortcutPinsDraft] = useState<string[]>([]);
  const [shortcutServicesDraft, setShortcutServicesDraft] = useState<
    Array<{ tenant_code: string; service_code: string }>
  >([]);
  const [shortcutPinsSearch, setShortcutPinsSearch] = useState('');
  const [shortcutAddTenant, setShortcutAddTenant] = useState('');
  const [shortcutAddService, setShortcutAddService] = useState('');
  /** Workspace Services tab optional filter when opening via pinned shortcut (Sprint 4.16). */
  const [workspaceServiceCodesFilter, setWorkspaceServiceCodesFilter] = useState<string[] | null>(
    null,
  );
  const [detailFeeServices, setDetailFeeServices] = useState<ServiceSummary[]>([]);
  const [applicationDetail, setApplicationDetail] = useState<ApplicationDetail | null>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState(t('status.ready', 'en'));

  const cataloguedDashboardRows = useMemo(() => {
    if (!hubDashboard) {
      return [];
    }
    const byCode = new Map(tenants.map((tenant) => [tenant.code, tenant]));
    return [...hubDashboard.municipalities]
      .map((bucket) => {
        const catalogue = byCode.get(bucket.tenant_code);
        return {
          bucket,
          catalogue,
          shortName: catalogue?.name.replace(' Municipal', '') ?? bucket.tenant_code,
        };
      })
      .sort((left, right) => {
        const leftTotal =
          left.bucket.application_count + left.bucket.payment_count + left.bucket.grievance_count;
        const rightTotal =
          right.bucket.application_count +
          right.bucket.payment_count +
          right.bucket.grievance_count;
        return rightTotal !== leftTotal
          ? rightTotal - leftTotal
          : left.bucket.tenant_code.localeCompare(right.bucket.tenant_code);
      });
  }, [hubDashboard, tenants]);

  const pinnedHubHomeRows = useMemo(() => {
    const pins = citizenPreferences?.pinned_tenant_codes ?? [];
    if (!pins.length || !hubDashboard) {
      return [];
    }

    const byBucketCode = new Map(
      cataloguedDashboardRows.map((row) => [row.bucket.tenant_code, row]),
    );
    return pins
      .map((code) => byBucketCode.get(code))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }, [citizenPreferences?.pinned_tenant_codes, hubDashboard, cataloguedDashboardRows]);

  const tenantsById = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant])),
    [tenants],
  );

  const browseTenantsFiltered = useMemo(
    () => tenants.filter((tenant) => tenantMatchesBrowseQuery(tenant, browseQuery)),
    [tenants, browseQuery],
  );

  const pinsCatalogueFiltered = useMemo(
    () => tenants.filter((tenant) => tenantMatchesBrowseQuery(tenant, pinsSearch)),
    [tenants, pinsSearch],
  );

  const shortcutPinCatalogueFiltered = useMemo(
    () => tenants.filter((tenant) => tenantMatchesBrowseQuery(tenant, shortcutPinsSearch)),
    [tenants, shortcutPinsSearch],
  );

  const workspaceServicesFiltered = useMemo(() => {
    if (!workspaceServiceCodesFilter?.length) {
      return services;
    }
    const allow = new Set(workspaceServiceCodesFilter);
    return services.filter((service) => allow.has(service.code));
  }, [services, workspaceServiceCodesFilter]);

  const hubTotalsFromBuckets = useMemo(() => {
    if (!hubDashboard) {
      return null;
    }
    return hubDashboard.municipalities.reduce(
      (acc, bucket) => {
        acc.applications += bucket.application_count;
        acc.payments += bucket.payment_count;
        acc.grievances += bucket.grievance_count;
        return acc;
      },
      { applications: 0, payments: 0, grievances: 0 },
    );
  }, [hubDashboard]);

  /** Fallback if API lacks `distinct_active_service_codes` (legacy). */
  const distinctServicesFallback = useMemo(() => {
    const distinct = new Set<string>();
    for (const rows of Object.values(hubTenantServiceMap)) {
      for (const service of rows) {
        distinct.add(service.code);
      }
    }
    return distinct.size;
  }, [hubTenantServiceMap]);

  const servicesKpiValue = hubDashboard?.distinct_active_service_codes ?? distinctServicesFallback;

  /** Municipality header for workspace-scoped browse lists (`X-Enagar-Tenant-Code`). */
  function workspaceLoadScope(): string | undefined {
    return selectedTenant?.code;
  }

  /** Municipality header for dossier mutations when opened from hub or workspace. */
  function dossierMunicipalityScope(): string | undefined {
    return selectedTenant?.code ?? applicationDetail?.tenant_code ?? undefined;
  }

  /** Hub aggregate lists (`hubApplications` / `hubPayments`), no scope header. */
  async function reloadHubPortfolioLists(scopes: 'payments' | 'both' = 'both'): Promise<void> {
    if (!token || step !== 'hub') {
      return;
    }
    try {
      if (scopes === 'payments') {
        const payRes = await fetch(`${apiBaseUrl}/payments`, {
          headers: authHeaders(token, false),
        });
        if (payRes.ok) {
          setHubPayments((await payRes.json()) as PaymentApiResponse[]);
        }
        return;
      }
      const [appsRes, payRes] = await Promise.all([
        fetch(`${apiBaseUrl}/applications`, { headers: authHeaders(token, false) }),
        fetch(`${apiBaseUrl}/payments`, { headers: authHeaders(token, false) }),
      ]);
      if (appsRes.ok) {
        setHubApplications((await appsRes.json()) as ApplicationSummary[]);
      }
      if (payRes.ok) {
        setHubPayments((await payRes.json()) as PaymentApiResponse[]);
      }
    } catch {
      /* Ignore — user can Refresh hub if needed. */
    }
  }

  /** Fee catalogue for dossier sidebar: workspace list vs hub-only fetch keyed by application's ULB. */
  const feeServicesForDetailPanel =
    step === 'workspace' && selectedTenant ? services : detailFeeServices;
  const selectedSchema = selectedService
    ? schemaByServiceCode.get(selectedService.code)
    : undefined;
  const renderPlan = selectedSchema
    ? createRenderPlan(selectedSchema, { locale: language, platform: 'web' })
    : null;
  const latestApplication = applications[0];

  useEffect(() => {
    if (step !== 'hub' || !token) {
      return;
    }

    void refreshHubData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, token]);

  useEffect(() => {
    if (step !== 'workspace' || !selectedTenant) {
      return;
    }

    void refreshWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedTenant?.code]);

  useEffect(() => {
    if (step !== 'hub' || !applicationDetail?.tenant_code) {
      setDetailFeeServices([]);
      return;
    }

    let cancelled = false;

    void fetchActiveTenantServices(apiBaseUrl, applicationDetail.tenant_code)
      .then((next) => {
        if (!cancelled) {
          setDetailFeeServices(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetailFeeServices([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [step, applicationDetail?.tenant_code]);

  useEffect(() => {
    if (step !== 'pins') {
      return;
    }

    void (async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/tenants`);
        if (response.ok) {
          setTenants((await response.json()) as TenantSummary[]);
        }
      } catch {
        /* Pins screen uses public catalogue; hub refresh will reconcile. */
      }
    })();
  }, [step]);

  async function requestOtp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus(t('status.sendingOtp', language));

    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/auth/send-otp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mobile, tenant_code: CITIZEN_PORTAL_OPTION_A_TENANT_CODE }),
      });
    } catch {
      setStatus(t('status.apiUnreachable', language));
      return;
    }

    if (!response.ok) {
      setStatus('Could not send OTP. Check API/Keycloak.');
      return;
    }

    setStatus(t('status.otpSent', language));
    setStep('otp');
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus('Verifying OTP...');

    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mobile,
          otp,
          tenant_code: CITIZEN_PORTAL_OPTION_A_TENANT_CODE,
        }),
      });
    } catch {
      setStatus(t('status.apiUnreachable', language));
      return;
    }

    if (!response.ok) {
      setStatus(t('status.otpKeycloakRequired', language));
      return;
    }

    const nextToken = (await response.json()) as TokenResponse;
    setToken(nextToken);
    await storeEncryptedToken(nextToken);
    try {
      await fetch(`${apiBaseUrl}/citizen/language`, {
        method: 'PATCH',
        headers: authHeaders(nextToken, true),
        body: JSON.stringify({ language_pref: language }),
      });
    } catch {
      /* Non-blocking — hub KPI mirrors session locale; profile may sync later. */
    }

    /** Grievances (`ensureMunicipalCitizenRow`) need a non-empty `citizens.mobile` for this subject. */
    let profileRegisterMessage: string | null = null;
    try {
      const normalizedMobile = mobile.replace(/\D/g, '').slice(-10);
      if (/^[6-9]\d{9}$/.test(normalizedMobile)) {
        const regResponse = await fetch(`${apiBaseUrl}/citizen/register`, {
          method: 'POST',
          headers: authHeaders(nextToken, true),
          body: JSON.stringify({ mobile: normalizedMobile, language_pref: language }),
        });
        if (!regResponse.ok) {
          profileRegisterMessage = await readApiError(regResponse);
        }
      }
    } catch {
      profileRegisterMessage = t('status.apiUnreachable', language);
    }

    let initialPrefs: CitizenPreferencesResponse | null = null;
    try {
      const prefsResponse = await fetch(`${apiBaseUrl}/citizen/preferences`, {
        headers: authHeaders(nextToken, false),
      });
      if (prefsResponse.ok) {
        initialPrefs = (await prefsResponse.json()) as CitizenPreferencesResponse;
      }
    } catch {
      /* Fallback to onboarding gate when preferences cannot load. */
    }

    setCitizenPreferences(initialPrefs);
    setStatus(
      profileRegisterMessage
        ? `${t('status.loginVerified', language)} — ${profileRegisterMessage}`
        : t('status.loginVerified', language),
    );

    if (initialPrefs?.pinned_tenant_codes.length) {
      setStep('hub');
      return;
    }

    setPinsDraftCodes([]);
    setPinsSearch('');
    setStep('pins');
  }

  async function chooseTenant(
    tenant: TenantSummary,
    opts?: { workspaceServiceCodes?: string[] | null },
  ): Promise<void> {
    setApplicationDetail(null);
    setSelectedTenant(tenant);
    applyTenantTheme(tenant);

    const focusCodes =
      opts?.workspaceServiceCodes && opts.workspaceServiceCodes.length > 0
        ? opts.workspaceServiceCodes
        : null;

    setWorkspaceServiceCodesFilter(focusCodes);
    setActiveTab(focusCodes ? 'services' : 'home');

    if (token?.access_token) {
      try {
        await fetch(`${apiBaseUrl}/citizen/select-tenant`, {
          method: 'POST',
          headers: authHeaders(token, true),
          body: JSON.stringify({ tenant_code: tenant.code }),
        });
      } catch {
        setStatus(t('status.tenantSelectedLocal', language));
      }
    }

    setStatus(`${tenant.code} selected`);
    setStep('workspace');
  }

  async function persistCitizenPreferences(
    patch: Partial<CitizenPreferencesResponse>,
    successStatus?: string,
  ): Promise<boolean> {
    if (!token) {
      return false;
    }
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/citizen/preferences`, {
        method: 'PATCH',
        headers: authHeaders(token, true),
        body: JSON.stringify(patch),
      });
    } catch {
      setStatus(t('status.apiUnreachable', language));
      return false;
    }
    if (!response.ok) {
      setStatus(await readApiError(response));
      return false;
    }

    try {
      const next = (await response.json()) as CitizenPreferencesResponse;
      setCitizenPreferences(next);
      if (successStatus) {
        setStatus(successStatus);
      }
      return true;
    } catch {
      setStatus('Unable to parse preferences.');
      return false;
    }
  }

  async function persistOnboardingPins(): Promise<boolean> {
    if (pinsDraftCodes.length === 0) {
      setStatus('Choose at least one municipality to pin (max 15).');
      return false;
    }

    const ok = await persistCitizenPreferences(
      { pinned_tenant_codes: pinsDraftCodes },
      'Preferences saved.',
    );

    if (ok) {
      setHubTab('home');
      setStep('hub');
    }
    return ok;
  }

  async function persistShortcutPinsAndServices(): Promise<boolean> {
    if (shortcutPinsDraft.length === 0) {
      setStatus('Keep at least one pinned municipality.');
      return false;
    }

    return persistCitizenPreferences(
      {
        pinned_tenant_codes: shortcutPinsDraft,
        pinned_services: shortcutServicesDraft,
      },
      'Shortcuts saved.',
    );
  }

  function goBackToHub(): void {
    applyTenantTheme(null);
    setSelectedTenant(null);
    setActiveTab('home');
    setHubTab('home');
    setApplicationDetail(null);
    setSelectedService(null);
    setWorkspaceServiceCodesFilter(null);
    setStatus(t('status.ready', language));
    setStep('hub');
  }

  async function refreshHubData(): Promise<void> {
    if (!token) {
      setHubDashboard(null);
      setTenants([]);
      setHubApplications([]);
      setHubPayments([]);
      setHubTenantServiceMap({});
      return;
    }

    setStatus('Loading dashboard…');

    try {
      const [
        dashboardResponse,
        catalogueResponse,
        applicationsResponse,
        paymentsResponse,
        prefsResponse,
      ] = await Promise.all([
        fetch(`${apiBaseUrl}/citizen/dashboard`, { headers: authHeaders(token, false) }),
        fetch(`${apiBaseUrl}/tenants`),
        fetch(`${apiBaseUrl}/applications`, { headers: authHeaders(token, false) }),
        fetch(`${apiBaseUrl}/payments`, { headers: authHeaders(token, false) }),
        fetch(`${apiBaseUrl}/citizen/preferences`, { headers: authHeaders(token, false) }),
      ]);

      if (!dashboardResponse.ok) {
        setStatus(await readApiError(dashboardResponse));
        return;
      }
      if (!catalogueResponse.ok) {
        setStatus('Unable to load tenant catalogue.');
        return;
      }

      const nextDashboard = (await dashboardResponse.json()) as CitizenHubDashboardResponse;
      const nextTenants = (await catalogueResponse.json()) as TenantSummary[];

      let prefsParsed: CitizenPreferencesResponse | null = null;
      if (prefsResponse.ok) {
        try {
          prefsParsed = (await prefsResponse.json()) as CitizenPreferencesResponse;
          setCitizenPreferences(prefsParsed);
        } catch {
          prefsParsed = null;
        }
      }

      if (applicationsResponse.ok) {
        try {
          setHubApplications((await applicationsResponse.json()) as ApplicationSummary[]);
        } catch {
          setHubApplications([]);
        }
      } else {
        setHubApplications([]);
      }

      if (paymentsResponse.ok) {
        try {
          setHubPayments((await paymentsResponse.json()) as PaymentApiResponse[]);
        } catch {
          setHubPayments([]);
        }
      } else {
        setHubPayments([]);
      }

      const pinnedCodesList =
        prefsParsed?.pinned_tenant_codes ?? citizenPreferences?.pinned_tenant_codes ?? [];
      const shortServicesMerged =
        prefsParsed?.pinned_services ?? citizenPreferences?.pinned_services ?? [];
      const svcFetchCodes = [
        ...new Set([...pinnedCodesList, ...shortServicesMerged.map((row) => row.tenant_code)]),
      ];

      const svcEntries = await Promise.all(
        svcFetchCodes.map(async (tenantCode) => {
          try {
            const rows = await fetchActiveTenantServices(apiBaseUrl, tenantCode);
            return [tenantCode, rows] as const;
          } catch {
            return [tenantCode, [] as ServiceSummary[]] as const;
          }
        }),
      );

      setHubDashboard(nextDashboard);
      setTenants(nextTenants);
      setHubTenantServiceMap(Object.fromEntries(svcEntries));

      const effectivePins =
        prefsParsed?.pinned_tenant_codes ?? citizenPreferences?.pinned_tenant_codes ?? [];

      if (effectivePins.length === 0) {
        setPinsDraftCodes([]);
        setStep('pins');
        setStatus('Pin at least one municipality before using the hub.');
      } else {
        setStatus(t('status.ready', language));
      }
    } catch {
      setStatus(t('status.apiUnreachable', language));
    }
  }

  const refreshHubDataRef = useRef(refreshHubData);
  refreshHubDataRef.current = refreshHubData;

  const onHubGrievancesMutated = useCallback(() => {
    void refreshHubDataRef.current();
  }, []);

  async function refreshWorkspace(): Promise<void> {
    if (!selectedTenant) {
      return;
    }

    await Promise.all([
      loadServices(selectedTenant.code),
      loadApplications(),
      loadPayments(),
      loadGrievanceCount(),
    ]);
  }

  async function loadGrievanceCount(): Promise<void> {
    if (!token) {
      setGrievanceCount(0);
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/grievances`, {
        headers: authHeaders(token, false, workspaceLoadScope()),
      });
      if (!response.ok) {
        return;
      }
      const rows = (await response.json()) as unknown[];
      setGrievanceCount(rows.length);
    } catch {
      setGrievanceCount(0);
    }
  }

  async function loadServices(tenantCode: string): Promise<void> {
    try {
      const nextServices = await fetchActiveTenantServices(apiBaseUrl, tenantCode);
      setServices(nextServices);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load services');
    }
  }

  async function loadPayments(): Promise<void> {
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/payments`, {
        headers: authHeaders(token, false, workspaceLoadScope()),
      });
      if (!response.ok) {
        throw new Error('Unable to load payments');
      }
      setPayments((await response.json()) as PaymentApiResponse[]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load payments');
    }
  }

  async function loadApplications(): Promise<void> {
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/applications`, {
        headers: authHeaders(token, false, workspaceLoadScope()),
      });
      if (!response.ok) {
        throw new Error('Unable to load applications');
      }
      setApplications((await response.json()) as ApplicationSummary[]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to load applications');
    }
  }

  function startApplication(service: ServiceSummary): void {
    setSelectedService(service);
    setFormValues(defaultFormValuesForService(service.code));
    setHoldingLookup(null);
    setApplicationDetail(null);
    setActiveTab('apply');
    setStatus(`Applying for ${service.name[language] ?? service.name.en}`);
  }

  function updateFormValue(fieldId: string, value: FormSubmissionValue | undefined): void {
    setFormValues((current) => ({ ...current, [fieldId]: value }));
  }

  async function lookupHolding(): Promise<void> {
    const holdingNumber = String(formValues.holding_number ?? '').trim();
    if (!holdingNumber || !token) {
      setStatus('Enter a holding number first.');
      return;
    }

    const response = await fetch(`${apiBaseUrl}/holdings/${encodeURIComponent(holdingNumber)}`, {
      headers: authHeaders(token, false, workspaceLoadScope()),
    });
    const result = (await response.json()) as HoldingLookupResponse;
    setHoldingLookup(result);
    setStatus(result.found ? 'Holding found.' : 'Holding not found; you can still proceed.');
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedService || !selectedSchema || !token) {
      return;
    }

    const validation = validateSubmission(selectedSchema, formValues);
    if (!validation.ok) {
      setStatus(`Fix form issues: ${validation.issues[0]?.message ?? 'invalid form'}`);
      return;
    }

    setStatus('Creating draft application...');
    const draftResponse = await fetch(`${apiBaseUrl}/applications/drafts`, {
      method: 'POST',
      headers: authHeaders(token, true, workspaceLoadScope()),
      body: JSON.stringify({
        service_code: selectedService.code,
        form_data: formValues,
      }),
    });
    if (!draftResponse.ok) {
      setStatus('Draft creation failed.');
      return;
    }

    const draft = (await draftResponse.json()) as ApplicationDetail;
    setStatus('Uploading and scanning documents before submission...');
    const documentsReady = await createDocumentIntents(draft, selectedSchema);
    if (!documentsReady) {
      setStatus('Document upload failed. Submit after all required documents are ready.');
      return;
    }

    const submitResponse = await fetch(`${apiBaseUrl}/applications/${draft.id}/submit`, {
      method: 'POST',
      headers: authHeaders(token, false, workspaceLoadScope()),
    });
    if (!submitResponse.ok) {
      setStatus('Application submission failed after document upload.');
      return;
    }

    const application = (await submitResponse.json()) as ApplicationDetail;
    const docket = application.docket_no;
    const tenantHint = application.tenant_code ?? selectedTenant?.code;

    setSelectedService(null);
    setHoldingLookup(null);
    setFormValues({});
    setActiveTab('applications');
    setStatus(`Submitted ${docket}`);

    try {
      await loadApplications();
    } catch {
      /* Sidebar list auxiliary — tab already switched. */
    }
    try {
      await loadPayments();
    } catch {
      /* Same — workspace payments list auxiliary. */
    }

    await openApplication(docket, tenantHint ?? undefined);
  }

  async function createDocumentIntents(
    application: ApplicationDetail,
    schema: EnagarFormSchema,
  ): Promise<boolean> {
    if (!token) {
      return false;
    }

    const fileFields = schema.fields.filter((field) => field.type === 'file');
    for (const field of fileFields) {
      const value = formValues[field.id] as FileSubmission | undefined;
      if (!value?.name) {
        continue;
      }
      const intentResponse = await fetch(`${apiBaseUrl}/documents/upload-intent`, {
        method: 'POST',
        headers: authHeaders(token, true, workspaceLoadScope()),
        body: JSON.stringify({
          application_id: application.id,
          document_code: field.id,
          original_name: value.name,
          mime_type: value.mime_type,
          size_mb: value.size_mb,
        }),
      });
      if (!intentResponse.ok) {
        return false;
      }
      const intent = (await intentResponse.json()) as UploadIntentResponse;
      const scanResponse = await fetch(`${apiBaseUrl}/documents/${intent.id}/scan-result`, {
        method: 'POST',
        headers: authHeaders(token, true, workspaceLoadScope()),
        body: JSON.stringify({
          scan_status: 'clean',
          scan_provider: 'pwa-simulated-clamav',
          scan_signature: `simulated:${intent.object_key}`,
        }),
      });
      if (!scanResponse.ok) {
        return false;
      }
    }
    return true;
  }

  async function openApplication(docketNo: string, tenantScopeHint?: string | null): Promise<void> {
    if (!token) {
      return;
    }
    const scope = tenantScopeHint?.trim()
      ? tenantScopeHint.trim()
      : (workspaceLoadScope() ?? undefined);
    const response = await fetch(`${apiBaseUrl}/applications/${encodeURIComponent(docketNo)}`, {
      headers: authHeaders(token, false, scope),
    });
    if (!response.ok) {
      setStatus('Unable to open application.');
      return;
    }
    setApplicationDetail((await response.json()) as ApplicationDetail);
  }

  async function addComment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !applicationDetail || !comment.trim()) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/applications/${applicationDetail.id}/comment`, {
      method: 'POST',
      headers: authHeaders(token, true, dossierMunicipalityScope()),
      body: JSON.stringify({ body: comment }),
    });
    if (response.ok) {
      setApplicationDetail((await response.json()) as ApplicationDetail);
      setComment('');
      await loadApplications();
      setStatus('Comment added.');
    }
  }

  async function cancelCurrentApplication(): Promise<void> {
    if (!token || !applicationDetail) {
      return;
    }

    const response = await fetch(`${apiBaseUrl}/applications/${applicationDetail.id}/cancel`, {
      method: 'POST',
      headers: authHeaders(token, true, dossierMunicipalityScope()),
      body: JSON.stringify({ reason: 'Cancelled by citizen from PWA.' }),
    });
    if (response.ok) {
      setApplicationDetail((await response.json()) as ApplicationDetail);
      await loadApplications();
      await loadPayments();
      if (step === 'hub') {
        await reloadHubPortfolioLists('both');
      }
      setStatus('Application cancelled.');
    }
  }

  async function initiateApplicationPayment(
    applicationId: string,
    amountPaise: number,
    method: PaymentGatewayMethod,
  ): Promise<PaymentApiResponse | null> {
    if (!token) {
      return null;
    }
    setStatus('Initiating payment with bank partner (stub sandbox)...');
    const idempotencyKey =
      globalThis.crypto?.randomUUID?.() ??
      `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/payments/initiate`, {
        method: 'POST',
        headers: {
          ...authHeaders(token, true, dossierMunicipalityScope()),
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          application_id: applicationId,
          amount_paise: amountPaise,
          method,
        }),
      });
    } catch {
      setStatus('Network error — check API reachability, then retry payment.');
      return null;
    }

    if (!response.ok) {
      setStatus(await readApiError(response));
      return null;
    }

    const payment = (await response.json()) as PaymentApiResponse;
    if (step === 'hub') {
      await reloadHubPortfolioLists('payments');
    } else {
      await loadPayments();
    }
    if (applicationDetail?.id === applicationId) {
      await openApplication(
        applicationDetail.docket_no,
        step === 'hub' ? applicationDetail.tenant_code : undefined,
      );
    }
    setStatus(`Payment ${payment.id.slice(0, 8)}… awaiting stub capture.`);
    return payment;
  }

  async function simulateStubSettlement(payment: PaymentApiResponse): Promise<boolean> {
    if (!token) {
      return false;
    }
    setStatus('Confirming payment with stub gateway...');
    const municipalityForStubComplete =
      dossierMunicipalityScope() ?? tenantsById.get(payment.tenant_id)?.code;
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/payments/stub/complete`, {
        method: 'POST',
        headers: authHeaders(token, true, municipalityForStubComplete),
        body: JSON.stringify({
          payment_id: payment.id,
          gateway_order_id: payment.gateway_order_id,
        }),
      });
    } catch {
      setStatus('Network error during payment confirmation — retry when online.');
      return false;
    }

    if (!response.ok) {
      const message = await readApiError(response);
      setStatus(
        message.includes('disabled in production')
          ? `${message} Set ALLOW_STUB_PAYMENT_SETTLEMENT=true on the API for demo environments.`
          : message,
      );
      return false;
    }

    if (step === 'hub') {
      try {
        const [appsResponseHub, paymentsResponseHub] = await Promise.all([
          fetch(`${apiBaseUrl}/applications`, {
            headers: authHeaders(token, false),
          }),
          fetch(`${apiBaseUrl}/payments`, {
            headers: authHeaders(token, false),
          }),
        ]);

        if (appsResponseHub.ok) {
          const refreshedApps = (await appsResponseHub.json()) as ApplicationSummary[];
          setHubApplications(refreshedApps);
          const refreshedMatch = refreshedApps.find((row) => row.id === payment.application_id);
          if (refreshedMatch?.tenant_code) {
            await openApplication(refreshedMatch.docket_no, refreshedMatch.tenant_code);
          }
        }
        if (paymentsResponseHub.ok) {
          setHubPayments((await paymentsResponseHub.json()) as PaymentApiResponse[]);
        }
      } catch {
        /* silent — status banner unchanged */
      }
    } else {
      const appsResponse = await fetch(`${apiBaseUrl}/applications`, {
        headers: authHeaders(token, false, workspaceLoadScope()),
      });
      if (appsResponse.ok) {
        const list = (await appsResponse.json()) as ApplicationSummary[];
        setApplications(list);
        const match = list.find((row) => row.id === payment.application_id);
        if (match) {
          await openApplication(match.docket_no, match.tenant_code);
        }
      } else {
        await loadApplications();
      }
      await loadPayments();
    }
    setStatus('Payment settled. Open My Payments for receipt metadata (PDF later).');
    return true;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          {t('app.badge', language)}
        </span>
        <span className="text-sm text-slate-500">{status}</span>
      </header>

      {step === 'splash' && (
        <section className="grid flex-1 items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight text-slate-950 md:text-6xl">
              {t('splash.title', language)}
            </h1>
            <p className="max-w-xl text-lg text-slate-600">{t('splash.subtitle', language)}</p>
            <button
              className="rounded-2xl bg-brand px-5 py-3 font-semibold text-white"
              onClick={() => setStep('language')}
            >
              {t('action.continue', language)}
            </button>
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
            <div className="rounded-[1.5rem] bg-brand/10 p-6 text-brand">
              <p className="text-sm font-semibold uppercase">Citizen Services Preview</p>
              <p className="mt-16 text-2xl font-bold">
                Services, applications, documents, and timelines in one place.
              </p>
            </div>
          </div>
        </section>
      )}

      {step === 'language' && (
        <section className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">{t('language.title', language)}</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {(['en', 'bn', 'hi'] as const).map((code) => (
              <button
                className={`rounded-2xl border p-4 text-left ${language === code ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200'}`}
                key={code}
                onClick={() => setLanguage(code)}
              >
                <span className="block font-semibold">{code.toUpperCase()}</span>
                <span className="text-sm text-slate-500">{t('splash.title', code)}</span>
              </button>
            ))}
          </div>
          <button
            className="mt-6 rounded-2xl bg-brand px-5 py-3 font-semibold text-white"
            onClick={() => setStep('login')}
          >
            {t('language.continue', language)}
          </button>
        </section>
      )}

      {step === 'login' && (
        <form
          className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-sm"
          onSubmit={requestOtp}
        >
          <h2 className="text-2xl font-bold">{t('login.title', language)}</h2>
          <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="mobile">
            {t('login.mobile', language)}
          </label>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            id="mobile"
            inputMode="numeric"
            maxLength={10}
            onChange={(event) => setMobile(event.target.value)}
            placeholder="9876543210"
            value={mobile}
          />
          <button
            className="mt-6 w-full rounded-2xl bg-brand px-5 py-3 font-semibold text-white"
            type="submit"
          >
            {t('login.sendOtp', language)}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form
          className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-sm"
          onSubmit={verifyOtp}
        >
          <h2 className="text-2xl font-bold">{t('otp.title', language)}</h2>
          <input
            className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3"
            inputMode="numeric"
            maxLength={8}
            onChange={(event) => setOtp(event.target.value)}
            placeholder="Enter OTP"
            value={otp}
          />
          <button
            className="mt-6 w-full rounded-2xl bg-brand px-5 py-3 font-semibold text-white"
            type="submit"
          >
            {t('otp.submit', language)}
          </button>
        </form>
      )}

      {step === 'pins' && (
        <section className="mx-auto w-full max-w-4xl space-y-6 rounded-3xl bg-white p-8 shadow-sm">
          <header>
            <p className="text-sm font-semibold uppercase text-brand">First-time hub access</p>
            <h2 className="text-3xl font-bold">Pin your municipalities</h2>
            <p className="mt-2 text-sm text-slate-600">
              Pick at least one operational ULB (up to fifteen). Pins are shortcuts only—you can
              browse or search every municipality later. Manage pins anytime under hub{' '}
              <strong>Shortcuts</strong>.
            </p>
          </header>
          <label className="block text-sm font-medium text-slate-700">
            Search by code, name, or district
            <input
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
              onChange={(event) => setPinsSearch(event.target.value)}
              placeholder="Try KMC or Kolkata..."
              type="search"
              value={pinsSearch}
            />
          </label>
          <p className="text-sm text-slate-600">
            Selected{' '}
            <strong>
              ({pinsDraftCodes.length} / 15)
              {pinsDraftCodes.length ? `: ${pinsDraftCodes.join(', ')}` : ''}
            </strong>
          </p>
          <ul className="max-h-[min(60vh,480px)] space-y-2 overflow-y-auto pr-2">
            {pinsCatalogueFiltered.map((tenant) => {
              const active = pinsDraftCodes.includes(tenant.code);
              const disabledPick = !active && pinsDraftCodes.length >= 15;
              return (
                <li key={tenant.code}>
                  <button
                    className={`flex w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-slate-200 hover:border-brand/40'
                    } ${disabledPick ? 'cursor-not-allowed opacity-60' : ''}`}
                    disabled={disabledPick}
                    onClick={() => {
                      if (active) {
                        setPinsDraftCodes((codes) => codes.filter((code) => code !== tenant.code));
                      } else if (pinsDraftCodes.length < 15) {
                        setPinsDraftCodes((codes) => [...codes, tenant.code]);
                      }
                    }}
                    type="button"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span>
                        <span className="block font-semibold">{tenant.code}</span>
                        <span className="mt-1 block text-xs text-slate-600">{tenant.name}</span>
                        <span className="mt-0.5 block text-[11px] uppercase text-slate-400">
                          {tenant.district}
                        </span>
                      </span>
                      <span className="text-xs font-semibold">{active ? '✓ Pinned' : 'Pin'}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            <button
              className="rounded-2xl bg-brand px-5 py-3 font-semibold text-white disabled:opacity-40"
              disabled={pinsDraftCodes.length === 0 || !token}
              onClick={() => void persistOnboardingPins()}
              type="button"
            >
              Continue to hub
            </button>
          </div>
        </section>
      )}

      {step === 'hub' && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase text-brand">Citizen hub</p>
              <h2 className="text-3xl font-bold">Track services across municipalities</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                <strong>Pinned ULBs</strong> anchor the hub; use{' '}
                <strong>Browse all municipalities</strong> to open any operational ULB (pins stay
                independent of{' '}
                <code className="rounded bg-slate-100 px-1">POST /citizen/select-tenant</code>).
                Tabbed lists call <strong>scoped reads without</strong>{' '}
                <code className="rounded bg-slate-100 px-1">X-Enagar-Tenant-Code</code> until you
                open a dossier row.
              </p>
            </div>
            <button
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold"
              onClick={() => void refreshHubData()}
              type="button"
            >
              Refresh hub
            </button>
          </div>

          {!hubDashboard && (
            <p className="rounded-3xl bg-slate-50 p-6 text-slate-600">
              Loading municipality dashboard…
            </p>
          )}

          {hubDashboard && hubTotalsFromBuckets && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ['Language', language.toUpperCase()],
                ['Services', String(servicesKpiValue)],
                ['Applications', String(hubTotalsFromBuckets.applications)],
                ['Payments', String(hubTotalsFromBuckets.payments)],
                ['Grievances', String(hubTotalsFromBuckets.grievances)],
              ].map(([label, value]) => (
                <div
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                  key={label}
                >
                  <span className="text-sm text-slate-500">{label}</span>
                  <strong className="block text-2xl text-slate-950">{value}</strong>
                </div>
              ))}
            </div>
          )}

          <CitizenWorkspaceTabStrip
            activeTab={hubTab}
            onSelect={(tab) => {
              setHubTab(tab);
              if (tab === 'shortcuts' && citizenPreferences) {
                setShortcutPinsDraft([...citizenPreferences.pinned_tenant_codes]);
                setShortcutServicesDraft(
                  citizenPreferences.pinned_services.map((row) => ({ ...row })),
                );
                setShortcutPinsSearch('');
                setShortcutAddTenant('');
                setShortcutAddService('');
              }
              if (tab !== 'applications') {
                setApplicationDetail(null);
              }
            }}
            tabs={citizenWorkspaceHubTabs(language)}
          />

          {hubTab === 'home' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Pinned municipalities</h3>
                  <p className="text-sm text-slate-600">
                    Up to fifteen shortcuts; KPI apps/pay/griv counts below still summarise your
                    whole footprint.
                  </p>
                </div>
                <button
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold"
                  onClick={() => setMunicipalityBrowseOpen(true)}
                  type="button"
                >
                  Browse all municipalities
                </button>
              </div>

              {citizenPreferences?.pinned_services?.length ? (
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-slate-500">
                    Pinned service shortcuts
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {citizenPreferences.pinned_services.map((preference) => {
                      const catalogueTenant = tenants.find(
                        (row) => row.code === preference.tenant_code,
                      );
                      const svcList = hubTenantServiceMap[preference.tenant_code] ?? [];
                      const summary = svcList.find((svc) => svc.code === preference.service_code);
                      const title = summary?.name[language] ?? preference.service_code;
                      return (
                        <button
                          className="rounded-full border border-brand/40 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand"
                          key={`${preference.tenant_code}-${preference.service_code}`}
                          onClick={() => {
                            if (!catalogueTenant) {
                              setStatus(
                                'Unknown ULB in shortcut — refresh hub or re-save Shortcuts.',
                              );
                              return;
                            }
                            void chooseTenant(catalogueTenant, {
                              workspaceServiceCodes: [preference.service_code],
                            });
                          }}
                          type="button"
                        >
                          {preference.tenant_code} · {title}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {pinnedHubHomeRows.map(({ bucket, catalogue, shortName }) => (
                  <button
                    className={`rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      !catalogue ? 'cursor-not-allowed opacity-60' : ''
                    }`}
                    disabled={!catalogue}
                    key={bucket.tenant_id}
                    onClick={() => {
                      if (catalogue) {
                        void chooseTenant(catalogue);
                      }
                    }}
                    type="button"
                  >
                    <span
                      className="block h-2 w-full rounded-full"
                      style={{ backgroundColor: bucket.theme_color }}
                    />
                    <span className="mt-4 block text-lg font-bold">{bucket.tenant_code}</span>
                    <span className="mt-1 block text-sm text-slate-600">{shortName}</span>
                    {catalogue ? (
                      <span className="mt-4 block text-sm font-medium text-slate-500">
                        {catalogue.ward_count} wards
                      </span>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand">
                        Apps {bucket.application_count}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-900">
                        Pay {bucket.payment_count}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900">
                        Grv {bucket.grievance_count}
                      </span>
                    </div>
                    {!catalogue && (
                      <p className="mt-3 text-xs text-red-600">
                        Tenant missing from picker catalogue.
                      </p>
                    )}
                  </button>
                ))}
              </div>
              {hubDashboard && pinnedHubHomeRows.length === 0 && (
                <p className="text-sm text-slate-600">
                  No pinned municipalities yet. Use Browse or open <strong>Shortcuts</strong> to pin
                  at least one ULB.
                </p>
              )}
            </>
          )}

          {hubTab === 'shortcuts' && (
            <section className="space-y-6 rounded-3xl bg-white p-6 shadow-sm">
              <header>
                <h3 className="text-xl font-bold text-slate-900">Shortcuts</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Pins are persisted with <strong>PATCH /citizen/preferences</strong> and stay
                  separate from <strong>selected_tenant_code</strong>. Keep at least one ULB pinned.
                </p>
              </header>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Search municipalities to toggle pins
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                    onChange={(event) => setShortcutPinsSearch(event.target.value)}
                    type="search"
                    value={shortcutPinsSearch}
                  />
                </label>
                <p className="text-sm text-slate-600">
                  Pinned (<strong>{shortcutPinsDraft.length} / 15</strong>):{' '}
                  {shortcutPinsDraft.length ? shortcutPinsDraft.join(', ') : 'none'}
                </p>
                <ul className="max-h-[min(40vh,360px)] space-y-2 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  {shortcutPinCatalogueFiltered.map((tenant) => {
                    const pinned = shortcutPinsDraft.includes(tenant.code);
                    const blocked = !pinned && shortcutPinsDraft.length >= 15;
                    return (
                      <li key={tenant.code}>
                        <button
                          className={`w-full rounded-2xl border px-4 py-2 text-left text-sm ${
                            pinned
                              ? 'border-brand bg-white text-brand'
                              : 'border-slate-200 bg-white'
                          } ${blocked ? 'cursor-not-allowed opacity-60' : ''}`}
                          disabled={blocked}
                          onClick={() => {
                            if (pinned) {
                              setShortcutPinsDraft((codes) =>
                                codes.filter((code) => code !== tenant.code),
                              );
                            } else if (shortcutPinsDraft.length < 15) {
                              setShortcutPinsDraft((codes) => [...codes, tenant.code]);
                            }
                          }}
                          type="button"
                        >
                          <span className="font-semibold">{tenant.code}</span>
                          <span className="mt-1 block text-xs text-slate-600">{tenant.name}</span>
                          <span className="block text-[11px] uppercase text-slate-400">
                            {tenant.district}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-6">
                <h4 className="text-sm font-semibold text-slate-900">Pinned service shortcuts</h4>
                <p className="text-xs text-slate-600">
                  Services validated server-side against each ULB catalogue. Pick a municipality,
                  then choose a listed service.
                </p>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm font-medium text-slate-700 md:col-span-2">
                    Municipality
                    <select
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3"
                      onChange={(event) => {
                        setShortcutAddTenant(event.target.value);
                        setShortcutAddService('');
                      }}
                      value={shortcutAddTenant}
                    >
                      <option value="">Select...</option>
                      {tenants.map((tenantRow) => (
                        <option key={tenantRow.code} value={tenantRow.code}>
                          {tenantRow.code} — {tenantRow.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-slate-700 md:col-span-2">
                    Service
                    <select
                      className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-3"
                      disabled={!shortcutAddTenant}
                      onChange={(event) => setShortcutAddService(event.target.value)}
                      value={shortcutAddService}
                    >
                      <option value="">Select...</option>
                      {(hubTenantServiceMap[shortcutAddTenant] ?? []).map((svc) => (
                        <option key={svc.code} value={svc.code}>
                          {svc.code}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  className="rounded-2xl border border-brand px-4 py-2 text-sm font-semibold text-brand"
                  disabled={!shortcutAddTenant || !shortcutAddService}
                  onClick={() =>
                    void (async (): Promise<void> => {
                      if (!shortcutAddTenant || !shortcutAddService) {
                        return;
                      }
                      let catalogue = hubTenantServiceMap[shortcutAddTenant];
                      if (!catalogue?.length) {
                        try {
                          const loadedCatalogue = await fetchActiveTenantServices(
                            apiBaseUrl,
                            shortcutAddTenant,
                          );
                          setHubTenantServiceMap((prev) => ({
                            ...prev,
                            [shortcutAddTenant]: loadedCatalogue,
                          }));
                          catalogue = loadedCatalogue;
                        } catch {
                          setStatus('Unable to fetch services — check API connectivity.');
                          return;
                        }
                      }
                      const exists = catalogue.some((svc) => svc.code === shortcutAddService);
                      if (!exists) {
                        setStatus('Service not available on that municipality.');
                        return;
                      }

                      const key = `${shortcutAddTenant}:${shortcutAddService}`.toLowerCase();
                      setShortcutServicesDraft((rows) => {
                        const seen = new Set(
                          rows.map((row) => `${row.tenant_code}:${row.service_code}`.toLowerCase()),
                        );
                        if (seen.has(key)) {
                          return rows;
                        }

                        seen.add(key);
                        return [
                          ...rows,
                          { tenant_code: shortcutAddTenant, service_code: shortcutAddService },
                        ];
                      });
                      setShortcutAddService('');
                      setShortcutAddTenant('');
                      setStatus('Added shortcut locally — Save shortcuts to persist.');
                    })()
                  }
                  type="button"
                >
                  Add pinned service
                </button>

                <ul className="space-y-2 text-sm text-slate-700">
                  {shortcutServicesDraft.length === 0 && (
                    <li className="text-slate-500">No service shortcuts pinned.</li>
                  )}
                  {shortcutServicesDraft.map((row) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2"
                      key={`${row.tenant_code}-${row.service_code}`}
                    >
                      <span className="font-mono text-xs">
                        {row.tenant_code} · {row.service_code}
                      </span>
                      <button
                        className="text-xs font-semibold text-red-600"
                        onClick={() =>
                          setShortcutServicesDraft((rows) =>
                            rows.filter(
                              (candidate) =>
                                `${candidate.tenant_code}:${candidate.service_code}` !==
                                `${row.tenant_code}:${row.service_code}`,
                            ),
                          )
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-3 pt-4">
                <button
                  className="rounded-2xl bg-brand px-5 py-3 font-semibold text-white disabled:opacity-50"
                  disabled={!shortcutPinsDraft.length || !token}
                  onClick={() =>
                    void (async (): Promise<void> => {
                      if (await persistShortcutPinsAndServices()) {
                        await refreshHubData();
                      }
                    })()
                  }
                  type="button"
                >
                  Save shortcuts
                </button>
              </div>
            </section>
          )}

          {hubTab === 'services' && (
            <section className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Services load lazily for your <strong>pinned</strong> ULBs. Open any other
                  municipality via Browse — the <strong>Services</strong> KPI above remains the
                  catalogue-wide union from{' '}
                  <code className="rounded bg-white px-1">/citizen/dashboard</code>.
                </p>
                <button
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold"
                  onClick={() => setMunicipalityBrowseOpen(true)}
                  type="button"
                >
                  Browse municipalities
                </button>
              </div>
              {(citizenPreferences?.pinned_tenant_codes ?? []).map((tenantCode) => {
                const resolved = tenants.find((row) => row.code === tenantCode);
                const catalogue = hubTenantServiceMap[tenantCode] ?? [];

                if (!resolved) {
                  return (
                    <p className="text-sm text-red-600" key={tenantCode}>
                      Unknown municipality {tenantCode} in pinned list — update Shortcuts.
                    </p>
                  );
                }

                return (
                  <div key={tenantCode}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: resolved.theme_color }}
                      />
                      <h3 className="text-lg font-bold text-slate-900">{tenantCode}</h3>
                      <span className="text-sm text-slate-500">{resolved.name}</span>
                    </div>
                    {catalogue.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
                        Fetching catalogue… Refresh hub after saving pins.
                      </p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {catalogue.map((serviceRow) => (
                          <article
                            className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                            key={`${tenantCode}-${serviceRow.code}`}
                          >
                            <p className="text-[11px] font-semibold uppercase text-brand">
                              {serviceRow.category_code}
                            </p>
                            <h4 className="mt-1 text-lg font-semibold">
                              {serviceRow.name[language] ?? serviceRow.name.en}
                            </h4>
                            <button
                              className="mt-4 w-full rounded-2xl border border-brand px-3 py-2 text-sm font-semibold text-brand"
                              onClick={() =>
                                void chooseTenant(resolved, {
                                  workspaceServiceCodes: [serviceRow.code],
                                })
                              }
                              type="button"
                            >
                              Open filtered Services in {tenantCode}
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {(citizenPreferences?.pinned_tenant_codes.length ?? 0) === 0 && (
                <p className="text-sm text-slate-600">
                  Pin at least one municipality to preview Services here.
                </p>
              )}
            </section>
          )}

          {hubTab === 'apply' && (
            <section className="space-y-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-6">
              <h3 className="text-xl font-bold text-slate-900">Pick a municipality to apply</h3>
              <p className="text-sm text-slate-600">
                Applying runs inside one ULB at a time. Search every municipality via{' '}
                <strong>Browse all municipalities</strong> or tap a card below. After selection the
                workspace carries your{' '}
                <code className="rounded bg-white px-1">X-Enagar-Tenant-Code</code>.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => setMunicipalityBrowseOpen(true)}
                  type="button"
                >
                  Browse municipalities
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {cataloguedDashboardRows.map(({ bucket, catalogue, shortName }) => (
                  <button
                    className={`rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      !catalogue ? 'cursor-not-allowed opacity-60' : ''
                    }`}
                    disabled={!catalogue}
                    key={`apply-${bucket.tenant_id}`}
                    onClick={() => {
                      if (catalogue) {
                        void chooseTenant(catalogue);
                      }
                    }}
                    type="button"
                  >
                    <span
                      className="block h-2 w-full rounded-full"
                      style={{ backgroundColor: bucket.theme_color }}
                    />
                    <span className="mt-4 block text-lg font-bold">{bucket.tenant_code}</span>
                    <span className="mt-1 block text-sm text-slate-600">{shortName}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {hubTab === 'applications' && (
            <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <h3 className="text-xl font-bold">My Applications</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Hub read — aggregated across municipalities.
                </p>
                <div className="mt-4 space-y-3">
                  {hubApplications.map((application) => {
                    const stripe =
                      hubDashboard?.municipalities.find(
                        (bucket) =>
                          bucket.tenant_code?.toUpperCase() ===
                          application.tenant_code?.toUpperCase(),
                      )?.theme_color ?? '#94a3b8';

                    return (
                      <button
                        className="w-full rounded-2xl border border-slate-200 p-4 text-left"
                        key={application.id}
                        onClick={() =>
                          void openApplication(
                            application.docket_no,
                            application.tenant_code ?? undefined,
                          )
                        }
                        type="button"
                      >
                        <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: stripe }}
                          />
                          {application.tenant_code ?? 'Unknown ULB'}
                        </span>
                        <span className="block font-semibold">{application.docket_no}</span>
                        <span className="text-sm text-slate-600">
                          {application.service_name} · {application.status_label}
                        </span>
                      </button>
                    );
                  })}
                  {hubApplications.length === 0 && (
                    <p className="text-slate-600">No applications filed yet.</p>
                  )}
                </div>
              </div>

              <ApplicationDetailPanel
                apiBaseUrl={apiBaseUrl}
                application={applicationDetail}
                comment={comment}
                feePaise={
                  applicationDetail
                    ? getFixedFeePaise(feeServicesForDetailPanel, applicationDetail.service_code)
                    : null
                }
                onCancel={() => void cancelCurrentApplication()}
                onCommentChange={setComment}
                onInitiatePayment={initiateApplicationPayment}
                onStubComplete={simulateStubSettlement}
                onSubmitComment={addComment}
                payments={hubPayments}
                tenantScopeCode={dossierMunicipalityScope()}
                token={token}
              />
            </section>
          )}

          {hubTab === 'payments' && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold">My Payments</h3>
              <p className="mt-1 text-xs text-slate-500">
                Hub read — all attempts across ULBs ({hubPayments.length} rows).
              </p>
              <div className="mt-6 space-y-4">
                {hubPayments.map((payment) => {
                  const payerScope =
                    tenantsById.get(payment.tenant_id)?.code ?? dossierMunicipalityScope();
                  return (
                    <article className="rounded-2xl border border-slate-200 p-4" key={payment.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-500">
                            {payment.status.replace('_', ' ')}
                          </p>
                          <p className="font-mono text-xs text-slate-600">{payment.id}</p>
                          {Boolean(tenantsById.get(payment.tenant_id)) && (
                            <p className="mt-2 text-[11px] font-semibold text-slate-700">
                              {tenantsById.get(payment.tenant_id)?.code} ·{' '}
                              <span
                                style={{ color: tenantsById.get(payment.tenant_id)?.theme_color }}
                              >
                                ●
                              </span>
                            </p>
                          )}
                        </div>
                        <strong className="text-lg">
                          {formatInrFromPaise(payment.amount_paise)}
                        </strong>
                      </div>
                      {payment.status === 'requires_action' && token ? (
                        <button
                          className="mt-4 w-full rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white"
                          onClick={() => void simulateStubSettlement(payment)}
                          type="button"
                        >
                          Simulate PSP capture (stub complete)
                        </button>
                      ) : null}
                      {payment.status === 'settled' && payerScope && token ? (
                        <ReceiptPreviewPlaceholder
                          apiBaseUrl={apiBaseUrl}
                          payment={payment}
                          tenantScopeCode={payerScope}
                          token={token}
                        />
                      ) : null}
                    </article>
                  );
                })}
                {hubPayments.length === 0 && (
                  <p className="text-sm text-slate-600">
                    No payment attempts logged for this citizen yet.
                  </p>
                )}
              </div>
            </section>
          )}

          {hubTab === 'grievances' && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              <p className="mb-4 text-sm text-slate-600">
                Cross-ULB list from{' '}
                <code className="rounded bg-slate-100 px-1">GET /grievances</code> without
                municipality header. To <strong>file a new grievance</strong>, choose a municipality
                first — the portal token then sends{' '}
                <code className="rounded bg-slate-100 px-1">X-Enagar-Tenant-Code</code> on create
                (same as workspace).
              </p>
              <GrievancesWorkspace
                apiBaseUrl={apiBaseUrl}
                hubMunicipalityCatalogue={tenants}
                language={language}
                mobileDigits={mobile}
                onBanner={setStatus}
                onGrievancesMutated={onHubGrievancesMutated}
                tenantScopeCode={undefined}
                token={token}
              />
            </section>
          )}

          {municipalityBrowseOpen && (
            <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/50 p-6">
              <div
                aria-modal="true"
                className="relative mt-10 w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-2xl"
                role="dialog"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-brand">Browse</p>
                    <h3 className="text-2xl font-bold text-slate-950">All municipalities</h3>
                  </div>
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold"
                    onClick={() => setMunicipalityBrowseOpen(false)}
                    type="button"
                  >
                    Close
                  </button>
                </div>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Search by code, name, district
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
                    onChange={(event) => setBrowseQuery(event.target.value)}
                    type="search"
                    value={browseQuery}
                  />
                </label>
                <ul className="mt-6 max-h-[55vh] space-y-2 overflow-y-auto">
                  {browseTenantsFiltered.map((tenant) => (
                    <li key={tenant.code}>
                      <button
                        className="w-full rounded-2xl border border-slate-100 px-4 py-3 text-left transition hover:border-brand/40"
                        onClick={() => {
                          setMunicipalityBrowseOpen(false);
                          void chooseTenant(tenant);
                        }}
                        type="button"
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span>
                            <span className="font-semibold">{tenant.code}</span>
                            <span className="block text-sm text-slate-600">{tenant.name}</span>
                            <span className="block text-[11px] uppercase text-slate-400">
                              {tenant.district}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-brand">Enter workspace</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      {step === 'workspace' && selectedTenant && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
              onClick={goBackToHub}
              type="button"
            >
              ← Back to hub
            </button>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Workspace · {selectedTenant.code}
            </span>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase text-brand">
              {t('home.label', language)}
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold">{selectedTenant.name}</h2>
                <p className="mt-1 text-slate-600">
                  Services, Apply, My Applications, and My Payments against the Sprint 3.4 stub
                  rail.
                </p>
              </div>
              <button
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold"
                onClick={() => void refreshWorkspace()}
              >
                Refresh
              </button>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                ['Wards', String(selectedTenant.ward_count)],
                ['Language', language.toUpperCase()],
                ['Services', String(workspaceServicesFiltered.length)],
                ['Applications', String(applications.length)],
                ['Payments', String(payments.length)],
                ['Grievances', String(grievanceCount)],
              ].map(([label, value]) => (
                <div className="rounded-2xl bg-slate-50 p-4" key={label}>
                  <span className="text-sm text-slate-500">{label}</span>
                  <strong className="block text-2xl">{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <CitizenWorkspaceTabStrip
            activeTab={activeTab}
            onSelect={setActiveTab}
            tabs={municipalityWorkspaceTabs(language)}
          />

          {activeTab === 'home' && (
            <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold">Next Recommended Step</h3>
                <p className="mt-2 text-slate-600">
                  Start with Birth Certificate or Property Tax to test the complete Sprint 2.5 flow.
                </p>
                <button
                  className="mt-4 rounded-2xl bg-brand px-4 py-2 font-semibold text-white"
                  onClick={() => setActiveTab('services')}
                >
                  Browse Services
                </button>
              </div>
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold">Latest Application</h3>
                {latestApplication ? (
                  <button
                    className="mt-3 w-full rounded-2xl border border-slate-200 p-4 text-left"
                    onClick={() => {
                      setActiveTab('applications');
                      void openApplication(latestApplication.docket_no);
                    }}
                  >
                    <span className="block font-semibold">{latestApplication.docket_no}</span>
                    <span className="text-sm text-slate-600">{latestApplication.status_label}</span>
                  </button>
                ) : (
                  <p className="mt-3 text-slate-600">No applications yet.</p>
                )}
              </div>
            </section>
          )}

          {activeTab === 'services' && (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workspaceServiceCodesFilter?.length ? (
                <div className="col-span-full flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4">
                  <p className="text-sm text-slate-700">
                    Showing only your pinned service shortcut
                    {workspaceServiceCodesFilter.length > 1 ? 's' : ''} (
                    {workspaceServiceCodesFilter.join(', ')}
                    ).
                  </p>
                  <button
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold"
                    onClick={() => setWorkspaceServiceCodesFilter(null)}
                    type="button"
                  >
                    Show all services
                  </button>
                </div>
              ) : null}
              {workspaceServicesFiltered.length === 0 ? (
                <p className="col-span-full rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-600">
                  No services match this filter. Clear the shortcut filter or pick another ULB.
                </p>
              ) : null}
              {workspaceServicesFiltered.map((service) => (
                <article className="rounded-3xl bg-white p-5 shadow-sm" key={service.code}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-brand">
                        {service.category_code}
                      </p>
                      <h3 className="mt-1 text-xl font-bold">
                        {service.name[language] ?? service.name.en}
                      </h3>
                    </div>
                    {service.popular && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-3 min-h-12 text-sm text-slate-600">
                    {service.description[language] ?? service.description.en}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <Info label="Fee" value={service.fee_type} />
                    <Info
                      label="SLA"
                      value={service.sla_days ? `${service.sla_days} days` : 'Instant'}
                    />
                    <Info label="Docs" value={String(service.required_documents.length)} />
                    <Info label="DigiLocker" value={service.pushes_to_digilocker ? 'Yes' : 'No'} />
                  </dl>
                  <button
                    className="mt-5 w-full rounded-2xl bg-brand px-4 py-2 font-semibold text-white"
                    onClick={() => startApplication(service)}
                  >
                    Apply
                  </button>
                </article>
              ))}
            </section>
          )}

          {activeTab === 'apply' && (
            <section className="rounded-3xl bg-white p-6 shadow-sm">
              {selectedService && selectedSchema && renderPlan ? (
                <form className="space-y-5" onSubmit={submitApplication}>
                  <div>
                    <p className="text-sm font-semibold uppercase text-brand">Apply</p>
                    <h3 className="text-2xl font-bold">{selectedSchema.title[language]}</h3>
                    <p className="mt-1 text-slate-600">{selectedService.description[language]}</p>
                  </div>

                  <DynamicFormFields
                    nodes={renderPlan.nodes}
                    values={formValues}
                    onChange={updateFormValue}
                  />

                  {selectedService.code === 'prop-tax' && (
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <button
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        onClick={() => void lookupHolding()}
                        type="button"
                      >
                        Lookup Holding
                      </button>
                      {holdingLookup && (
                        <p className="mt-3 text-sm text-slate-600">
                          {holdingLookup.found && holdingLookup.holding
                            ? `Found ${holdingLookup.holding.owner_display_name}, ward ${holdingLookup.holding.ward_number}, outstanding Rs ${holdingLookup.holding.outstanding_amount}`
                            : `No matching holding found. Audit outcome: ${holdingLookup.audit.outcome}`}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    className="rounded-2xl bg-brand px-5 py-3 font-semibold text-white"
                    type="submit"
                  >
                    Submit Application
                  </button>
                </form>
              ) : (
                <div>
                  <h3 className="text-2xl font-bold">Choose a service first</h3>
                  <button
                    className="mt-4 rounded-2xl bg-brand px-4 py-2 font-semibold text-white"
                    onClick={() => setActiveTab('services')}
                  >
                    Browse Services
                  </button>
                </div>
              )}
            </section>
          )}

          {activeTab === 'applications' && (
            <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <h3 className="text-xl font-bold">My Applications</h3>
                <div className="mt-4 space-y-3">
                  {applications.map((application) => (
                    <button
                      className="w-full rounded-2xl border border-slate-200 p-4 text-left"
                      key={application.id}
                      onClick={() =>
                        void openApplication(
                          application.docket_no,
                          application.tenant_code ?? undefined,
                        )
                      }
                      type="button"
                    >
                      <span className="block font-semibold">{application.docket_no}</span>
                      <span className="text-sm text-slate-600">
                        {application.service_name} - {application.status_label}
                      </span>
                    </button>
                  ))}
                  {applications.length === 0 && (
                    <p className="text-slate-600">No applications yet.</p>
                  )}
                </div>
              </div>

              <ApplicationDetailPanel
                apiBaseUrl={apiBaseUrl}
                application={applicationDetail}
                comment={comment}
                feePaise={
                  applicationDetail
                    ? getFixedFeePaise(feeServicesForDetailPanel, applicationDetail.service_code)
                    : null
                }
                onCancel={() => void cancelCurrentApplication()}
                onCommentChange={setComment}
                onInitiatePayment={initiateApplicationPayment}
                onStubComplete={simulateStubSettlement}
                onSubmitComment={addComment}
                payments={payments}
                tenantScopeCode={dossierMunicipalityScope()}
                token={token}
              />
            </section>
          )}

          {activeTab === 'payments' && (
            <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <h3 className="text-xl font-bold">My Payments</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Listed in API order. Stub gateway: use <strong>Simulate PSP capture</strong> after
                  initiation. Production APIs block this unless operators enable{' '}
                  <code className="rounded bg-slate-100 px-1">ALLOW_STUB_PAYMENT_SETTLEMENT</code>.
                </p>
                <div className="mt-4 space-y-4">
                  {payments.map((payment) => {
                    const payerScope =
                      tenantsById.get(payment.tenant_id)?.code ?? selectedTenant.code;

                    return (
                      <article className="rounded-2xl border border-slate-200 p-4" key={payment.id}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-500">
                              {payment.status.replace('_', ' ')}
                            </p>
                            <p className="font-mono text-sm text-slate-700">{payment.id}</p>
                          </div>
                          <strong className="text-lg">
                            {formatInrFromPaise(payment.amount_paise)}
                          </strong>
                        </div>
                        <dl className="mt-3 grid gap-1 text-xs text-slate-600 md:grid-cols-2">
                          <span>Application: {payment.application_id.slice(0, 13)}…</span>
                          <span>Gateway order: {payment.gateway_order_id}</span>
                        </dl>
                        {payment.status === 'requires_action' && token && (
                          <button
                            className="mt-4 w-full rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white"
                            onClick={() => void simulateStubSettlement(payment)}
                            type="button"
                          >
                            Simulate PSP capture (stub complete)
                          </button>
                        )}
                        {payment.status === 'failed' && (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            Payment failed upstream — retry initiation from{' '}
                            <strong>My Applications</strong> after resolving the banner message
                            shown in status.
                          </div>
                        )}
                        {payment.status === 'settled' && token ? (
                          <ReceiptPreviewPlaceholder
                            apiBaseUrl={apiBaseUrl}
                            payment={payment}
                            tenantScopeCode={payerScope}
                            token={token}
                          />
                        ) : null}
                      </article>
                    );
                  })}
                  {payments.length === 0 && (
                    <p className="text-slate-600">
                      No payment attempts logged for this citizen yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-3xl bg-brand/10 p-5">
                <h4 className="font-bold text-brand">Recoverable failures (Sprint 3.4A)</h4>
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-800">
                  <li>
                    Network loss during initiation surfaces in the status banner — retry with a
                    fresh tap; idempotency keys are regenerated per attempt.
                  </li>
                  <li>
                    <code>409</code> conflicts (active payment already reserved): finish the
                    existing attempt listed here instead of launching a duplicate.
                  </li>
                  <li>
                    Receipt PDF is not implemented; load receipt metadata for verification path and
                    QR contract (Sprint 3.2 verifier).
                  </li>
                </ul>
              </div>
            </section>
          )}

          {activeTab === 'grievances' && (
            <GrievancesWorkspace
              apiBaseUrl={apiBaseUrl}
              language={language}
              mobileDigits={mobile}
              onBanner={setStatus}
              onGrievancesMutated={() => void loadGrievanceCount()}
              tenantScopeCode={selectedTenant?.code}
              token={token}
            />
          )}
        </section>
      )}
    </main>
  );
}

function citizenWorkspaceHubTabs(
  language: PwaLocaleCode,
): readonly { id: HubTab; label: string }[] {
  return [
    { id: 'home', label: 'Home' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'services', label: 'Services' },
    { id: 'apply', label: 'Apply' },
    { id: 'applications', label: 'My Applications' },
    { id: 'payments', label: 'My Payments' },
    { id: 'grievances', label: t('grievance.nav', language) },
  ];
}

function municipalityWorkspaceTabs(
  language: PwaLocaleCode,
): readonly { id: WorkspaceTab; label: string }[] {
  return [
    { id: 'home', label: 'Home' },
    { id: 'services', label: 'Services' },
    { id: 'apply', label: 'Apply' },
    { id: 'applications', label: 'My Applications' },
    { id: 'payments', label: 'My Payments' },
    { id: 'grievances', label: t('grievance.nav', language) },
  ];
}

/** Shared pill-shaped tab chrome for Citizen hub & municipal workspace. */
function CitizenWorkspaceTabStrip<T extends string>({
  activeTab,
  onSelect,
  tabs,
}: {
  activeTab: T;
  onSelect: (tab: T) => void;
  tabs: readonly { id: T; label: string }[];
}): JSX.Element {
  return (
    <nav aria-label="Primary navigation" className="flex flex-wrap gap-2">
      {tabs.map((tabEntry) => (
        <button
          className={`rounded-2xl px-4 py-2 text-sm font-semibold ${activeTab === tabEntry.id ? 'bg-brand text-white' : 'bg-white text-slate-700'}`}
          key={tabEntry.id}
          onClick={() => onSelect(tabEntry.id)}
          type="button"
        >
          {tabEntry.label}
        </button>
      ))}
    </nav>
  );
}

function Info({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
