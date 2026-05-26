'use client';

import { Button, Card, Icon } from '@enagar/ui';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import {
  fetchChatbotConsent,
  postChatbotConsent,
  postChatbotFeedback,
  streamChatbotQuery,
  type ChatMessage,
} from '../lib/chatbot-api';

import type { TokenResponse, PwaLocaleCode } from '../lib/workspace-types';
import type { ChatbotConsentMode, ChatbotLanguage } from '@enagar/types';
import type { JSX } from 'react';

const SUGGESTIONS: Record<ChatbotLanguage, string[]> = {
  en: [
    'How do I apply for a birth certificate?',
    'What documents are needed for trade licence?',
    'How do I file a grievance?',
  ],
  bn: ['আমি কীভাবে জন্ম সার্টিফিকেট পাবো?', 'ট্রেড লাইসেন্সের জন্য কী কাগজ লাগে?'],
  hi: ['जन्म प्रमाणपत्र के लिए आवेदन कैसे करें?', 'ट्रेड लाइसेंस के लिए कौन से दस्तावेज चाहिए?'],
};

export function SahayakWorkspace({
  apiBaseUrl,
  token,
  tenantCode,
  tenantName,
  language,
  layout = 'page',
}: {
  apiBaseUrl: string;
  token: TokenResponse;
  tenantCode: string;
  tenantName: string;
  language: PwaLocaleCode;
  /** `drawer` fills the slide-over panel; `page` keeps the legacy full-width card. */
  layout?: 'page' | 'drawer';
}): JSX.Element {
  const inDrawer = layout === 'drawer';
  const chatLang: ChatbotLanguage = language;
  const sessionRef = useRef(`pwa-${Date.now()}`);
  const listRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  const [consentOpen, setConsentOpen] = useState(false);
  const [consentMode, setConsentMode] = useState<ChatbotConsentMode | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastSessionId, setLastSessionId] = useState(sessionRef.current);

  const loadConsent = useCallback(async () => {
    try {
      const row = await fetchChatbotConsent(apiBaseUrl, token, tenantCode);
      if (row.accepted && row.mode) {
        setConsentMode(row.mode);
        setConsentOpen(false);
      } else {
        setConsentOpen(true);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Consent check failed');
      setConsentOpen(true);
    }
  }, [apiBaseUrl, tenantCode, token]);

  useEffect(() => {
    void loadConsent();
  }, [loadConsent]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function acceptConsent(mode: ChatbotConsentMode): Promise<void> {
    await postChatbotConsent(apiBaseUrl, token, tenantCode, { mode, accepted: true });
    setConsentMode(mode);
    setConsentOpen(false);
  }

  async function sendMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || busy || !consentMode) {
      return;
    }
    setBusy(true);
    setStatus(null);
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');

    let assistant = '';
    const citations: ChatMessage['citations'] = [];

    try {
      await streamChatbotQuery({
        apiBase: apiBaseUrl,
        token,
        tenantCode,
        message: trimmed,
        sessionId: sessionRef.current,
        language: chatLang,
        onEvent: (evt) => {
          if (evt.event === 'meta') {
            setLastSessionId(evt.data.session_id);
            for (const c of evt.data.citations) {
              citations.push({ slug: c.slug, title: c.title });
            }
          } else if (evt.event === 'token') {
            assistant += evt.data.delta;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: assistant,
                  citations,
                };
              } else {
                copy.push({ role: 'assistant', content: assistant, citations });
              }
              return copy;
            });
          } else if (evt.event === 'error') {
            setStatus(evt.data.message);
          }
        },
      });
      if (!assistant) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'No response received.', citations },
        ]);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Chat failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitFeedback(rating: 1 | -1): Promise<void> {
    try {
      await postChatbotFeedback(apiBaseUrl, token, tenantCode, {
        session_id: lastSessionId,
        rating,
      });
      setStatus(rating === 1 ? 'Thanks for your feedback.' : 'Feedback recorded.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Feedback failed');
    }
  }

  const modeLabel = consentMode === 'kb_only' ? 'KB-only' : 'AI-assisted';

  return (
    <div className={inDrawer ? 'flex h-full min-h-0 flex-col' : 'space-y-4'}>
      <Card
        className={
          inDrawer
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden border border-warm-border/60 bg-gradient-to-br from-peach-accent/20 via-brand-muted/30 to-mint-band/40 p-0 shadow-sm'
            : 'overflow-hidden border-0 bg-gradient-to-br from-peach-accent/30 via-brand-muted to-mint-band p-0 shadow-md'
        }
        padding="none"
      >
        {!inDrawer ? (
          <div className="border-b border-white/40 bg-white/50 px-5 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-forest text-white shadow">
                <Icon name="bot" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-ink-primary">Sahayak</h2>
                <p className="text-sm font-medium text-ink-secondary">
                  {tenantName} ({tenantCode}) · {modeLabel}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="shrink-0 border-b border-white/40 bg-white/40 px-4 py-2 text-xs font-medium text-ink-secondary backdrop-blur-sm">
            {modeLabel}
            {consentMode ? null : ' · consent required'}
          </p>
        )}

        <div
          ref={listRef}
          className={
            inDrawer
              ? 'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4'
              : 'flex max-h-[min(52vh,28rem)] min-h-[14rem] flex-col gap-3 overflow-y-auto px-4 py-4'
          }
        >
          {messages.length === 0 ? (
            <p className="text-center text-sm text-ink-secondary">
              Ask about services, documents, fees, or grievances in English, Bengali, or Hindi.
            </p>
          ) : null}
          {messages.map((msg, index) => (
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'ml-auto bg-brand text-brand-fg'
                  : 'mr-auto border border-warm-border bg-white text-ink-primary'
              }`}
              key={`${msg.role}-${index}`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'assistant' && msg.citations?.length ? (
                <ul className="mt-2 space-y-1 border-t border-warm-border/60 pt-2 text-xs text-ink-muted">
                  {msg.citations.map((c) => (
                    <li key={c.slug}>
                      [{c.slug}] {c.title}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          {busy ? (
            <p className="text-center text-xs font-medium text-ink-muted">Sahayak is typing…</p>
          ) : null}
        </div>

        <div className="border-t border-white/50 bg-white/70 px-4 py-3 backdrop-blur-sm">
          <div className="mb-2 flex flex-wrap gap-2">
            {SUGGESTIONS[chatLang].map((suggestion) => (
              <button
                className="rounded-full border border-brand/20 bg-brand-muted px-3 py-1 text-xs font-medium text-brand hover:bg-brand/10"
                key={suggestion}
                onClick={() => void sendMessage(suggestion)}
                type="button"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(input);
            }}
          >
            <label className="sr-only" htmlFor={inputId}>
              Message Sahayak
            </label>
            <input
              className="min-w-0 flex-1 rounded-2xl border border-warm-border px-4 py-2.5 text-sm"
              disabled={busy || !consentMode}
              id={inputId}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              value={input}
            />
            <Button disabled={busy || !consentMode} type="submit" variant="primary">
              Send
            </Button>
          </form>
          {messages.some((m) => m.role === 'assistant') ? (
            <div className="mt-2 flex gap-2">
              <Button onClick={() => void submitFeedback(1)} size="sm" variant="ghost">
                <Icon name="check" size={16} /> Helpful
              </Button>
              <Button onClick={() => void submitFeedback(-1)} size="sm" variant="ghost">
                Not helpful
              </Button>
            </div>
          ) : null}
          {status ? <p className="mt-2 text-xs font-medium text-forest">{status}</p> : null}
        </div>
      </Card>

      {consentOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-primary/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sahayak-consent-title"
        >
          <Card className="max-w-lg border border-warm-border bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-black text-ink-primary" id="sahayak-consent-title">
              Sahayak AI disclosure
            </h3>
            <p className="mt-3 text-sm leading-6 text-ink-secondary">
              Your questions are answered using this municipality&apos;s knowledge base. If you
              choose <strong>AI-assisted</strong> mode, redacted text is sent to the configured LLM
              provider (OpenAI / Google / Ollama per ULB policy). Personal identifiers are replaced
              with placeholders before transmission. You may use <strong>KB-only</strong> mode with
              no external AI.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                onClick={() => void acceptConsent('llm')}
                variant="primary"
              >
                Accept — AI-assisted
              </Button>
              <Button
                className="flex-1"
                onClick={() => void acceptConsent('kb_only')}
                variant="secondary"
              >
                KB-only (no external AI)
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
