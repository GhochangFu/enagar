'use client';

import { validateFormSchema, type EnagarFormSchema } from '@enagar/forms';
import { FormCitizenPreview } from '@enagar/forms/builder';
import { stripToolCallMarkupFromAssistantText } from '@enagar/types';
import {
  areDraftLayersReady,
  canSkipToReview,
  formatStepProgress,
  nextStep,
  previousStep,
  SETUP_SCOPE_STEPS,
  stepLabel,
} from '@enagar/types/setup-assistant-flow';
import { Button, PageHeader, cn } from '@enagar/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from '../../../../../components/tenant-admin-session';
import { postSetupAssistantMessage } from '../../../../../lib/setup-assistant-sse';

import type {
  ChecklistStatus,
  SetupAssistantScope,
  SetupSessionDto,
  SetupReadinessChecklist,
} from '@enagar/types';
import type { WorkflowDefinition } from '@enagar/workflow';

const SCOPE_LABELS: Record<SetupAssistantScope, string> = {
  full: 'Full setup',
  form: 'Form only',
  workflow: 'Workflow only',
  payment: 'Payment only',
  review: 'Review only',
};

import type { Route } from 'next';

const SCOPE_STEPS = SETUP_SCOPE_STEPS;

function readinessStatusLabel(status: ChecklistStatus): string {
  switch (status) {
    case 'green':
      return 'Ready';
    case 'amber':
      return 'Needs attention';
    case 'red':
      return 'Blocked';
  }
}

function readinessStatusCardClass(status: ChecklistStatus): string {
  switch (status) {
    case 'green':
      return 'border-green-200 bg-green-50';
    case 'amber':
      return 'border-amber-200 bg-amber-50';
    case 'red':
      return 'border-red-200 bg-red-50';
  }
}

function readinessStatusBadgeClass(status: ChecklistStatus): string {
  switch (status) {
    case 'green':
      return 'bg-green-100 text-green-800 ring-green-200';
    case 'amber':
      return 'bg-amber-100 text-amber-900 ring-amber-200';
    case 'red':
      return 'bg-red-100 text-red-800 ring-red-200';
  }
}

function readinessStatusDetailClass(status: ChecklistStatus): string {
  switch (status) {
    case 'green':
      return 'text-green-800';
    case 'amber':
      return 'text-amber-900';
    case 'red':
      return 'text-red-800';
  }
}

function readinessBooleanCardClass(ok: boolean): string {
  return ok
    ? 'border-green-200 bg-green-50 text-green-900'
    : 'border-red-200 bg-red-50 text-red-900';
}

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ServiceConfigPreview = {
  fee_preview_paise: number | null;
  payment_schedule: string;
  required_documents: unknown[];
  revenue_head: { code: string } | null;
  fee_rule: unknown;
};

