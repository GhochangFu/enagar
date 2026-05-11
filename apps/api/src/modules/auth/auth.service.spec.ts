import { randomUUID } from 'node:crypto';

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CITIZEN_PORTAL_TENANT_CODE, CITIZEN_PORTAL_TENANT_ID } from '../tenants/tenant.seed';

import { AuthService } from './auth.service';

import type { VerifyOtpDto } from './dto';

jest.mock(
  'jose',
  () => {
    class SignJWT {
      private readonly payload: Record<string, unknown>;

      constructor(body: Record<string, unknown>) {
        this.payload = { ...body };
      }

      setProtectedHeader(): this {
        return this;
      }

      setIssuer(): this {
        return this;
      }

      setAudience(): this {
        return this;
      }

      setSubject(subject: string): this {
        this.payload.sub = subject;
        return this;
      }

      setJti(): this {
        return this;
      }

      setIssuedAt(): this {
        return this;
      }

      setExpirationTime(): this {
        return this;
      }

      async sign(): Promise<string> {
        const encoded = Buffer.from(JSON.stringify(this.payload)).toString('base64url');
        return `e30.${encoded}.e30`;
      }
    }

    return { SignJWT };
  },
  { virtual: false },
);

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  const payloadPart = parts[1];
  if (!payloadPart) {
    throw new Error('Invalid JWT payload segment');
  }
  return JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

describe('AuthService (dev citizen / Option A)', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'development';
    service = new AuthService({
      get: jest.fn((_key?: string, defaultVal?: unknown) => defaultVal ?? undefined),
    } as unknown as ConfigService);
  });

  it('verifyOtp issues portal JWT with stable sub regardless of dto tenant_code hint', async () => {
    const tokens = await service.verifyOtp({
      tenant_code: 'KMC',
      mobile: '9876543210',
      otp: '12345',
    } as VerifyOtpDto);

    const payload = decodeJwtPayload(tokens.access_token);

    expect(payload.sub).toBe('dev-citizen-9876543210');
    expect(payload.tenant_id).toBe(CITIZEN_PORTAL_TENANT_ID);
    expect(payload.tenant_code).toBe(CITIZEN_PORTAL_TENANT_CODE);

    expect(tokens.refresh_token?.startsWith('dev-refresh-9876543210-')).toBe(true);
  });

  it('two verifyOtp calls for the same mobile yield the same subject', async () => {
    const first = await service.verifyOtp({ mobile: '9123456789', otp: '12345' } as VerifyOtpDto);
    const second = await service.verifyOtp({ mobile: '9123456789', otp: '12345' } as VerifyOtpDto);
    expect(decodeJwtPayload(first.access_token).sub).toBe('dev-citizen-9123456789');
    expect(decodeJwtPayload(second.access_token).sub).toBe('dev-citizen-9123456789');
  });

  it('refresh (dev) re-issues the same subject from embedded mobile', async () => {
    const primary = await service.verifyOtp({
      mobile: '9123456789',
      otp: '12345',
    } as VerifyOtpDto);

    const refreshed = await service.refresh({ refresh_token: primary.refresh_token! });
    const payload = decodeJwtPayload(refreshed.access_token);

    expect(payload.sub).toBe('dev-citizen-9123456789');
  });

  it('reject legacy dev refresh tokens without embedded mobile', async () => {
    await expect(
      service.refresh({ refresh_token: `dev-refresh-${randomUUID()}` }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
