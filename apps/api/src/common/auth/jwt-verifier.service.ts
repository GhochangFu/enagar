import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import {
  JwtTenantClaimError,
  resolveEnagarTenantFromJwtPayload,
} from './enagar-jwt-tenant-resolver';

import type { AuthenticatedPrincipal, EnagarJwtClaims } from './jwt-claims';

@Injectable()
export class JwtVerifierService {
  private readonly issuer: string;
  /** Acceptable JWT `aud` values (comma-separated in `KEYCLOAK_API_AUDIENCE`). */
  private readonly audience: string[];
  private readonly devAuthEnabled: boolean;
  private readonly devJwtSecret: Uint8Array;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {
    this.issuer =
      this.config.get<string>('KEYCLOAK_ISSUER_URL') ?? 'http://localhost:8080/realms/enagar';
    const rawAudience = this.config.get<string>('KEYCLOAK_API_AUDIENCE') ?? 'enagar-api';
    this.audience = rawAudience
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (this.audience.length === 0) {
      this.audience.push('enagar-api');
    }
    this.devAuthEnabled =
      process.env.NODE_ENV !== 'production' &&
      this.config.get<string>('DEV_AUTH_ENABLED') !== 'false';
    this.devJwtSecret = new TextEncoder().encode(
      this.config.get<string>('DEV_JWT_SECRET') ?? 'enagarseba-dev-only-secret-change-me',
    );
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/protocol/openid-connect/certs`), {
      cacheMaxAge: 5 * 60 * 1000,
    });
  }

  private jwtAudienceOption(): string | string[] {
    return this.audience.length === 1 ? this.audience[0]! : this.audience;
  }

  async verifyBearerToken(token: string): Promise<AuthenticatedPrincipal> {
    try {
      const payload = await this.verifyJwt(token);

      return this.toPrincipal(payload);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const hint =
        process.env.NODE_ENV !== 'production' && error instanceof Error ? `: ${error.message}` : '';
      throw new UnauthorizedException(`Invalid or expired access token${hint}`, { cause: error });
    }
  }

  private async verifyJwt(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.jwtAudienceOption(),
      });
      return payload;
    } catch (remoteError) {
      if (!this.devAuthEnabled) {
        throw remoteError;
      }

      const { payload } = await jwtVerify(token, this.devJwtSecret, {
        issuer: this.issuer,
        audience: this.jwtAudienceOption(),
      });
      return payload;
    }
  }

  private toPrincipal(payload: JWTPayload): AuthenticatedPrincipal {
    const claims = payload as unknown as EnagarJwtClaims;

    if (!claims.sub) {
      throw new UnauthorizedException('JWT is missing sub');
    }

    let tenantIdResolved: string;
    let tenantCodeResolved: string | undefined;
    try {
      ({ tenantId: tenantIdResolved, tenantCode: tenantCodeResolved } =
        resolveEnagarTenantFromJwtPayload(payload));
    } catch (error) {
      if (error instanceof JwtTenantClaimError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }

    if (!claims.exp) {
      throw new UnauthorizedException('JWT is missing exp');
    }

    const roles = this.extractRoles(claims);
    if (
      this.requiresMfa(roles) &&
      !this.hasMfa(claims) &&
      !this.allowsLocalDummyAdminMfaBypass(claims, roles)
    ) {
      throw new UnauthorizedException('Admin role requires MFA');
    }

    return {
      subject: claims.sub,
      tenantId: tenantIdResolved,
      tenantCode: tenantCodeResolved,
      roles,
      wardId: claims.ward_id,
      tokenId: claims.jti,
      expiresAt: new Date(claims.exp * 1000),
    };
  }

  private extractRoles(claims: EnagarJwtClaims): string[] {
    const explicitRoles = Array.isArray(claims.role)
      ? claims.role
      : claims.role
        ? [claims.role]
        : [];
    const realmRoles = claims.realm_access?.roles ?? [];
    const resourceRoles = Object.values(claims.resource_access ?? {}).flatMap(
      (resource) => resource.roles ?? [],
    );

    return Array.from(new Set([...explicitRoles, ...realmRoles, ...resourceRoles])).sort();
  }

  private requiresMfa(roles: string[]): boolean {
    return roles.some((role) => role === 'tenant_admin' || role === 'state_admin');
  }

  private allowsLocalDummyAdminMfaBypass(claims: EnagarJwtClaims, roles: string[]): boolean {
    if (!this.devAuthEnabled || process.env.NODE_ENV === 'production') {
      return false;
    }
    if (!this.requiresMfa(roles)) {
      return false;
    }
    return /^([a-z0-9]+-)?(tenant|state)-admin-dummy$/i.test(claims.sub);
  }

  private hasMfa(claims: EnagarJwtClaims): boolean {
    if (claims.acr === 'mfa') {
      return true;
    }
    const amr = this.normalizeAmr(claims.amr);
    if (amr.some((value) => value === 'otp' || value === 'totp' || value === 'mfa')) {
      return true;
    }
    // Keycloak step-up auth maps LoA to acr (often "2" after password + OTP).
    const acrLevel = Number(claims.acr);
    return !Number.isNaN(acrLevel) && acrLevel >= 2;
  }

  private normalizeAmr(amr: EnagarJwtClaims['amr']): string[] {
    if (Array.isArray(amr)) {
      return amr.map((value) => String(value));
    }
    if (typeof amr === 'string' && amr.length > 0) {
      return [amr];
    }
    return [];
  }
}