export default function SetupAssistantClient({ serviceId }: { serviceId: string }): JSX.Element {
  const { ensureFreshAuth } = useTenantAdminSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scope, setScope] = useState<SetupAssistantScope>('full');
  const [session, setSession] = useState<SetupSessionDto | null>(null);
  const [readiness, setReadiness] = useState<SetupReadinessChecklist | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [formPreview, setFormPreview] = useState<EnagarFormSchema | null>(null);
  const [workflowPreview, setWorkflowPreview] = useState<WorkflowDefinition | null>(null);
  const [configPreview, setConfigPreview] = useState<ServiceConfigPreview | null>(null);
  const formPreviewValid = useMemo(
    () => (formPreview ? validateFormSchema(formPreview).ok : false),
    [formPreview],
  );

  const activeSteps = useMemo(() => SCOPE_STEPS[session?.scope ?? scope], [scope, session?.scope]);
  const draftLayersReady = useMemo(
    () => (readiness ? areDraftLayersReady(readiness) : false),
    [readiness],
  );
  const showIntentStep = session?.current_step === 1;
  const showFormStep = session?.current_step === 2;
  const showWorkflowStep = session?.current_step === 3;
  const showPaymentStep = session?.current_step === 4;
  const showReviewStep = session?.current_step === 5;
  const showChatStep =
    showIntentStep || showFormStep || showWorkflowStep || showPaymentStep || showReviewStep;
  const stepProgressLabel = session ? formatStepProgress(session) : null;
  const canGoBack = session ? previousStep(session.scope, session.current_step) !== null : false;
  const canGoNext = session
    ? nextStep(session.scope, session.current_step, session.step_completion) !== null
    : false;
  const canSkipReview = session
    ? canSkipToReview(session.scope, session.current_step, session.step_completion)
    : false;

  const displayStreamingText = useMemo(
    () => (streamingText ? stripToolCallMarkupFromAssistantText(streamingText) : ''),
    [streamingText],
  );

  const loadReadiness = useCallback(async (): Promise<void> => {
    const auth = await ensureFreshAuth();
    if (!auth) {
      return;
    }
    const res = await fetch(
      `${auth.apiBase}/admin/tenant/services/${serviceId}/setup-assistant/readiness`,
      {
        cache: 'no-store',
        headers: { authorization: `Bearer ${auth.token}` },
      },
    );
    if (!res.ok) {
      setStatus(`Readiness load failed (${res.status}).`);
      return;
    }
    setReadiness((await res.json()) as SetupReadinessChecklist);
  }, [ensureFreshAuth, serviceId]);

  const reloadSession = useCallback(async (): Promise<void> => {
    const auth = await ensureFreshAuth();
    if (!auth || !session) {
      return;
    }
    const res = await fetch(
      `${auth.apiBase}/admin/tenant/services/${serviceId}/setup-assistant/sessions/${session.id}`,
      {
        cache: 'no-store',
        headers: { authorization: `Bearer ${auth.token}` },
      },
    );
    if (!res.ok) {
      return;
    }
    const payload = (await res.json()) as
      | SetupSessionDto
      | { session: SetupSessionDto; checklist?: SetupReadinessChecklist };
    const nextSession = 'session' in payload ? payload.session : payload;
    setSession(nextSession);
    setScope(nextSession.scope);
    if ('session' in payload && payload.checklist) {
      setReadiness(payload.checklist);
    } else {
      await loadReadiness();
    }
  }, [ensureFreshAuth, loadReadiness, serviceId, session]);

  const loadConfigPreview = useCallback(async (): Promise<void> => {
    const auth = await ensureFreshAuth();
    if (!auth) {
      return;
    }
    const res = await fetch(`${auth.apiBase}/admin/tenant/services/${serviceId}/config`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) {
      return;
    }
    const config = (await res.json()) as ServiceConfigPreview;
    setConfigPreview(config);
  }, [ensureFreshAuth, serviceId]);

  const loadFormPreview = useCallback(async (): Promise<void> => {
    const auth = await ensureFreshAuth();
    if (!auth) {
      return;
    }
    const res = await fetch(`${auth.apiBase}/admin/tenant/services/${serviceId}/designer`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) {
      return;
    }
    const designer = (await res.json()) as {
      form_draft?: { form_schema?: EnagarFormSchema } | null;
      starter_form_schema?: EnagarFormSchema;
      workflow_draft?: { definition?: WorkflowDefinition } | null;
    };
    const schema = designer.form_draft?.form_schema ?? designer.starter_form_schema ?? null;
    setFormPreview(schema);
    setWorkflowPreview(designer.workflow_draft?.definition ?? null);
  }, [ensureFreshAuth, serviceId]);

  useEffect(() => {
    void loadReadiness();
    void loadFormPreview();
    void loadConfigPreview();
  }, [loadConfigPreview, loadFormPreview, loadReadiness]);

  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return;
    }
    const loadSession = async () => {
      const auth = await ensureFreshAuth();
      if (!auth) {
        return;
      }
      const res = await fetch(
        `${auth.apiBase}/admin/tenant/services/${serviceId}/setup-assistant/sessions/${sessionId}`,
        {
          cache: 'no-store',
          headers: { authorization: `Bearer ${auth.token}` },
        },
      );
      if (!res.ok) {
        return;
      }
      const payload = (await res.json()) as
        | SetupSessionDto
        | { session: SetupSessionDto; checklist?: SetupReadinessChecklist };
      const nextSession = 'session' in payload ? payload.session : payload;
      setSession(nextSession);
      setScope(nextSession.scope);
      if ('session' in payload && payload.checklist) {
        setReadiness(payload.checklist);
      }
    };
    void loadSession();
  }, [ensureFreshAuth, searchParams, serviceId]);

  async function createSession(nextScope: SetupAssistantScope): Promise<void> {
    const auth = await ensureFreshAuth();
    if (!auth) {
      return;
    }
    setLoading(true);
    setStatus(null);
    setMessages([]);
    try {
      const res = await fetch(
        `${auth.apiBase}/admin/tenant/services/${serviceId}/setup-assistant/sessions`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ scope: nextScope }),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        setStatus(`Session create failed (${res.status}). ${body.slice(0, 160)}`);
        return;
      }
      const created = (await res.json()) as SetupSessionDto;
      setSession(created);
      setScope(nextScope);
      router.replace(
        `/dashboard/services/${serviceId}/setup-assistant?sessionId=${created.id}` as Route,
      );
      setStatus(`Session started in ${SCOPE_LABELS[nextScope]} scope.`);
      await loadReadiness();
      await loadFormPreview();
      await loadConfigPreview();
    } finally {
      setLoading(false);
    }
  }

  async function setCurrentStep(nextStep: number): Promise<void> {
    const auth = await ensureFreshAuth();
    if (!auth || !session) {
      return;
    }
    const res = await fetch(
      `${auth.apiBase}/admin/tenant/services/${serviceId}/setup-assistant/sessions/${session.id}/step`,
      {
        method: 'PATCH',
        headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ current_step: nextStep }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      setStatus(`Step update failed (${res.status}). ${body.slice(0, 160)}`);
      return;
    }
    setSession((await res.json()) as SetupSessionDto);
  }

  async function goToStep(nextStepNumber: number): Promise<void> {
    await setCurrentStep(nextStepNumber);
    setMessages([]);
  }

  async function goBack(): Promise<void> {
    if (!session) {
      return;
    }
    const target = previousStep(session.scope, session.current_step);
    if (target) {
      await goToStep(target);
    }
  }

  async function goNext(): Promise<void> {
    if (!session) {
      return;
    }
    const target = nextStep(session.scope, session.current_step, session.step_completion);
    if (target) {
      await goToStep(target);
    }
  }

  async function skipToReview(): Promise<void> {
    if (!session || !canSkipReview) {
      return;
    }
    await goToStep(5);
  }

  async function sendChatMessage(): Promise<void> {
    const auth = await ensureFreshAuth();
    if (!auth || !session || !chatInput.trim() || chatBusy) {
      return;
    }
    const userText = chatInput.trim();
    setChatInput('');
    setChatBusy(true);
    setStreamingText('');
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText,
    };
    setMessages((prev) => [...prev, userMessage]);

    let assistantContent = '';
    try {
      await postSetupAssistantMessage({
        apiBase: auth.apiBase,
        token: auth.token,
        path: `/admin/tenant/services/${serviceId}/setup-assistant/sessions/${session.id}/message`,
        message: userText,
        onEvent: (event) => {
          if (event.type === 'token') {
            assistantContent += event.delta;
            setStreamingText(stripToolCallMarkupFromAssistantText(assistantContent));
          }
          if (event.type === 'tool_result') {
            setStatus(`${event.name}: ${event.success ? 'OK' : 'Failed'} — ${event.summary}`);
          }
          if (event.type === 'draft_updated') {
            void loadFormPreview();
            void loadReadiness();
            if (event.layer === 'config') {
              void loadConfigPreview();
            }
          }
          if (event.type === 'error') {
            setStatus(event.message);
          }
          if (event.type === 'done') {
            void reloadSession();
          }
        },
      });
      if (assistantContent.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: stripToolCallMarkupFromAssistantText(assistantContent.trim()),
          },
        ]);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Chat failed');
    } finally {
      setStreamingText('');
      setChatBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Service setup assistant"
        title="Setup Assistant"
        subtitle="AI-assisted service setup — full flow wizard (SSA-5)"
        actions={
          <Link
            href={`/dashboard/services/${serviceId}`}
            className="text-sm font-medium text-brand hover:underline"
          >
            Back to Service Designer
          </Link>
        }
      />

      {status ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {status}
        </p>
      ) : null}

      <section className="rounded-2xl border border-warm-border bg-white p-4">
        <h2 className="text-sm font-semibold text-ink-primary">Choose scope</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {(Object.keys(SCOPE_LABELS) as SetupAssistantScope[]).map((value) => (
            <Button
              key={value}
              type="button"
              variant={scope === value ? 'primary' : 'secondary'}
              onClick={() => {
                setScope(value);
                void createSession(value);
              }}
              disabled={loading}
            >
              {SCOPE_LABELS[value]}
            </Button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-warm-border bg-white p-4">
          <h3 className="text-sm font-semibold text-ink-primary">Progress</h3>
          {stepProgressLabel ? (
            <p className="mt-1 text-xs text-ink-secondary">{stepProgressLabel}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {activeSteps.map((step) => {
              const active = session?.current_step === step;
              const complete = session?.step_completion?.[String(step)] === true;
              return (
                <button
                  key={step}
                  type="button"
                  title={stepLabel(step)}
                  className={`rounded-full px-3 py-1 text-xs ${active ? 'bg-brand text-white' : complete ? 'bg-emerald-100 text-emerald-900' : 'bg-canvas text-ink-primary'}`}
                  onClick={() => void goToStep(step)}
                  disabled={!session}
                >
                  {step}. {stepLabel(step).split(' ')[0]}
                  {complete ? ' ✓' : ''}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3 rounded-lg border border-warm-border bg-canvas p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Chat{' '}
              {showIntentStep
                ? '(intent step)'
                : showFormStep
                  ? '(form step)'
                  : showWorkflowStep
                    ? '(workflow step)'
                    : showPaymentStep
                      ? '(payment step)'
                      : showReviewStep
                        ? '(review step)'
                        : ''}
            </h4>
            <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {messages.map((message) => (
                <p
                  key={message.id}
                  className={
                    message.role === 'user'
                      ? 'rounded-lg bg-white px-3 py-2 text-ink-primary'
                      : 'rounded-lg bg-brand/5 px-3 py-2 text-ink-primary'
                  }
                >
                  <span className="font-medium">
                    {message.role === 'user' ? 'You' : 'Assistant'}:{' '}
                  </span>
                  {message.content}
                </p>
              ))}
              {displayStreamingText ? (
                <p className="rounded-lg bg-brand/5 px-3 py-2 text-ink-primary">
                  <span className="font-medium">Assistant: </span>
                  {displayStreamingText}
                </p>
              ) : null}
              {messages.length === 0 && !displayStreamingText ? (
                <p className="text-ink-secondary">
                  {showIntentStep
                    ? 'Describe the service purpose and approval pattern to classify the archetype.'
                    : showFormStep
                      ? 'Start a session and ask the assistant to add or update form fields.'
                      : showWorkflowStep
                        ? 'Ask the assistant to apply a workflow template (linear approval, scrutiny, or booking) or merge stages.'
                        : showPaymentStep
                          ? 'Ask the assistant to set fees, required documents, and revenue head mapping.'
                          : showReviewStep
                            ? 'Ask what is blocking publish or request a readiness summary.'
                            : 'Switch to an active step to use chat.'}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-warm-border bg-white px-3 py-2 text-sm"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder={
                  showIntentStep
                    ? 'Describe the service you are setting up…'
                    : showFormStep
                      ? 'Describe the form changes you need…'
                      : showWorkflowStep
                        ? 'Describe the workflow you need (e.g. apply linear approval)…'
                        : showPaymentStep
                          ? 'Describe fees, documents, and revenue mapping…'
                          : showReviewStep
                            ? 'Ask about publish readiness or blockers…'
                            : 'Chat available on active wizard steps…'
                }
                disabled={!session || chatBusy || !showChatStep}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendChatMessage();
                  }
                }}
              />
              <Button
                type="button"
                variant="primary"
                disabled={!session || chatBusy || !showChatStep || !chatInput.trim()}
                onClick={() => void sendChatMessage()}
              >
                Send
              </Button>
            </div>
          </div>

          {showFormStep && formPreview ? (
            <div className="mt-4 rounded-lg border border-warm-border bg-white p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                Form preview
              </h4>
              <div className="mt-2">
                <FormCitizenPreview
                  schema={formPreview}
                  valid={formPreviewValid}
                  values={{}}
                  onChange={() => undefined}
                />
              </div>
            </div>
          ) : null}

          {showWorkflowStep ? (
            <div className="mt-4 rounded-lg border border-warm-border bg-white p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                Workflow preview
              </h4>
              <p className="mt-1 text-xs text-ink-secondary">
                Workflow edits here only update the workflow draft. Form fields and payment settings
                are preserved.
              </p>
              {workflowPreview?.stages?.length ? (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-primary">
                  {workflowPreview.stages.map((stage) => (
                    <li key={stage.code}>
                      <span className="font-medium">{stage.label?.en ?? stage.code}</span>
                      <span className="text-ink-secondary"> ({stage.code})</span>
                      {stage.initial ? (
                        <span className="ml-1 text-xs text-emerald-700">initial</span>
                      ) : null}
                      {stage.terminal ? (
                        <span className="ml-1 text-xs text-amber-700">terminal</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-ink-secondary">No workflow draft yet.</p>
              )}
              {workflowPreview ? (
                <p className="mt-2 text-xs text-ink-secondary">
                  {workflowPreview.transitions.length} transition
                  {workflowPreview.transitions.length === 1 ? '' : 's'}
                </p>
              ) : null}
            </div>
          ) : null}
          {showPaymentStep ? (
            <div className="mt-4 rounded-lg border border-warm-border bg-white p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                Payment & documents
              </h4>
              {configPreview ? (
                <dl className="mt-2 space-y-1 text-sm text-ink-primary">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-secondary">Fee preview</dt>
                    <dd>
                      {configPreview.fee_preview_paise != null
                        ? `₹${(configPreview.fee_preview_paise / 100).toFixed(2)}`
                        : 'Not set'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-secondary">Schedule</dt>
                    <dd>{configPreview.payment_schedule}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-secondary">Documents</dt>
                    <dd>{configPreview.required_documents.length}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-secondary">Revenue head</dt>
                    <dd>{configPreview.revenue_head?.code ?? 'Not set'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-ink-secondary">No config loaded yet.</p>
              )}
            </div>
          ) : null}

          {showReviewStep ? (
            <div className="mt-4 rounded-lg border border-warm-border bg-white p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
                Publish in Service Designer
              </h4>
              <ul className="mt-2 space-y-2 text-sm">
                <li>
                  <Link
                    href={`/dashboard/services/${serviceId}#form` as Route}
                    className="font-medium text-brand hover:underline"
                  >
                    Publish form draft
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/dashboard/services/${serviceId}#workflow` as Route}
                    className="font-medium text-brand hover:underline"
                  >
                    Publish workflow draft
                  </Link>
                </li>
                <li>
                  <Link
                    href={`/dashboard/services/${serviceId}#config` as Route}
                    className="font-medium text-brand hover:underline"
                  >
                    Review service config
                  </Link>
                </li>
              </ul>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-warm-border pt-4">
            <Button
              type="button"
              variant="secondary"
              disabled={!session || !canGoBack}
              onClick={() => void goBack()}
            >
              Back step
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!session || !canGoNext}
              onClick={() => void goNext()}
            >
              Next step
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!session || !canSkipReview}
              onClick={() => void skipToReview()}
            >
              Skip to review
            </Button>
            <Link
              href={`/dashboard/services/${serviceId}` as Route}
              className="inline-flex items-center rounded-lg border border-warm-border bg-white px-3 py-2 text-xs font-medium text-brand hover:underline"
            >
              Open full designer
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border border-warm-border bg-white p-4">
          <h3 className="text-sm font-semibold text-ink-primary">Readiness</h3>
          {showReviewStep && readiness ? (
            <div
              className={cn(
                'mt-2 space-y-1 rounded-lg border px-3 py-2 text-xs',
                readinessBooleanCardClass(draftLayersReady),
              )}
            >
              <p className="font-semibold">Draft layers ready: {draftLayersReady ? 'Yes' : 'No'}</p>
              <p className={draftLayersReady ? 'text-green-800' : 'text-red-800'}>
                Publish readiness requires valid drafts plus manual publish in Service Designer.
              </p>
            </div>
          ) : null}
          <ul className="mt-3 space-y-2">
            {(readiness?.items ?? []).map((item) => (
              <li
                key={item.key}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs',
                  readinessStatusCardClass(item.status),
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink-primary">{item.label}</p>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
                      readinessStatusBadgeClass(item.status),
                    )}
                  >
                    {readinessStatusLabel(item.status)}
                  </span>
                </div>
                {item.message ? (
                  <p className={cn('mt-1.5', readinessStatusDetailClass(item.status))}>
                    {item.message}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {readiness ? (
            <p
              className={cn(
                'mt-3 rounded-lg border px-3 py-2 text-xs font-semibold',
                readinessBooleanCardClass(readiness.ready_to_publish),
              )}
            >
              Ready to publish: {readiness.ready_to_publish ? 'Yes' : 'No'}
            </p>
          ) : null}
          {showReviewStep && session?.archetype ? (
            <p className="mt-2 text-xs text-ink-secondary">Archetype: {session.archetype}</p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
