import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const verifierPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'common',
  'auth',
  'jwt-verifier.service.ts',
);
const tenantResolverPath = join(
  repoRoot,
  'apps',
  'api',
  'src',
  'common',
  'auth',
  'enagar-jwt-tenant-resolver.ts',
);
const guardPath = join(repoRoot, 'apps', 'api', 'src', 'common', 'auth', 'jwt-auth.guard.ts');
const appModulePath = join(repoRoot, 'apps', 'api', 'src', 'app.module.ts');
const authServicePath = join(repoRoot, 'apps', 'api', 'src', 'modules', 'auth', 'auth.service.ts');

describe('Sprint 1.2 API JWT tenant-binding contract', () => {
  const verifierSource = readFileSync(verifierPath, 'utf8');
  const tenantResolverSource = readFileSync(tenantResolverPath, 'utf8');
  const guardSource = readFileSync(guardPath, 'utf8');
  const appModuleSource = readFileSync(appModulePath, 'utf8');
  const authServiceSource = readFileSync(authServicePath, 'utf8');

  it('verifies Keycloak JWT issuer and API audience', () => {
    expect(verifierSource).toContain('KEYCLOAK_ISSUER_URL');
    expect(verifierSource).toContain('KEYCLOAK_JWKS_URL');
    expect(verifierSource).toContain('KEYCLOAK_API_AUDIENCE');
    expect(verifierSource).toContain('issuer: this.issuer');
    expect(verifierSource).toContain('jwtAudienceOption');
    expect(verifierSource).toContain('audience: this.jwtAudienceOption()');
  });

  it('caches JWKS for five minutes', () => {
    expect(verifierSource).toContain('cacheMaxAge: 5 * 60 * 1000');
  });

  it('normalizes tenant_id vs tenantId (and tenant_code synonyms) via shared resolver', () => {
    expect(tenantResolverSource).toContain('resolveEnagarTenantFromJwtPayload');
    expect(tenantResolverSource).toContain('tenant_id and tenantId claims conflict');
    expect(verifierSource).toContain('resolveEnagarTenantFromJwtPayload');
    expect(tenantResolverSource).toContain('JWT is missing tenant_id');
  });

  it('binds verified JWT tenant context onto the request', () => {
    expect(guardSource).toContain('request.auth = principal');
    expect(guardSource).toContain('request.tenant =');
    expect(guardSource).toContain('id: principal.tenantId');
  });

  it('uses JWT auth as a global API guard', () => {
    expect(appModuleSource).toContain('APP_GUARD');
    expect(appModuleSource).toContain('useClass: JwtAuthGuard');
  });

  it('keeps local OTP bypass dev-only and disabled in production', () => {
    expect(authServiceSource).toContain("process.env.NODE_ENV !== 'production'");
    expect(authServiceSource).toContain('DEV_AUTH_ENABLED');
    expect(authServiceSource).toContain('DEV_OTP_CODE');
    expect(authServiceSource).toContain('createDevCitizenAccessToken');
  });

  it('requires MFA evidence for admin-role JWTs', () => {
    expect(verifierSource).toContain('requiresMfa');
    expect(verifierSource).toContain("role === 'tenant_admin' || role === 'state_admin'");
    expect(verifierSource).toContain("value === 'otp' || value === 'totp' || value === 'mfa'");
    expect(verifierSource).toContain('acrLevel >= 2');
    expect(verifierSource).toContain('allowsLocalDummyAdminMfaBypass');
    expect(verifierSource).toContain("process.env.NODE_ENV === 'production'");
    expect(verifierSource).toContain('Admin role requires MFA');
  });
});
