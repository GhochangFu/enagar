import { HttpException } from '@nestjs/common';

import {
  assertHoardingQuoteRateLimit,
  DEFAULT_HOARDING_QUOTE_LIMIT_PER_HOUR,
  resetHoardingQuoteRateLimitForTests,
} from './hoarding-quote-rate-limit';

describe('hoarding-quote-rate-limit', () => {
  const subject = 'citizen-subject-1';

  beforeEach(() => {
    resetHoardingQuoteRateLimitForTests();
    delete process.env.HOARDING_QUOTE_LIMIT_PER_HOUR;
  });

  it('allows quotes up to the hourly limit', () => {
    for (let index = 0; index < DEFAULT_HOARDING_QUOTE_LIMIT_PER_HOUR; index += 1) {
      expect(() => assertHoardingQuoteRateLimit(subject)).not.toThrow();
    }
  });

  it('rejects when hourly limit is exceeded', () => {
    for (let index = 0; index < DEFAULT_HOARDING_QUOTE_LIMIT_PER_HOUR; index += 1) {
      assertHoardingQuoteRateLimit(subject);
    }
    expect(() => assertHoardingQuoteRateLimit(subject)).toThrow(HttpException);
  });

  it('honours HOARDING_QUOTE_LIMIT_PER_HOUR override', () => {
    process.env.HOARDING_QUOTE_LIMIT_PER_HOUR = '2';
    assertHoardingQuoteRateLimit(subject);
    assertHoardingQuoteRateLimit(subject);
    expect(() => assertHoardingQuoteRateLimit(subject)).toThrow(HttpException);
  });
});
