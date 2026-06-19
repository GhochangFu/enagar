import { HttpException, HttpStatus } from '@nestjs/common';

/** Citizen hoarding calculator quote cap (Sprint 8.5G). Override via env. */
export const DEFAULT_HOARDING_QUOTE_LIMIT_PER_HOUR = 60;
const WINDOW_MS = 60 * 60 * 1000;

const buckets = new Map<string, number[]>();

function resolveLimit(): number {
  const raw = Number(
    process.env.HOARDING_QUOTE_LIMIT_PER_HOUR ?? String(DEFAULT_HOARDING_QUOTE_LIMIT_PER_HOUR),
  );
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_HOARDING_QUOTE_LIMIT_PER_HOUR;
}

/** Test hook — clears in-memory counters between unit tests. */
export function resetHoardingQuoteRateLimitForTests(): void {
  buckets.clear();
}

export function assertHoardingQuoteRateLimit(subject: string): void {
  const limit = resolveLimit();
  const now = Date.now();
  const key = subject.trim() || 'anonymous';
  const prior = (buckets.get(key) ?? []).filter((ts) => now - ts < WINDOW_MS);
  if (prior.length >= limit) {
    throw new HttpException(
      `Hoarding quote rate limit reached (${limit} per hour)`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  prior.push(now);
  buckets.set(key, prior);
}
