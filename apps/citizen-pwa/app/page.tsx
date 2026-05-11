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

import type {
  EnagarFormSchema,
  FileSubmission,
  FormRenderNode,
  FormSubmission,
  FormSubmissionValue,
} from '@enagar/forms';

type LanguageCode = 'en' | 'bn' | 'hi';
type Step = 'splash' | 'language' | 'login' | 'otp' | 'tenant' | 'workspace';
type WorkspaceTab = 'home' | 'services' | 'apply' | 'applications' | 'payments';

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

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface ServiceSummary {
  tenant_code: string;
  code: string;
  category_code: string;
  revenue_head_code: string | null;
  name: Record<LanguageCode, string>;
  description: Record<LanguageCode, string>;
  workflow_pattern: string;
  active: boolean;
  fee_type: string;
  fee_config: Record<string, unknown>;
  sla_days: number | null;
  required_documents: string[];
  pushes_to_digilocker: boolean;
  source: string;
  popular: boolean;
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

interface ApplicationSummary {
  id: string;
  docket_no: string;
  service_code: string;
  service_name: string;
  current_stage: string;
  status: string;
  status_label: string;
  pending_role: string | null;
  payment_status: string;
  submitted_at: string;
}

interface ApplicationDetail extends ApplicationSummary {
  form_data: FormSubmission;
  timeline: Array<{
    id: string;
    verb: string;
    to_stage: string;
    actor_role: string;
    comment: string | null;
    created_at: string;
  }>;
  comments: Array<{
    id: string;
    body: string;
    actor_role: string;
    created_at: string;
  }>;
  documents: Array<{
    id: string;
    document_code: string;
    original_name: string;
    mime_type: string;
    size_mb: number;
    scan_status: string;
    object_key: string;
  }>;
}

interface UploadIntentResponse {
  id: string;
  object_key: string;
  scan_status: string;
}

type PaymentGatewayMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

interface PaymentApiResponse {
  id: string;
  tenant_id: string;
  application_id: string;
  amount_paise: number;
  currency: 'INR';
  method: PaymentGatewayMethod;
  status: 'requires_action' | 'settled' | 'failed';
  gateway: 'stub';
  gateway_order_id: string;
  gateway_payment_id?: string | null;
  settled_at?: string | null;
  redirect_url: string;
  created_at: string;
  updated_at: string;
}

interface ReceiptCitizenPayload {
  id: string;
  receipt_number: string;
  payment_id: string;
  application_id: string;
  service_code: string;
  revenue_head_code: string;
  amount_paise: number;
  currency: 'INR';
  issued_at: string;
  verification_path: string;
  qr_contract: {
    format: 'enagar_receipt_verify_v1';
    version: number;
    verification_path: string;
  };
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
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceSummary | null>(null);
  const [formValues, setFormValues] = useState<FormSubmission>({});
  const [holdingLookup, setHoldingLookup] = useState<HoldingLookupResponse | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [payments, setPayments] = useState<PaymentApiResponse[]>([]);
  const [applicationDetail, setApplicationDetail] = useState<ApplicationDetail | null>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState(t('status.ready', 'en'));

  const tenantCards = useMemo(
    () =>
      tenants.map((tenant) => ({ ...tenant, shortName: tenant.name.replace(' Municipal', '') })),
    [tenants],
  );

  const selectedSchema = selectedService
    ? schemaByServiceCode.get(selectedService.code)
    : undefined;
  const renderPlan = selectedSchema
    ? createRenderPlan(selectedSchema, { locale: language, platform: 'web' })
    : null;
  const latestApplication = applications[0];

  useEffect(() => {
    if (step !== 'tenant') {
      return;
    }

    void fetch(`${apiBaseUrl}/tenants`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load tenants');
        }
        return response.json() as Promise<TenantSummary[]>;
      })
      .then(setTenants)
      .catch((error: Error) => setStatus(error.message));
  }, [step]);

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
        body: JSON.stringify({ tenant_code: 'KMC', mobile }),
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
        body: JSON.stringify({ tenant_code: 'KMC', mobile, otp }),
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
    setStep('tenant');
  }

  async function chooseTenant(tenant: TenantSummary): Promise<void> {
    setSelectedTenant(tenant);
    applyTenantTheme(tenant);

    if (token?.access_token) {
      try {
        await fetch(`${apiBaseUrl}/citizen/select-tenant`, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({ tenant_code: tenant.code }),
        });
      } catch {
        setStatus(t('status.tenantSelectedLocal', language));
      }
    }

    setStatus(`${tenant.code} selected`);
    setStep('workspace');
  }

  async function refreshWorkspace(): Promise<void> {
    if (!selectedTenant) {
      return;
    }

    await Promise.all([loadServices(selectedTenant.code), loadApplications(), loadPayments()]);
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
        headers: authHeaders(token, false),
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
        headers: authHeaders(token, false),
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
      headers: authHeaders(token, false),
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
      headers: authHeaders(token),
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
      headers: authHeaders(token, false),
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
        headers: authHeaders(token),
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
        headers: authHeaders(token),
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
      headers: authHeaders(token, false),
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
      headers: authHeaders(token),
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
      headers: authHeaders(token),
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
          ...authHeaders(token),
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
        headers: authHeaders(token),
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
      headers: authHeaders(token, false),
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

      {step === 'tenant' && (
        <section>
          <h2 className="text-3xl font-bold">{t('tenant.title', language)}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {tenantCards.map((tenant) => (
              <button
                className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                key={tenant.id}
                onClick={() => void chooseTenant(tenant)}
              >
                <span
                  className="block h-2 w-16 rounded-full"
                  style={{ backgroundColor: tenant.theme_color }}
                />
                <span className="mt-4 block text-lg font-bold">{tenant.code}</span>
                <span className="mt-1 block text-sm text-slate-600">{tenant.shortName}</span>
                <span className="mt-4 block text-sm font-medium text-slate-500">
                  {tenant.ward_count} wards
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'workspace' && selectedTenant && (
        <section className="space-y-6">
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
            <div className="mt-6 grid gap-3 md:grid-cols-5">
              {[
                ['Wards', String(selectedTenant.ward_count)],
                ['Language', language.toUpperCase()],
                ['Services', String(services.length)],
                ['Applications', String(applications.length)],
                ['Payments', String(payments.length)],
              ].map(([label, value]) => (
                <div className="rounded-2xl bg-slate-50 p-4" key={label}>
                  <span className="text-sm text-slate-500">{label}</span>
                  <strong className="block text-2xl">{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {(['home', 'services', 'apply', 'applications', 'payments'] as const).map((tab) => (
              <button
                className={`rounded-2xl px-4 py-2 text-sm font-semibold ${activeTab === tab ? 'bg-brand text-white' : 'bg-white text-slate-700'}`}
                key={tab}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'applications'
                  ? 'My Applications'
                  : tab === 'payments'
                    ? 'My Payments'
                    : titleCase(tab)}
              </button>
            ))}
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
        </section>
      )}
    </main>
  );
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
    /* response body may not be JSON */
  }
  return `Request failed (${response.status})`;
}

function getFixedFeePaise(serviceList: ServiceSummary[], code: string): number | null {
  const svc = serviceList.find((entry) => entry.code === code);
  if (!svc || svc.fee_type !== 'fixed') {
    return null;
  }
  const raw = (svc.fee_config as { amount_paise?: unknown }).amount_paise;
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null;
}

function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);
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

function ReceiptPreviewPlaceholder({
  apiBaseUrl,
  payment,
  token,
}: {
  apiBaseUrl: string;
  payment: PaymentApiResponse;
  token: TokenResponse;
}): JSX.Element {
  const [payload, setPayload] = useState<ReceiptCitizenPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadReceipt(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/payments/${encodeURIComponent(payment.id)}/receipt`, {
        headers: authHeaders(token, false),
      });
      if (!res.ok) {
        setError(await readApiError(res));
        setLoading(false);
        return;
      }
      setPayload((await res.json()) as ReceiptCitizenPayload);
    } catch {
      setError('Network error loading receipt metadata.');
    }
    setLoading(false);
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <h5 className="font-bold text-emerald-900">Receipt (metadata)</h5>
      <p className="mt-1 text-xs text-emerald-800">
        PDF is not implemented yet. Preview shows verification_path and qr_contract from Sprint 3.2.
      </p>
      {!payload && (
        <button
          className="mt-3 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={loading}
          onClick={() => void loadReceipt()}
          type="button"
        >
          {loading ? 'Loading…' : 'Load receipt metadata'}
        </button>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {payload && (
        <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-white p-3 font-mono text-[11px] leading-relaxed">
          {JSON.stringify(
            {
              receipt_number: payload.receipt_number,
              verification_path: payload.verification_path,
              qr_contract: payload.qr_contract,
              issued_at: payload.issued_at,
              amount_paise: payload.amount_paise,
            },
            null,
            2,
          )}
        </pre>
      )}
    </div>
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

function ApplicationDetailPanel({
  apiBaseUrl,
  application,
  comment,
  feePaise,
  onCancel,
  onCommentChange,
  onInitiatePayment,
  onStubComplete,
  onSubmitComment,
  payments,
  token,
}: {
  apiBaseUrl: string;
  application: ApplicationDetail | null;
  comment: string;
  feePaise: number | null;
  onCancel: () => void;
  onCommentChange: (value: string) => void;
  onInitiatePayment: (
    applicationId: string,
    amountPaise: number,
    method: PaymentGatewayMethod,
  ) => Promise<PaymentApiResponse | null>;
  onStubComplete: (payment: PaymentApiResponse) => Promise<boolean>;
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => void;
  payments: PaymentApiResponse[];
  token: TokenResponse | null;
}): JSX.Element {
  const [paymentMethod, setPaymentMethod] = useState<PaymentGatewayMethod>('upi');

  const appPayments = useMemo(() => {
    if (!application) {
      return [];
    }
    return payments
      .filter((row) => row.application_id === application.id)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [application, payments]);

  if (!application) {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="text-xl font-bold">Application Detail</h3>
        <p className="mt-3 text-slate-600">Select an application to see timeline and documents.</p>
      </div>
    );
  }

  const pendingStub = appPayments.find((row) => row.status === 'requires_action');
  const latestSettled = appPayments.find((row) => row.status === 'settled');
  const canStartNewPayment =
    Boolean(token) &&
    feePaise != null &&
    (application.payment_status === 'pending' || application.payment_status === 'failed') &&
    !pendingStub;

  return (
    <div className="space-y-4 rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-brand">{application.docket_no}</p>
          <h3 className="text-2xl font-bold">{application.service_name}</h3>
          <p className="text-slate-600">{application.status_label}</p>
        </div>
        <button
          className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>

      <InfoGrid
        items={[
          ['Stage', application.current_stage],
          ['Payment', application.payment_status],
          ['Pending Role', application.pending_role ?? 'None'],
          ['Submitted', new Date(application.submitted_at).toLocaleString()],
        ]}
      />

      <section className="rounded-2xl border border-slate-200 p-4">
        <h4 className="font-bold">Fees &amp; payment (stub)</h4>
        {feePaise != null ? (
          <p className="mt-2 text-sm text-slate-700">
            Fixed fee: <strong>{formatInrFromPaise(feePaise)}</strong>
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            This service has no fixed-fee line item in the catalogue (or fee is not fixed).
          </p>
        )}
        {application.payment_status === 'not_required' && (
          <p className="mt-2 text-sm text-slate-600">
            No payment is required for this application.
          </p>
        )}
        {application.payment_status === 'paid' && (
          <p className="mt-2 text-sm text-emerald-800">Payment is recorded as paid.</p>
        )}
        {appPayments.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {appPayments.slice(0, 6).map((row) => (
              <li key={row.id}>
                {row.status.replace('_', ' ')} · {formatInrFromPaise(row.amount_paise)} ·{' '}
                <span className="font-mono">{row.gateway_order_id}</span>
              </li>
            ))}
          </ul>
        )}
        {pendingStub && token && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
            <p>
              Stub partner reserved order <strong>{pendingStub.gateway_order_id}</strong>. Simulate
              capture to settle and issue receipt metadata.
            </p>
            <button
              className="mt-2 w-full rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void onStubComplete(pendingStub)}
              type="button"
            >
              Simulate PSP capture
            </button>
          </div>
        )}
        {canStartNewPayment && feePaise != null && (
          <div className="mt-3 space-y-2">
            {application.payment_status === 'failed' && (
              <p className="text-sm text-amber-800">
                Last attempt failed. Start a fresh payment after reading the status banner;
                idempotency keys rotate each tap.
              </p>
            )}
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Method
              <select
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setPaymentMethod(event.target.value as PaymentGatewayMethod)}
                value={paymentMethod}
              >
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="netbanking">Net banking</option>
                <option value="wallet">Wallet</option>
              </select>
            </label>
            <button
              className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void onInitiatePayment(application.id, feePaise, paymentMethod)}
              type="button"
            >
              Initiate stub payment
            </button>
          </div>
        )}
        {!token &&
          (application.payment_status === 'pending' || application.payment_status === 'failed') && (
            <p className="mt-2 text-sm text-red-700">Sign in is required to initiate payment.</p>
          )}
        {latestSettled && token && !pendingStub && (
          <ReceiptPreviewPlaceholder
            apiBaseUrl={apiBaseUrl}
            payment={latestSettled}
            token={token}
          />
        )}
      </section>

      <section>
        <h4 className="font-bold">Timeline</h4>
        <div className="mt-2 space-y-2">
          {application.timeline.map((item) => (
            <div className="rounded-2xl bg-slate-50 p-3 text-sm" key={item.id}>
              <strong>{item.verb}</strong> to {item.to_stage} by {item.actor_role}
              {item.comment && <p className="text-slate-600">{item.comment}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="font-bold">Documents</h4>
        <div className="mt-2 space-y-2">
          {application.documents.map((document) => (
            <div className="rounded-2xl bg-slate-50 p-3 text-sm" key={document.id}>
              <strong>{document.document_code}</strong> - {document.scan_status}
              <p className="break-all text-slate-600">{document.object_key}</p>
            </div>
          ))}
          {application.documents.length === 0 && (
            <p className="text-sm text-slate-600">No documents.</p>
          )}
        </div>
      </section>

      <form className="space-y-3" onSubmit={onSubmitComment}>
        <label className="block text-sm font-medium text-slate-700">
          Add Comment
          <textarea
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            onChange={(event) => onCommentChange(event.target.value)}
            rows={3}
            value={comment}
          />
        </label>
        <button className="rounded-2xl bg-brand px-4 py-2 font-semibold text-white" type="submit">
          Save Comment
        </button>
      </form>
    </div>
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

function InfoGrid({ items }: { items: Array<[string, string]> }): JSX.Element {
  return (
    <dl className="grid gap-2 md:grid-cols-2">
      {items.map(([label, value]) => (
        <Info key={label} label={label} value={value} />
      ))}
    </dl>
  );
}

function isFileSubmission(value: FormSubmissionValue | undefined): value is FileSubmission {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'name' in value);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
