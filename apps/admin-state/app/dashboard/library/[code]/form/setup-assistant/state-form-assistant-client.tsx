'use client';

import { validateFormSchema, type EnagarFormSchema } from '@enagar/forms';
import { FormCitizenPreview } from '@enagar/forms/builder';
import { Button, PageHeader } from '@enagar/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { type StateOAuthBundle } from '../../../../../../lib/oauth/session-storage-keys';
import { postSetupAssistantMessage } from '../../../../../../lib/setup-assistant-sse';
import { readApiError, readStoredStateAuth } from '../../../../../../lib/state-admin-auth';
import { pickLabel } from '../../../../../../lib/state-dashboard-forms';

import type { SetupReadinessChecklist, SetupSessionDto } from '@enagar/types';
import type { Route } from 'next';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type GlobalTemplateRow = {
  code: string;
  name: unknown;
  form_schema: unknown;
};

function resolveFormSchema(value: unknown, code: string): EnagarFormSchema | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const schema = value as EnagarFormSchema;
  if (!validateFormSchema(schema).ok) {
    return null;
  }
  if (schema.service_code !== code) {
    return null;
  }
  return schema;
}

export function StateFormAssistantClient({ code }: { code: string }): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [auth, setAuth] = useState<StateOAuthBundle | null>(null);
  const [session, setSession] = useState<SetupSessionDto | null>(null);
  const [readiness, setReadiness] = useState<SetupReadinessChecklist | null>(null);
  const [status, setStatus] = useState<string | null>('Loading…');
  const [loading, setLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [formPreview, setFormPreview] = useState<EnagarFormSchema | null>(null);
  const [templateName, setTemplateName] = useState(code);

  const apiBase = auth?.api_base_url ?? 'http://localhost:3001/api';

  useEffect(() => {
    setAuth(readStoredStateAuth());
  }, []);

  const loadTemplatePreview = useCallback(async (): Promise<void> => {
    if (!auth) {
      return;
    }
    const response = await fetch(`${apiBase}/admin/state/global-service-library`, {
      headers: { authorization: `Bearer ${auth.access_token}` },
    });
    if (!response.ok) {
      setStatus(await readApiError(response));
      return;
    }
    const rows = (await response.json()) as GlobalTemplateRow[];
    const row = rows.find((item) => item.code === code);
    if (!row) {
      setStatus('Global template not found.');
      return;
    }
    setTemplateName(pickLabel(row.name));
    setFormPreview(resolveFormSchema(row.form_schema, code));
    setStatus(null);
  }, [apiBase, auth, code]);

  const loadReadiness = useCallback(async (): Promise<void> => {
    if (!auth) {
      return;
    }
    const response = await fetch(
      `${apiBase}/admin/state/global-service-library/${code}/setup-assistant/readiness`,
      { headers: { authorization: `Bearer ${auth.access_token}` } },
    );
    if (response.ok) {
      setReadiness((await response.json()) as SetupReadinessChecklist);
    }
  }, [apiBase, auth, code]);

  useEffect(() => {
    void loadTemplatePreview();
    void loadReadiness();
  }, [loadReadiness, loadTemplatePreview]);

  useEffect(() => {
    const sessionId = searchParams.get('sessionId');
    if (!sessionId || !auth) {
      return;
    }
    const loadSession = async () => {
      const response = await fetch(
        `${apiBase}/admin/state/global-service-library/${code}/setup-assistant/sessions/${sessionId}`,
        { headers: { authorization: `Bearer ${auth.access_token}` } },
      );
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        session: SetupSessionDto;
        checklist?: SetupReadinessChecklist;
      };
      setSession(payload.session);
      if (payload.checklist) {
        setReadiness(payload.checklist);
      }
    };
    void loadSession();
  }, [apiBase, auth, code, searchParams]);

  async function createSession(): Promise<void> {
    if (!auth) {
      return;
    }
    setLoading(true);
    setMessages([]);
    try {
      const response = await fetch(
        `${apiBase}/admin/state/global-service-library/${code}/setup-assistant/sessions`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${auth.access_token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ scope: 'form' }),
        },
      );
      if (!response.ok) {
        setStatus(await readApiError(response));
        return;
      }
      const created = (await response.json()) as SetupSessionDto;
      setSession(created);
      router.replace(
        `/dashboard/library/${code}/form/setup-assistant?sessionId=${created.id}` as Route,
      );
      setStatus('Form setup session started.');
      await loadReadiness();
    } finally {
      setLoading(false);
    }
  }

  async function sendChatMessage(): Promise<void> {
    if (!auth || !session || !chatInput.trim() || chatBusy) {
      return;
    }
    const userText = chatInput.trim();
    setChatInput('');
    setChatBusy(true);
    setStreamingText('');
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content: userText }]);

    let assistantContent = '';
    try {
      await postSetupAssistantMessage({
        apiBase,
        token: auth.access_token,
        path: `/admin/state/global-service-library/${code}/setup-assistant/sessions/${session.id}/message`,
        message: userText,
        onEvent: (event) => {
          if (event.type === 'token') {
            assistantContent += event.delta;
            setStreamingText(assistantContent);
          }
          if (event.type === 'tool_result') {
            setStatus(`${event.name}: ${event.summary}`);
          }
          if (event.type === 'draft_updated') {
            void loadTemplatePreview();
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
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: assistantContent.trim(),
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

  const formPreviewValid = formPreview ? validateFormSchema(formPreview).ok : false;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <PageHeader
        eyebrow="Global form setup assistant"
        title={templateName}
        subtitle={`Template ${code} · form step (SSA-2)`}
        actions={
          <Link
            href={`/dashboard/library/${code}/form`}
            className="text-sm font-medium text-platform-accent hover:underline"
          >
            Back to form builder
          </Link>
        }
      />

      {status ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {status}
        </p>
      ) : null}

      <section className="rounded-2xl border border-warm-border bg-white p-4">
        <Button
          type="button"
          variant="primary"
          disabled={loading || !auth}
          onClick={() => void createSession()}
        >
          {session ? 'New form session' : 'Start form session'}
        </Button>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-warm-border bg-white p-4">
          <div className="space-y-3 rounded-lg border border-warm-border bg-canvas p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Chat
            </h4>
            <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {messages.map((message) => (
                <p key={message.id} className="rounded-lg bg-white px-3 py-2 text-ink-primary">
                  <span className="font-medium">
                    {message.role === 'user' ? 'You' : 'Assistant'}:{' '}
                  </span>
                  {message.content}
                </p>
              ))}
              {streamingText ? (
                <p className="rounded-lg bg-brand/5 px-3 py-2 text-ink-primary">{streamingText}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-warm-border bg-white px-3 py-2 text-sm"
                value={chatInput}
                disabled={!session || chatBusy}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Describe global form changes…"
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
                disabled={!session || chatBusy || !chatInput.trim()}
                onClick={() => void sendChatMessage()}
              >
                Send
              </Button>
            </div>
          </div>

          {formPreview ? (
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
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
