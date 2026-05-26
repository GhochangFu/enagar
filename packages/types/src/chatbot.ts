/** Sahayak chatbot API contracts (Phase 7.3). */

export type ChatbotLanguage = 'en' | 'bn' | 'hi';

export type ChatbotCitation = {
  slug: string;
  title: string;
  score: number;
  source_type?: string;
};

export type ChatbotQueryRequest = {
  message: string;
  session_id?: string;
  language?: ChatbotLanguage;
};

/** SSE `event: meta` payload — sent before tokens. */
export type ChatbotSseMeta = {
  session_id: string;
  language: ChatbotLanguage;
  citations: ChatbotCitation[];
};

/** SSE `event: token` payload. */
export type ChatbotSseToken = {
  delta: string;
};

/** SSE `event: done` payload. */
export type ChatbotSseDone = {
  session_id: string;
  finish_reason?: string;
};

/** SSE `event: error` payload. */
export type ChatbotSseError = {
  code: string;
  message: string;
};

export type ChatbotHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatbotCitation[];
  created_at: string;
};

export type ChatbotHistoryResponse = {
  session_id: string;
  messages: ChatbotHistoryMessage[];
};

export type ChatbotConsentMode = 'llm' | 'kb_only';

export type ChatbotConsentResponse = {
  accepted: boolean;
  mode: ChatbotConsentMode | null;
  disclosure_version: string;
  updated_at: string | null;
};

export type ChatbotConsentRequest = {
  mode: ChatbotConsentMode;
  accepted: boolean;
};

export type ChatbotFeedbackRequest = {
  session_id: string;
  rating: 1 | -1;
  assistant_message_id?: string;
};

export type ChatbotFeedbackResponse = {
  id: string;
  recorded: true;
};
