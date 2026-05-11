'use client';

import { createRenderPlan, validateSubmission } from '@enagar/forms';
import {
  birthCertificateSchema,
  communityHallSchema,
  propertyTaxSchema,
  rtiSchema,
  tradeLicenceSchema,
} from '@enagar/forms/fixtures';
import { t } from '@enagar/i18n';
import { applyTenantTheme } from '@enagar/tenant-theme';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  ApplicationDetailPanel,
  ReceiptPreviewPlaceholder,
} from '../components/application-detail-panel';
import { GrievancesWorkspace } from '../components/grievances-workspace';
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
  PaymentApiResponse,
  PaymentGatewayMethod,
  ServiceSummary,
  TokenResponse,
  PwaLocaleCode,
} from '../lib/workspace-types';
import type {
  EnagarFormSchema,
  FileSubmission,
  FormRenderNode,
  FormSubmission,
  FormSubmissionValue,
} from '@enagar/forms';

type LanguageCode = PwaLocaleCode;
type Step = 'splash' | 'language' | 'login' | 'otp' | 'hub' | 'workspace';
type WorkspaceTab = 'home' | 'services' | 'apply' | 'applications' | 'payments' | 'grievances';

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
const serviceSchemas = [
  birthCertificateSchema,
  tradeLicenceSchema,
  propertyTaxSchema,
  communityHallSchema,
  rtiSchema,
] as const;
const schemaByServiceCode = new Map<string, EnagarFormSchema>(
  serviceSchemas.map((schema) => [schema.service_code, schema]),
);

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
  const [applicationDetail, setApplicationDetail] = useState<ApplicationDetail | null>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState(t('status.ready', 'en'));

  const hubMunicipalityCards = useMemo(() => {
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
    setStatus(t('status.loginVerified', language));
    setStep('hub');
  }

  async function chooseTenant(tenant: TenantSummary): Promise<void> {
    setSelectedTenant(tenant);
    applyTenantTheme(tenant);

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

  function goBackToHub(): void {
    applyTenantTheme(null);
    setSelectedTenant(null);
    setActiveTab('home');
    setApplicationDetail(null);
    setSelectedService(null);
    setStatus(t('status.ready', language));
    setStep('hub');
  }

  async function refreshHubData(): Promise<void> {
    if (!token) {
      setHubDashboard(null);
      setTenants([]);
      return;
    }
    setStatus('Loading dashboard…');

    try {
      const [dashboardResponse, catalogueResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/citizen/dashboard`, { headers: authHeaders(token, false) }),
        fetch(`${apiBaseUrl}/tenants`),
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
      setHubDashboard(nextDashboard);
      setTenants(nextTenants);
      setStatus(t('status.ready', language));
    } catch {
      setStatus(t('status.apiUnreachable', language));
    }
  }

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
        headers: authHeaders(token, false, selectedTenant?.code),
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
      const response = await fetch(`${apiBaseUrl}/services/tenants/${tenantCode}`);
      if (!response.ok) {
        throw new Error('Unable to load services');
      }
      const nextServices = (await response.json()) as ServiceSummary[];
      setServices(nextServices.filter((service) => service.active));
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
        headers: authHeaders(token, false, selectedTenant?.code),
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
        headers: authHeaders(token, false, selectedTenant?.code),
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
    setFormValues(defaultValuesFor(service.code));
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
      headers: authHeaders(token, false, selectedTenant?.code),
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
      headers: authHeaders(token, true, selectedTenant?.code),
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
      headers: authHeaders(token, false, selectedTenant?.code),
    });
    if (!submitResponse.ok) {
      setStatus('Application submission failed after document upload.');
      return;
    }

    const application = (await submitResponse.json()) as ApplicationDetail;
    await loadApplications();
    await loadPayments();
    await openApplication(application.docket_no);
    setActiveTab('applications');
    setStatus(`Submitted ${application.docket_no}`);
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
        headers: authHeaders(token, true, selectedTenant?.code),
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
        headers: authHeaders(token, true, selectedTenant?.code),
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

  async function openApplication(docketNo: string): Promise<void> {
    if (!token) {
      return;
    }
    const response = await fetch(`${apiBaseUrl}/applications/${encodeURIComponent(docketNo)}`, {
      headers: authHeaders(token, false, selectedTenant?.code),
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
      headers: authHeaders(token, true, selectedTenant?.code),
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
      headers: authHeaders(token, true, selectedTenant?.code),
      body: JSON.stringify({ reason: 'Cancelled by citizen from PWA.' }),
    });
    if (response.ok) {
      setApplicationDetail((await response.json()) as ApplicationDetail);
      await loadApplications();
      await loadPayments();
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
          ...authHeaders(token, true, selectedTenant?.code),
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
    await loadPayments();
    if (applicationDetail?.id === applicationId) {
      await openApplication(applicationDetail.docket_no);
    }
    setStatus(`Payment ${payment.id.slice(0, 8)}… awaiting stub capture.`);
    return payment;
  }

  async function simulateStubSettlement(payment: PaymentApiResponse): Promise<boolean> {
    if (!token) {
      return false;
    }
    setStatus('Confirming payment with stub gateway...');
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/payments/stub/complete`, {
        method: 'POST',
        headers: authHeaders(token, true, selectedTenant?.code),
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

    const appsResponse = await fetch(`${apiBaseUrl}/applications`, {
      headers: authHeaders(token, false, selectedTenant?.code),
    });
    if (appsResponse.ok) {
      const list = (await appsResponse.json()) as ApplicationSummary[];
      setApplications(list);
      const match = list.find((row) => row.id === payment.application_id);
      if (match) {
        await openApplication(match.docket_no);
      }
    } else {
      await loadApplications();
    }
    await loadPayments();
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

      {step === 'hub' && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase text-brand">Citizen hub</p>
              <h2 className="text-3xl font-bold">Your municipalities</h2>
              <p className="mt-2 max-w-3xl text-slate-600">
                Choose a municipality to open the scoped workspace (
                <code className="rounded bg-slate-100 px-1">X-Enagar-Tenant-Code</code> applies only
                there). Counts aggregate from{' '}
                <code className="rounded bg-slate-100 px-1">GET /citizen/dashboard</code> — no
                municipality header on hub fetches (Option A parity).
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {hubMunicipalityCards.map(({ bucket, catalogue, shortName }) => (
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
                  <p className="mt-3 text-xs text-red-600">Tenant missing from picker catalogue.</p>
                )}
              </button>
            ))}
          </div>

          {hubDashboard && hubMunicipalityCards.length === 0 && (
            <p className="text-sm text-slate-600">
              Dashboard returned no municipalities. Check API seed catalogue.
            </p>
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
                ['Services', String(services.length)],
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

          <nav className="flex flex-wrap gap-2">
            {(['home', 'services', 'apply', 'applications', 'payments', 'grievances'] as const).map(
              (tab) => (
                <button
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold ${activeTab === tab ? 'bg-brand text-white' : 'bg-white text-slate-700'}`}
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'applications'
                    ? 'My Applications'
                    : tab === 'payments'
                      ? 'My Payments'
                      : tab === 'grievances'
                        ? t('grievance.nav', language)
                        : titleCase(tab)}
                </button>
              ),
            )}
          </nav>

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
              {services.map((service) => (
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

                  {renderPlan.nodes.map((node) => (
                    <RenderField
                      key={node.id}
                      node={node}
                      onChange={updateFormValue}
                      value={formValues[node.id]}
                    />
                  ))}

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
                      onClick={() => void openApplication(application.docket_no)}
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
                    ? getFixedFeePaise(services, applicationDetail.service_code)
                    : null
                }
                onCancel={() => void cancelCurrentApplication()}
                onCommentChange={setComment}
                onInitiatePayment={initiateApplicationPayment}
                onStubComplete={simulateStubSettlement}
                onSubmitComment={addComment}
                payments={payments}
                tenantScopeCode={selectedTenant?.code}
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
                  {payments.map((payment) => (
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
                          <strong>My Applications</strong> after resolving the banner message shown
                          in status.
                        </div>
                      )}
                      {payment.status === 'settled' && token ? (
                        <ReceiptPreviewPlaceholder
                          apiBaseUrl={apiBaseUrl}
                          payment={payment}
                          tenantScopeCode={selectedTenant.code}
                          token={token}
                        />
                      ) : null}
                    </article>
                  ))}
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

function defaultValuesFor(serviceCode: string): FormSubmission {
  if (serviceCode === 'birth-cert') {
    return {
      applicant_name: 'Citizen Test',
      mobile: '9876543210',
      child_name: 'Child Test',
      date_of_birth: '2026-01-01',
      relationship: 'parent',
      hospital_discharge: {
        name: 'birth-proof.pdf',
        mime_type: 'application/pdf',
        size_mb: 1,
      },
    };
  }
  if (serviceCode === 'prop-tax') {
    return {
      holding_number: 'KMC-064-PARK-12B',
      payer_type: 'owner',
    };
  }
  return {};
}

function RenderField({
  node,
  onChange,
  value,
}: {
  node: FormRenderNode;
  onChange: (fieldId: string, value: FormSubmissionValue | undefined) => void;
  value: FormSubmissionValue | undefined;
}): JSX.Element {
  if (node.widget === 'section') {
    return (
      <div className="rounded-2xl bg-brand/10 p-4 text-brand">
        <h4 className="font-bold">{node.label}</h4>
      </div>
    );
  }

  const label = node.label;
  const baseClass = 'mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3';

  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {node.required && <span className="text-red-600"> *</span>}
      {node.widget === 'choice-list' || node.widget === 'select' ? (
        <select
          className={baseClass}
          onChange={(event) => onChange(node.id, event.target.value)}
          value={String(value ?? '')}
        >
          <option value="">Select</option>
          {node.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : node.widget === 'number-input' ? (
        <input
          className={baseClass}
          onChange={(event) => onChange(node.id, Number(event.target.value))}
          type="number"
          value={typeof value === 'number' ? value : ''}
        />
      ) : node.widget === 'date-input' ? (
        <input
          className={baseClass}
          onChange={(event) => onChange(node.id, event.target.value)}
          type="date"
          value={typeof value === 'string' ? value : ''}
        />
      ) : node.widget === 'textarea' ? (
        <textarea
          className={baseClass}
          onChange={(event) => onChange(node.id, event.target.value)}
          rows={4}
          value={typeof value === 'string' ? value : ''}
        />
      ) : node.widget === 'file-picker' ? (
        <input
          className={baseClass}
          onChange={(event) =>
            onChange(node.id, {
              name: event.target.value || `${node.id}.pdf`,
              mime_type: 'application/pdf',
              size_mb: 1,
            })
          }
          placeholder="document.pdf"
          value={isFileSubmission(value) ? value.name : ''}
        />
      ) : (
        <input
          className={baseClass}
          onChange={(event) => onChange(node.id, event.target.value)}
          value={typeof value === 'string' ? value : ''}
        />
      )}
    </label>
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

function isFileSubmission(value: FormSubmissionValue | undefined): value is FileSubmission {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'name' in value);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
