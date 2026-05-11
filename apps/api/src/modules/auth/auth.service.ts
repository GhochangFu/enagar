import { randomUUID } from 'node:crypto';

import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT } from 'jose';

import {
  CITIZEN_PORTAL_TENANT_CODE,
  CITIZEN_PORTAL_TENANT_ID,
  tenantSeeds,
} from '../tenants/tenant.seed';

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
    const payload = this.normalizedOtpPayload(dto);
    if (this.otpEndpoint) {
      await this.postJson(this.otpEndpoint, payload);
    }

    return {
      status: 'otp_requested',
      challenge_id: randomUUID(),
      expires_in_seconds: 300,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<TokenResponse> {
    if (this.devAuthEnabled && dto.otp === this.devOtpCode) {
      return this.createDevCitizenAccessToken(dto.mobile);
    }
    if (this.devAuthEnabled) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const { mobile, tenant_code, otp } = dto;
    const normalizedTenant = tenant_code?.trim() || CITIZEN_PORTAL_TENANT_CODE;

    return this.postForm<TokenResponse>(this.tokenEndpoint, {
      grant_type: 'password',
      client_id: this.citizenClientId,
      username: `${normalizedTenant}:${mobile}`,
      password: otp,
      scope: 'openid profile tenant-claims',
    });
  }

  /** Dev / Keycloak Option A: portal tenant claims + stable subject per mobile. */
  private async createDevCitizenAccessToken(mobile: string): Promise<TokenResponse> {
    const tenantId = this.resolvePortalTenantId();
    const expiresIn = 15 * 60;
    const accessToken = await new SignJWT({
      tenant_id: tenantId,
      tenant_code: CITIZEN_PORTAL_TENANT_CODE,
      role: ['citizen'],
      amr: ['otp'],
      mobile,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setSubject(`dev-citizen-${mobile}`)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .sign(this.devJwtSecret);

    const refreshToken = `dev-refresh-${mobile}-${randomUUID()}`;

    return {
      access_token: accessToken,
      expires_in: expiresIn,
      refresh_expires_in: 24 * 60 * 60,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      scope: 'openid profile tenant-claims',
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<TokenResponse> {
    if (this.devAuthEnabled) {
      const mobile = this.parseDevRefreshMobile(dto.refresh_token);
      return this.createDevCitizenAccessToken(mobile);
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

  private normalizedOtpPayload(dto: SendOtpDto): { tenant_code: string; mobile: string } {
    return {
      tenant_code: dto.tenant_code?.trim() || CITIZEN_PORTAL_TENANT_CODE,
      mobile: dto.mobile,
    };
  }

  private resolvePortalTenantId(): string {
    const portal = tenantSeeds.find((candidate) => candidate.code === CITIZEN_PORTAL_TENANT_CODE);
    return portal?.id ?? CITIZEN_PORTAL_TENANT_ID;
  }

  /** dev-refresh-{mobile}-{uuid} — legacy `dev-refresh-{uuid}` is rejected (re-OTP). */
  private parseDevRefreshMobile(refreshToken: string): string {
    const prefix = 'dev-refresh-';
    if (!refreshToken.startsWith(prefix)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const rest = refreshToken.slice(prefix.length);
    const match = /^([6-9]\d{9})-(.+)/.exec(rest);
    if (!match || !match[1]) {
      throw new UnauthorizedException('Invalid or legacy refresh token; sign in again with OTP');
    }
    return match[1];
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
