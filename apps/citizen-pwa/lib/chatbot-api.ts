import { parseChatbotSseBuffer, type ParsedChatbotSseEvent } from './chatbot-sse';
import { authHeaders, readApiError } from './workspace-http';

import type { TokenResponse } from './workspace-types';
import type {
  ChatbotConsentRequest,
  ChatbotConsentResponse,
  ChatbotFeedbackRequest,
  ChatbotFeedbackResponse,
  ChatbotLanguage,
} from '@enagar/types';

export async function fetchChatbotConsent(
  apiBase: string,
  token: TokenResponse,
  tenantCode: string,
): Promise<ChatbotConsentResponse> {
  const res = await fetch(`${apiBase}/chatbot/consent`, {
    headers: authHeaders(token, true, tenantCode),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as ChatbotConsentResponse;
}

export async function postChatbotConsent(
  apiBase: string,
  token: TokenResponse,
  tenantCode: string,
  body: ChatbotConsentRequest,
): Promise<ChatbotConsentResponse> {
  const res = await fetch(`${apiBase}/chatbot/consent`, {
    method: 'POST',
    headers: authHeaders(token, true, tenantCode),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as ChatbotConsentResponse;
}

export async function postChatbotFeedback(
  apiBase: string,
  token: TokenResponse,
  tenantCode: string,
  body: ChatbotFeedbackRequest,
): Promise<ChatbotFeedbackResponse> {
  const res = await fetch(`${apiBase}/chatbot/feedback`, {
    method: 'POST',
    headers: authHeaders(token, true, tenantCode),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as ChatbotFeedbackResponse;
}

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ slug: string; title: string }>;
};

export async function streamChatbotQuery(params: {
  apiBase: string;
  token: TokenResponse;
  tenantCode: string;
  message: string;
  sessionId: string;
  language: ChatbotLanguage;
  onEvent: (evt: ParsedChatbotSseEvent) => void;
}): Promise<void> {
  const res = await fetch(`${params.apiBase}/chatbot/query`, {
    method: 'POST',
    headers: authHeaders(params.token, true, params.tenantCode),
    body: JSON.stringify({
      message: params.message,
      session_id: params.sessionId,
      language: params.language,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(await readApiError(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const flush = (): void => {
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      if (!part.trim()) {
        continue;
      }
      for (const evt of parseChatbotSseBuffer(`${part}\n\n`)) {
        params.onEvent(evt);
      }
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    flush();
  }
  flush();
  const tail = parseChatbotSseBuffer(buffer ? `${buffer}\n\n` : '');
  for (const evt of tail) {
    params.onEvent(evt);
  }
}
