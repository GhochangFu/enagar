import { BadRequestException } from '@nestjs/common';

import { sanitizeChatbotInput } from '../chatbot/guardrails';

/** Staff setup assistant — policy violations beyond citizen chatbot scope. */
const POLICY_VIOLATION_PATTERNS: RegExp[] = [
  /\b(auto[- ]?publish|publish\s+now|go\s+live)\b/i,
  /\b(publish|activate)\s+(the\s+)?(form|workflow|service|config)\b/i,
  /\b(cross[- ]?tenant|other\s+tenant|different\s+tenant|another\s+tenant)\b/i,
  /\b(access|read|fetch|open)\s+.*\btenant\b.*\b(data|service|session)\b/i,
  /\b(disable|skip|bypass|turn\s+off|ignore)\s+.*(validation|validator|validators)\b/i,
];

const MAX_SETUP_MESSAGE_CHARS = 4000;

export type SetupGuardrailResult = {
  sanitized: string;
  blocked: boolean;
  reason?: string;
};

export function sanitizeSetupAssistantInput(raw: string): SetupGuardrailResult {
  const base = sanitizeChatbotInput(raw);
  if (base.blocked) {
    return base;
  }

  let sanitized = base.sanitized;
  if (sanitized.length > MAX_SETUP_MESSAGE_CHARS) {
    sanitized = sanitized.slice(0, MAX_SETUP_MESSAGE_CHARS);
  }

  for (const pattern of POLICY_VIOLATION_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        sanitized,
        blocked: true,
        reason: 'Request violates setup assistant policy (no publish or cross-tenant actions)',
      };
    }
  }

  return { sanitized, blocked: false };
}

export function assertSetupAssistantInputAllowed(raw: string): string {
  const result = sanitizeSetupAssistantInput(raw);
  if (result.blocked) {
    throw new BadRequestException(
      result.reason ?? 'Message rejected by setup assistant guardrails',
    );
  }
  return result.sanitized;
}
