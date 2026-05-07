import type { TenantId } from '@enagar/types';

export interface EnagarJwtClaims {
  sub: string;
  iss: string;
  aud?: string | string[];
  exp: number;
  iat?: number;
  jti?: string;
  tenant_id: TenantId;
  tenant_code?: string;
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
