/** Server-only Keycloak token URL (OAuth callback). Prefer internal URL on demo VM. */
export function keycloakTokenEndpoint(): string {
  const issuer =
    process.env.KEYCLOAK_INTERNAL_ISSUER_URL?.trim() ||
    process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER_URL?.trim() ||
    'http://localhost:8080/realms/enagar';
  return `${issuer.replace(/\/$/, '')}/protocol/openid-connect/token`;
}
