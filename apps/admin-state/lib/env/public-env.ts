export function publicEnv(): {
  keycloakIssuer: string;
  keycloakClientId: string;
  stateAppOrigin: string;
  apiBaseUrl: string;
} {
  const keycloakIssuer =
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER_URL ?? 'http://localhost:8080/realms/enagar';
  const keycloakClientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'admin-state';
  const stateAppOrigin = process.env.NEXT_PUBLIC_STATE_APP_ORIGIN ?? 'http://localhost:3003';
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

  return { keycloakIssuer, keycloakClientId, stateAppOrigin, apiBaseUrl };
}
