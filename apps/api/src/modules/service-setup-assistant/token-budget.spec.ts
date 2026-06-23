import {
  accumulateTokenUsage,
  isSessionOverTokenCap,
  parseTokenUsageJson,
  resolveSessionTokenCap,
} from './token-budget';

describe('token-budget', () => {
  it('parses stored usage json', () => {
    expect(parseTokenUsageJson({ input_tokens: 10, output_tokens: 5, total_tokens: 15 })).toEqual({
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
    });
  });

  it('accumulates usage across turns', () => {
    const first = accumulateTokenUsage(null, 100, 50);
    const second = accumulateTokenUsage(first, 20, 10);
    expect(second).toEqual({
      input_tokens: 120,
      output_tokens: 60,
      total_tokens: 180,
    });
  });

  it('detects over-cap sessions', () => {
    const usage = accumulateTokenUsage(null, 400, 200);
    expect(isSessionOverTokenCap(usage, 500)).toBe(true);
    expect(isSessionOverTokenCap(usage, 1000)).toBe(false);
    expect(isSessionOverTokenCap(usage, null)).toBe(false);
  });

  it('resolves cap from env', () => {
    const previous = process.env.SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION;
    process.env.SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION = '12000';
    expect(resolveSessionTokenCap()).toBe(12000);
    process.env.SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION = '';
    expect(resolveSessionTokenCap()).toBeNull();
    if (previous === undefined) {
      delete process.env.SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION;
    } else {
      process.env.SETUP_ASSISTANT_MAX_TOKENS_PER_SESSION = previous;
    }
  });
});
