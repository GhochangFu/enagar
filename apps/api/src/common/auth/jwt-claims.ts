import type { TenantId } from '@enagar/types';

export interface EnagarJwtClaims {
  sub: string;
  iss: string;
  aud?: string | string[];
  exp: number;
  iat?: number;
  jti?: string;
  /** Preferred mapper output per ADR-0009 — synonym {@link tenantId} */
  tenant_id?: TenantId;
  /** Non-standard synonym accepted by {@link JwtVerifierService} alongside `tenant_id` */
  tenantId?: TenantId;
  tenant_code?: string;
  tenantCode?: string;
  role?: string | string[];
  ward_id?: string;
  acr?: string;
  amr?: string[];
  realm_access?: {
    roles?: string[];
  };
  resource_access?: Record<string, { roles?: string[] }>;
}

export interface AuthenticatedPrincipal {
  subject: string;
  tenantId: TenantId;
  tenantCode?: string;
  roles: string[];
  wardId?: string;
  tokenId?: string;
  expiresAt: Date;
}
