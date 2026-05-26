import { createHash } from 'node:crypto';

/** Placeholders sent to external LLM providers (ADR-0008). */
export const PII_PLACEHOLDERS = {
  phone: '[CITIZEN_PHONE]',
  aadhaar: '[AADHAAR_4]',
  holding: '[HOLDING]',
  docket: '[DOCKET]',
  name: '[CITIZEN_NAME]',
  address: '[ADDRESS]',
} as const;

export type RedactionMap = Record<string, string>;

export type RedactionResult = {
  redacted: string;
  map: RedactionMap;
  count: number;
};

type RedactionRule = {
  key: string;
  pattern: RegExp;
  replace: (match: string) => string;
};

const RULES: RedactionRule[] = [
  {
    key: 'phone',
    pattern: /(?:\+91|91|0)[\s-]*[6-9](?:[\s-]*\d){9}\b|(?:\+91[\s-]?|91[\s-]?|0)?[6-9]\d{9}\b/g,
    replace: () => PII_PLACEHOLDERS.phone,
  },
  {
    key: 'aadhaar',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?(\d{4})\b/g,
    replace: () => PII_PLACEHOLDERS.aadhaar,
  },
  {
    key: 'docket',
    pattern: /\b[A-Z]{2,5}\/[A-Z]{2,5}\/\d{4}\/\d{3,8}\b/g,
    replace: () => PII_PLACEHOLDERS.docket,
  },
  {
    key: 'docket_mid',
    pattern: /\b[A-Z]{2,5}\/[A-Z]{2,5}\/[A-Za-z0-9][A-Za-z0-9-]*\/\d{4}\/\d{3,8}\b/g,
    replace: () => PII_PLACEHOLDERS.docket,
  },
  {
    key: 'docket_grv',
    pattern: /\bGRV-[A-Z]{2,5}-\d{4}-\d{3,8}\b/gi,
    replace: () => PII_PLACEHOLDERS.docket,
  },
  {
    key: 'holding',
    pattern: /\bholding(?:\s+number)?\s*[:#]?\s*[A-Z0-9][A-Z0-9/-]{2,24}\b/gi,
    replace: () => PII_PLACEHOLDERS.holding,
  },
  {
    key: 'name_en',
    pattern:
      /\b(?:my name is|i am|applicant name is|name:)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/gi,
    replace: () => PII_PLACEHOLDERS.name,
  },
  {
    key: 'name_bn',
    pattern: /(?:আমার নাম|নাম)\s*[:：]?\s*([^\n,।]{2,40})/gi,
    replace: () => PII_PLACEHOLDERS.name,
  },
  {
    key: 'address_en',
    pattern: /\b(?:address|residing at|live at)\s*[:：]?\s*([^\n]{10,120})/gi,
    replace: () => PII_PLACEHOLDERS.address,
  },
  {
    key: 'pincode',
    pattern: /\bpin(?:\s*code)?\s*[:#]?\s*\d{6}\b/gi,
    replace: (match) => match.replace(/\d{6}/, '[PIN]'),
  },
];

/**
 * Redact PII before sending text to an external LLM. The map is kept server-side
 * for restoring provider output before streaming to the client.
 */
export function redactPii(text: string): RedactionResult {
  let redacted = text;
  const map: RedactionMap = {};
  let count = 0;

  for (const rule of RULES) {
    const before = redacted;
    redacted = redacted.replace(rule.pattern, (match) => {
      const placeholder = rule.replace(match);
      if (!map[placeholder]) {
        map[placeholder] = match;
      }
      count += 1;
      return placeholder;
    });
    if (redacted !== before) {
      continue;
    }
  }

  return { redacted, map, count };
}

/** Restore placeholders in model output using the per-request map. */
export function restorePii(text: string, map: RedactionMap): string {
  let restored = text;
  for (const [placeholder, original] of Object.entries(map)) {
    restored = restored.split(placeholder).join(original);
  }
  return restored;
}

/** SHA-256 of redacted query for audit (never store raw citizen text). */
export function hashRedactedQuery(redactedQuery: string): string {
  return createHash('sha256').update(redactedQuery, 'utf8').digest('hex');
}

/** Strip script tags from user markdown (prompt-injection hygiene for 7.3). */
export function stripUnsafeMarkup(text: string): string {
  return text.replace(/<script[\s>][\s\S]*?<\/script>/gi, '').trim();
}
