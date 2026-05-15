import { NextResponse, type NextRequest } from 'next/server';

import { publicEnv } from '../../../lib/env/public-env';
import { STATE_OAUTH_STORAGE_KEY } from '../../../lib/oauth/session-storage-keys';

export const dynamic = 'force-dynamic';

type TokenJson = {
  access_token?: string;
  expires_in?: number;
};

export async function GET(request: NextRequest): Promise<Response> {
  const error = request.nextUrl.searchParams.get('error');
  const code = request.nextUrl.searchParams.get('code');
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }
  const verifier = request.cookies.get('state_pkce_verifier')?.value;
  if (!verifier) {
    return NextResponse.redirect(new URL('/login?error=pkce_missing', request.url));
  }

  const { keycloakIssuer, keycloakClientId, stateAppOrigin, apiBaseUrl } = publicEnv();
  const tokenRes = await fetch(
    `${keycloakIssuer.replace(/\/$/, '')}/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: keycloakClientId,
        redirect_uri: `${stateAppOrigin}/auth/callback`,
        code,
        code_verifier: verifier,
      }),
    },
  );
  const raw = (await tokenRes.json()) as TokenJson;
  if (!tokenRes.ok || !raw.access_token || typeof raw.expires_in !== 'number') {
    return NextResponse.redirect(new URL('/login?error=token_exchange_failed', request.url));
  }

  const serialized = JSON.stringify({
    access_token: raw.access_token,
    expires_at: Math.floor(Date.now() / 1000) + raw.expires_in,
    api_base_url: apiBaseUrl,
  });
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Signing in...</title></head>
<body>
<script>
  sessionStorage.setItem(${JSON.stringify(STATE_OAUTH_STORAGE_KEY)}, ${JSON.stringify(serialized)});
  window.location.replace('/dashboard');
</script>
<noscript>JavaScript required to finish sign-in.</noscript>
</body>
</html>`;
  const response = new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
  response.cookies.delete('state_pkce_verifier');
  return response;
}
