import type {
  ChatbotConsentRequest,
  ChatbotConsentResponse,
  ChatbotFeedbackRequest,
  ChatbotLanguage,
} from '@enagar/types';

import { citizenTenantFetch } from './citizenTenantHttp';

export async function fetchChatbotConsent(
  apiRoot: string,
  accessToken: string,
  municipalityCode: string,
): Promise<ChatbotConsentResponse> {
  const res = await citizenTenantFetch(
    'GET',
    apiRoot,
    accessToken,
    municipalityCode,
    '/chatbot/consent',
  );
  if (!res.ok) {
    throw new Error(`Consent check failed (${res.status})`);
  }
  return (await res.json()) as ChatbotConsentResponse;
}

export async function postChatbotConsent(
  apiRoot: string,
  accessToken: string,
  municipalityCode: string,
  body: ChatbotConsentRequest,
): Promise<ChatbotConsentResponse> {
  const res = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityCode,
    '/chatbot/consent',
    { body },
  );
  if (!res.ok) {
    throw new Error(`Consent save failed (${res.status})`);
  }
  return (await res.json()) as ChatbotConsentResponse;
}

export async function postChatbotFeedback(
  apiRoot: string,
  accessToken: string,
  municipalityCode: string,
  body: ChatbotFeedbackRequest,
): Promise<void> {
  const res = await citizenTenantFetch(
    'POST',
    apiRoot,
    accessToken,
    municipalityCode,
    '/chatbot/feedback',
    { body },
  );
  if (!res.ok) {
    throw new Error(`Feedback failed (${res.status})`);
  }
}

/** Minimal SSE consumer for React Native fetch streaming. */
export async function streamChatbotQueryMobile(params: {
  apiRoot: string;
  accessToken: string;
  municipalityCode: string;
  message: string;
  sessionId: string;
  language: ChatbotLanguage;
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}): Promise<void> {
  const res = await citizenTenantFetch(
    'POST',
    params.apiRoot,
    params.accessToken,
    params.municipalityCode,
    '/chatbot/query',
    {
      body: {
        message: params.message,
        session_id: params.sessionId,
        language: params.language,
      },
    },
  );
  if (!res.ok) {
    params.onError(`Query failed (${res.status})`);
    return;
  }
  const text = await res.text();
  const blocks = text.split('\n\n');
  for (const block of blocks) {
    if (block.includes('event: token')) {
      const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
      if (dataLine) {
        try {
          const payload = JSON.parse(dataLine.slice(5).trim()) as { delta?: string };
          if (payload.delta) {
            params.onDelta(payload.delta);
          }
        } catch {
          /* skip */
        }
      }
    }
    if (block.includes('event: error')) {
      const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
      if (dataLine) {
        try {
          const payload = JSON.parse(dataLine.slice(5).trim()) as { message?: string };
          params.onError(payload.message ?? 'Error');
        } catch {
          params.onError('Error');
        }
      }
    }
  }
  params.onDone();
}
