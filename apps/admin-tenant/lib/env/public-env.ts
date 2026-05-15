export function publicEnv(): {
  keycloakIssuer: string;
  keycloakClientId: string;
  adminAppOrigin: string;
  apiBaseUrl: string;
} {
  const keycloakIssuer =
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER_URL ?? 'http://localhost:8080/realms/enagar';
  const keycloakClientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'admin-tenant';
  const adminAppOrigin = process.env.NEXT_PUBLIC_ADMIN_APP_ORIGIN ?? 'http://localhost:3002';
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

  return { keycloakIssuer, keycloakClientId, adminAppOrigin, apiBaseUrl };
}
