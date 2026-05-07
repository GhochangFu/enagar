import { randomUUID } from 'node:crypto';

import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';

import { tenantSeeds } from '../tenants/tenant.seed';

import type {
  AadhaarLinkDto,
  LogoutDto,
  OtpChallengeResponse,
  RefreshTokenDto,
  TokenResponse,
  SendOtpDto,
  VerifyOtpDto,
} from './dto';

@Injectable()
export class AuthService {
  private readonly citizenClientId: string;
  private readonly devAuthEnabled: boolean;
  private readonly devJwtSecret: Uint8Array;
  private readonly devOtpCode: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly otpEndpoint?: string;
  private readonly tokenEndpoint: string;
  private readonly logoutEndpoint: string;

  constructor(private readonly config: ConfigService) {
    this.issuer =
      this.config.get<string>('KEYCLOAK_ISSUER_URL') ?? 'http://localhost:8080/realms/enagar';
    this.audience = this.config.get<string>('KEYCLOAK_API_AUDIENCE') ?? 'enagar-api';
    this.devAuthEnabled =
      process.env.NODE_ENV !== 'production' &&
      this.config.get<string>('DEV_AUTH_ENABLED') !== 'false';
    this.devJwtSecret = new TextEncoder().encode(
      this.config.get<string>('DEV_JWT_SECRET') ?? 'enagarseba-dev-only-secret-change-me',
    );
    this.devOtpCode = this.config.get<string>('DEV_OTP_CODE') ?? '12345';

    this.citizenClientId = this.config.get<string>('KEYCLOAK_CITIZEN_CLIENT_ID') ?? 'citizen-pwa';
    this.otpEndpoint = this.config.get<string>('KEYCLOAK_OTP_ENDPOINT') || undefined;
    this.tokenEndpoint =
      this.config.get<string>('KEYCLOAK_TOKEN_ENDPOINT') ??
      `${this.issuer}/protocol/openid-connect/token`;
    this.logoutEndpoint =
      this.config.get<string>('KEYCLOAK_LOGOUT_ENDPOINT') ??
      `${this.issuer}/protocol/openid-connect/logout`;
  }

  async sendOtp(dto: SendOtpDto): Promise<OtpChallengeResponse> {
    if (this.otpEndpoint) {
      await this.postJson(this.otpEndpoint, dto);
    }

    return {
      status: 'otp_requested',
      challenge_id: randomUUID(),
      expires_in_seconds: 300,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<TokenResponse> {
    if (this.devAuthEnabled && dto.otp === this.devOtpCode) {
      return this.createDevToken(dto);
    }
    if (this.devAuthEnabled) {
      throw new UnauthorizedException('Invalid OTP');
    }

    return this.postForm<TokenResponse>(this.tokenEndpoint, {
      grant_type: 'password',
      client_id: this.citizenClientId,
      username: `${dto.tenant_code}:${dto.mobile}`,
      password: dto.otp,
      scope: 'openid profile tenant-claims',
    });
  }

  private async createDevToken(dto: VerifyOtpDto): Promise<TokenResponse> {
    const tenant = tenantSeeds.find((candidate) => candidate.code === dto.tenant_code);
    const tenantId = tenant?.id ?? '11111111-1111-4111-8111-111111111111';
    const expiresIn = 15 * 60;
    const accessToken = await new SignJWT({
      tenant_id: tenantId,
      tenant_code: dto.tenant_code,
      role: ['citizen'],
      amr: ['otp'],
      mobile: dto.mobile,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setSubject(`dev-citizen-${dto.tenant_code}-${dto.mobile}`)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(this.devJwtSecret);

    return {
      access_token: accessToken,
      expires_in: expiresIn,
      refresh_expires_in: 24 * 60 * 60,
      refresh_token: `dev-refresh-${randomUUID()}`,
      token_type: 'Bearer',
      scope: 'openid profile tenant-claims',
    };
  }

  refresh(dto: RefreshTokenDto): Promise<TokenResponse> {
    if (this.devAuthEnabled) {
      if (!dto.refresh_token.startsWith('dev-refresh-')) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.createDevToken({
        tenant_code: 'KMC',
        mobile: '9876543210',
        otp: this.devOtpCode,
      });
    }

    return this.postForm<TokenResponse>(this.tokenEndpoint, {
      grant_type: 'refresh_token',
      client_id: this.citizenClientId,
      refresh_token: dto.refresh_token,
    });
  }

  async logout(dto: LogoutDto): Promise<{ status: 'logged_out' }> {
    if (this.devAuthEnabled) {
      return { status: 'logged_out' };
    }

    await this.postForm(this.logoutEndpoint, {
      client_id: this.citizenClientId,
      refresh_token: dto.refresh_token,
    });

    return { status: 'logged_out' };
  }

  aadhaarLink(_dto: AadhaarLinkDto): { status: 'digilocker_broker_pending' } {
    return { status: 'digilocker_broker_pending' };
  }

  private async postJson(endpoint: string, body: unknown): Promise<void> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('Keycloak OTP endpoint rejected the request');
    }
  }

  private async postForm<TResponse = unknown>(
    endpoint: string,
    fields: Record<string, string>,
  ): Promise<TResponse> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('Keycloak token endpoint rejected the request');
    }

    return (await response.json()) as TResponse;
  }
}
