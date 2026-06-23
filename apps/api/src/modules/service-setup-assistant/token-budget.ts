export type SetupTokenUsage = {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

export function parseTokenUsageJson(value: unknown): SetupTokenUsage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const input = Number(row.input_tokens);
  const output = Number(row.output_tokens);
  const total = Number(row.total_tokens);
  if (!Number.isFinite(input) || !Number.isFinite(output) || !Number.isFinite(total)) {
    return null;
  }
  return {
    input_tokens: Math.max(0, Math.floor(input)),
    output_tokens: Math.max(0, Math.floor(output)),
    total_tokens: Math.max(0, Math.floor(total)),
  };
}

export function accumulateTokenUsage(
  current: SetupTokenUsage | null,
  inputTokens?: number,
  outputTokens?: number,
): SetupTokenUsage {
  const inputDelta = Number.isFinite(inputTokens) ? Math.max(0, Math.floor(inputTokens!)) : 0;
  const outputDelta = Number.isFinite(outputTokens) ? Math.max(0, Math.floor(outputTokens!)) : 0;
  const base = current ?? { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  const input_tokens = base.input_tokens + inputDelta;
  const output_tokens = base.output_tokens + outputDelta;
  return {
    input_tokens,
    output_tokens,
    total_tokens: input_tokens + output_tokens,
  };
}

export function resolveSessionTokenCap(): number | null {
  const raw = process.env.SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION;
  if (!raw || raw.trim() === '') {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

export function isSessionOverTokenCap(usage: SetupTokenUsage | null, cap: number | null): boolean {
  if (cap === null) {
    return false;
  }
  const total = usage?.total_tokens ?? 0;
  return total >= cap;
}
