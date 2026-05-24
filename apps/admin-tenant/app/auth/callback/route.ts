import { NextResponse, type NextRequest } from 'next/server';

import { publicEnv } from '../../../lib/env/public-env';
import { keycloakTokenEndpoint } from '../../../lib/env/server-keycloak-env';
import { ADMIN_OAUTH_STORAGE_KEY } from '../../../lib/oauth/session-storage-keys';

export const dynamic = 'force-dynamic';

type TokenJson = {
  access_token?: string;
  expires_in?: number;
};

export async function GET(request: NextRequest): Promise<Response> {
  const search = request.nextUrl.searchParams;
  const error = search.get('error');
  const code = search.get('code');
  const { keycloakClientId, adminAppOrigin, apiBaseUrl } = publicEnv();
  const loginUrl = (queryError: string) =>
    new URL(`/login?error=${encodeURIComponent(queryError)}`, adminAppOrigin);

  if (error) {
    return NextResponse.redirect(loginUrl(error));
  }

  if (!code) {
    return NextResponse.redirect(loginUrl('missing_code'));
  }

  const verifier = request.cookies.get('admin_pkce_verifier')?.value;
  if (!verifier) {
    return NextResponse.redirect(loginUrl('pkce_missing'));
  }

  const redirectUri = `${adminAppOrigin}/auth/callback`;

  let tokenRes: Response;
  try {
    tokenRes = await fetch(keycloakTokenEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: keycloakClientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      }),
    });
  } catch {
    return NextResponse.redirect(loginUrl('token_exchange_failed'));
  }

  let raw: TokenJson;
  try {
    raw = (await tokenRes.json()) as TokenJson;
  } catch {
    return NextResponse.redirect(loginUrl('token_exchange_failed'));
  }

  if (!tokenRes.ok || !raw.access_token || typeof raw.expires_in !== 'number') {
    return NextResponse.redirect(loginUrl('token_exchange_failed'));
  }

  const expiresAt = Math.floor(Date.now() / 1000) + raw.expires_in;
  const payload = {
    access_token: raw.access_token,
    expires_at: expiresAt,
    api_base_url: apiBaseUrl,
  };
  const serialized = JSON.stringify(payload);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Signing in…</title></head>
<body>
<script>
  sessionStorage.setItem(${JSON.stringify(ADMIN_OAUTH_STORAGE_KEY)}, ${JSON.stringify(serialized)});
  window.location.replace('/dashboard');
</script>
<noscript>JavaScript required to finish sign-in.</noscript>
</body>
</html>`;

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

  response.cookies.delete('admin_pkce_verifier');

  return response;
}
