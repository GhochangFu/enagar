import { NextResponse } from 'next/server';

import { publicEnv } from '../../../../lib/env/public-env';
import { ADMIN_OAUTH_STORAGE_KEY } from '../../../../lib/oauth/session-storage-keys';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const { keycloakIssuer, keycloakClientId, adminAppOrigin } = publicEnv();
  const postLogout = `${adminAppOrigin.replace(/\/$/, '')}/login`;
  const logoutUrl = new URL(`${keycloakIssuer.replace(/\/$/, '')}/protocol/openid-connect/logout`);
  logoutUrl.searchParams.set('client_id', keycloakClientId);
  logoutUrl.searchParams.set('post_logout_redirect_uri', postLogout);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Signing out…</title></head>
<body>
<script>
  sessionStorage.removeItem(${JSON.stringify(ADMIN_OAUTH_STORAGE_KEY)});
  window.location.replace(${JSON.stringify(logoutUrl.toString())});
</script>
<noscript>JavaScript required to finish sign-out.</noscript>
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
