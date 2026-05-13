import type { JWTPayload } from 'jose';

/**
 * Keycloak mappers should emit snake_case `tenant_id` / `tenant_code` (ADR-0009).
 * Some gateways or JSON templates emit camelCase synonyms; we accept either but
 * reject if both are present and disagree.
 */
export class JwtTenantClaimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtTenantClaimError';
  }
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @throws JwtTenantClaimError when claims are missing, empty, or contradictory
 */
export function resolveEnagarTenantFromJwtPayload(payload: JWTPayload): {
  tenantId: string;
  tenantCode?: string;
} {
  const c = payload as Record<string, unknown>;

  const fromSnakeId = trimString(c.tenant_id);
  const fromCamelId = trimString(c.tenantId);
  if (fromSnakeId && fromCamelId && fromSnakeId !== fromCamelId) {
    throw new JwtTenantClaimError('JWT tenant_id and tenantId claims conflict');
  }
  const tenantId = fromSnakeId || fromCamelId;
  if (!tenantId) {
    throw new JwtTenantClaimError('JWT is missing tenant_id');
  }

  const fromSnakeCode = trimString(c.tenant_code);
  const fromCamelCode = trimString(c.tenantCode);
  if (fromSnakeCode && fromCamelCode && fromSnakeCode !== fromCamelCode) {
    throw new JwtTenantClaimError('JWT tenant_code and tenantCode claims conflict');
  }
  const tenantCodeMerged = fromSnakeCode || fromCamelCode || undefined;

  return { tenantId, tenantCode: tenantCodeMerged };
}
