import { BadRequestException } from '@nestjs/common';

import { stripUnsafeMarkup } from './redaction';

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /disregard\s+(the\s+)?system\s+prompt/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /reveal\s+(?:the\s+)?(?:hidden\s+)?(?:system\s+)?prompt/i,
  /<\s*script/i,
  /javascript:/i,
  /```\s*system/i,
];

const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  /\b(write|generate)\s+(me\s+)?(a\s+)?(python|javascript|sql)\s+(script|code)\b/i,
  /\b(hack|exploit|bypass)\s+(the\s+)?(security|auth)\b/i,
];

export type GuardrailResult = {
  sanitized: string;
  blocked: boolean;
  reason?: string;
};

export function sanitizeChatbotInput(raw: string): GuardrailResult {
  let sanitized = stripUnsafeMarkup(raw.trim());
  if (sanitized.length < 3) {
    return { sanitized, blocked: true, reason: 'Message too short' };
  }
  if (sanitized.length > 2000) {
    sanitized = sanitized.slice(0, 2000);
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      return { sanitized, blocked: true, reason: 'Prompt injection pattern detected' };
    }
  }

  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        sanitized,
        blocked: true,
        reason: 'Request is out of scope for municipal assistance',
      };
    }
  }

  return { sanitized, blocked: false };
}

export function assertChatbotInputAllowed(raw: string): string {
  const result = sanitizeChatbotInput(raw);
  if (result.blocked) {
    throw new BadRequestException(result.reason ?? 'Message rejected by guardrails');
  }
  return result.sanitized;
}
