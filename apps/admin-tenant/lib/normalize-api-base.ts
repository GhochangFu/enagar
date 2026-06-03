/** Ensures tenant admin fetches target `/api` on the municipal API host. */
export function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return 'http://localhost:3001/api';
  }
  if (trimmed.endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}/api`;
}
