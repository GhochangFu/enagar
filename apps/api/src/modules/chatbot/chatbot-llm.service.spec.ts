import { ForbiddenException } from '@nestjs/common';

import { ChatbotLlmService } from './chatbot-llm.service';

describe('ChatbotLlmService', () => {
  const audit = { record: jest.fn() };
  const prisma = {
    tenant: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  let service: ChatbotLlmService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ChatbotLlmService(prisma as never, audit as never);
  });

  it('resolveProviderName prefers tenant override', () => {
    expect(service.resolveProviderName({ provider: 'gemini' })).toBe('gemini');
  });

  it('resolveProviderName falls back to LLM_PROVIDER env', () => {
    const prev = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'ollama';
    expect(service.resolveProviderName(undefined)).toBe('ollama');
    process.env.LLM_PROVIDER = prev;
  });

  it('assertDpaAllowsProviderCall blocks without dpa_signed', () => {
    const prevNode = process.env.NODE_ENV;
    const prevSkip = process.env.CHATBOT_DPA_SKIP_DEV;
    process.env.NODE_ENV = 'production';
    delete process.env.CHATBOT_DPA_SKIP_DEV;
    expect(() => service.assertDpaAllowsProviderCall({ dpa_signed: false })).toThrow(
      ForbiddenException,
    );
    process.env.NODE_ENV = prevNode;
    process.env.CHATBOT_DPA_SKIP_DEV = prevSkip;
  });

  it('assertDpaAllowsProviderCall passes when dpa_signed', () => {
    expect(() => service.assertDpaAllowsProviderCall({ dpa_signed: true })).not.toThrow();
  });

  it('resolveFallbackProviderName reads env when not in tenant config', () => {
    const prev = process.env.CHATBOT_FALLBACK_PROVIDER;
    process.env.CHATBOT_FALLBACK_PROVIDER = 'gemini';
    expect(service.resolveFallbackProviderName('openai', undefined)).toBe('gemini');
    expect(service.resolveFallbackProviderName('openai', { provider: 'openai' })).toBe('gemini');
    process.env.CHATBOT_FALLBACK_PROVIDER = prev;
  });

  it('resolveFallbackProviderName returns null when same as primary', () => {
    expect(service.resolveFallbackProviderName('openai', { fallback_provider: 'openai' })).toBe(
      null,
    );
  });

  it('assertDpaAllowsProviderCall respects CHATBOT_DPA_SKIP_DEV in development', () => {
    const prevNode = process.env.NODE_ENV;
    const prevSkip = process.env.CHATBOT_DPA_SKIP_DEV;
    process.env.NODE_ENV = 'development';
    process.env.CHATBOT_DPA_SKIP_DEV = 'true';
    expect(() => service.assertDpaAllowsProviderCall(undefined)).not.toThrow();
    process.env.NODE_ENV = prevNode;
    process.env.CHATBOT_DPA_SKIP_DEV = prevSkip;
  });
});
