import type { ChatbotLanguage } from '@enagar/types';

const BENGALI_RE = /[\u0980-\u09FF]/;
const DEVANAGARI_RE = /[\u0900-\u097F]/;

/** Lightweight script detection for reply language (no external NLP dep). */
export function detectChatbotLanguage(text: string, preferred?: ChatbotLanguage): ChatbotLanguage {
  if (preferred && preferred !== 'en') {
    return preferred;
  }
  if (BENGALI_RE.test(text)) {
    return 'bn';
  }
  if (DEVANAGARI_RE.test(text)) {
    return 'hi';
  }
  return preferred ?? 'en';
}

export function languageInstruction(lang: ChatbotLanguage): string {
  switch (lang) {
    case 'bn':
      return 'Reply in Bengali (বাংলা).';
    case 'hi':
      return 'Reply in Hindi (हिन्दी).';
    default:
      return 'Reply in English.';
  }
}
