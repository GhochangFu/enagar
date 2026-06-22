'use client';

import { validateFormSchema, type EnagarFormSchema, EnagarFormSchema } from '@enagar/forms';
import { FormCitizenPreview } from '@enagar/forms/builder';
import { Button, PageHeader } from '@enagar/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTenantAdminSession } from '../../../../../components/tenant-admin-session';
import { postSetupAssistantMessage } from '../../../../../lib/setup-assistant-sse';

import type { SetupAssistantScope, SetupSessionDto, SetupReadinessChecklist } from '@enagar/types';
import type { Route } from 'next';

const SCOPE_LABELS: Record<SetupAssistantScope, string> = {
  full: 'Full setup',
  form: 'Form only',
  workflow: 'Workflow only',
  payment: 'Payment only',
  review: 'Review only',
};

const SCOPE_STEPS: Record<SetupAssistantScope, number[]> = {
  full: [1, 2, 3, 4, 5],
  form: [2, 5],
  workflow: [3, 5],
  payment: [4, 5],
  review: [5],
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function SetupAssistantClient({ serviceId }: { serviceId: string }): JSX.Element {
  const { token, apiBase } = useTenantAdminSession();
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
  const formPreviewValid = useMemo(
    () => (formPreview ? validateFormSchema(formPreview).ok : false),
    [formPreview],
  );

  const activeSteps = useMemo(() => SCOPE_STEPS[session?.scope ?? scope], [scope, session?.scope]);
  const showFormStep = session?.current_step === 2;

  const loadReadiness = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    const res = await fetch(
      `${apiBase}/admin/tenant/services/${serviceId}/setup-assistant/readiness`,
      {
        cache: 'no-store',
        headers: { authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      setStatus(`Readiness load failed (${res.status}).`);
      return;
    }
    setReadiness((await res.json()) as SetupReadinessChecklist);
  }, [apiBase, serviceId, token]);

  const loadFormPreview = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }
    const res = await fetch(`${apiBase}/admin/tenant/services/${serviceId}/designer`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return;
    }
    const designer = (await res.json()) as {
      form_draft?: { form_schema?: EnagarFormSchema } | null;
      starter_form_schema?: EnagarFormSchema;
    };
    const schema = designer.form_draft?.form_schema ?? designer.starter_form_schema ?? null;
    setFormPreview(schema);
  }, [apiBase, serviceId, token]);

  useEffect(() => {
    void loadReadiness();
    void loadFormPreview();
  }, [loadFormPreview, loadReadiness]);

  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    if (!sessionId || !token) {
      return;
    }
    const loadSession = async () => {
      const res = await fetch(
        `${apiBase}/admin/tenant/services/${serviceId}/setup-assistant/sessions/${sessionId}`,
        {
          cache: 'no-store',
          headers: { authorization: `Bearer ${token}` },
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
  }, [apiBase, searchParams, serviceId, token]);

  async function createSession(nextScope: SetupAssistantScope): Promise<void> {
    if (!token) {
      return;
    }
    setLoading(true);
    setStatus(null);
    setMessages([]);
    try {
      const res = await fetch(
        `${apiBase}/admin/tenant/services/${serviceId}/setup-assistant/sessions`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
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
    } finally {
      setLoading(false);
    }
  }

  async function setCurrentStep(nextStep: number): Promise<void> {
    if (!token || !session) {
      return;
    }
    const res = await fetch(
      `${apiBase}/admin/tenant/services/${serviceId}/setup-assistant/sessions/${session.id}/step`,
      {
        method: 'PATCH',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
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

  async function sendChatMessage(): Promise<void> {
    if (!token || !session || !chatInput.trim() || chatBusy) {
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
        apiBase,
        token,
        path: `/admin/tenant/services/${serviceId}/setup-assistant/sessions/${session.id}/message`,
        message: userText,
        onEvent: (event) => {
          if (event.type === 'token') {
            assistantContent += event.delta;
            setStreamingText(assistantContent);
          }
          if (event.type === 'tool_result') {
            setStatus(`${event.name}: ${event.success ? 'OK' : 'Failed'} — ${event.summary}`);
          }
          if (event.type === 'draft_updated') {
            void loadFormPreview();
            void loadReadiness();
          }
          if (event.type === 'error') {
            setStatus(event.message);
          }
        },
      });
      if (assistantContent.trim()) {
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: 'assistant', content: assistantContent.trim() },
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
        subtitle="Form step with AI chat and auto-save drafts (SSA-2)"
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
          <div className="mt-3 flex flex-wrap gap-2">
            {activeSteps.map((step) => {
              const active = session?.current_step === step;
              const complete = session?.step_completion?.[String(step)] === true;
              return (
                <button
                  key={step}
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs ${active ? 'bg-brand text-white' : complete ? 'bg-emerald-100 text-emerald-900' : 'bg-canvas text-ink-primary'}`}
                  onClick={() => void setCurrentStep(step)}
                  disabled={!session}
                >
                  Step {step}
                  {complete ? ' ✓' : ''}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3 rounded-lg border border-warm-border bg-canvas p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Chat {showFormStep ? '(form step)' : ''}
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
              {streamingText ? (
                <p className="rounded-lg bg-brand/5 px-3 py-2 text-ink-primary">
                  <span className="font-medium">Assistant: </span>
                  {streamingText}
                </p>
              ) : null}
              {messages.length === 0 && !streamingText ? (
                <p className="text-ink-secondary">
                  Start a session and ask the assistant to add or update form fields.
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-warm-border bg-white px-3 py-2 text-sm"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Describe the form changes you need…"
                disabled={!session || chatBusy || !showFormStep}
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
                disabled={!session || chatBusy || !showFormStep || !chatInput.trim()}
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
        </article>

        <article className="rounded-2xl border border-warm-border bg-white p-4">
          <h3 className="text-sm font-semibold text-ink-primary">Readiness</h3>
          <ul className="mt-3 space-y-2">
            {(readiness?.items ?? []).map((item) => (
              <li key={item.key} className="rounded-lg border border-warm-border px-3 py-2 text-xs">
                <p className="font-medium text-ink-primary">{item.label}</p>
                <p className="mt-1 text-ink-secondary">Status: {item.status}</p>
                {item.message ? <p className="mt-1 text-ink-secondary">{item.message}</p> : null}
              </li>
            ))}
          </ul>
          {readiness ? (
            <p className="mt-3 text-xs font-semibold text-ink-primary">
              Ready to publish: {readiness.ready_to_publish ? 'Yes' : 'No'}
            </p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
