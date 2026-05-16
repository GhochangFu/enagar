import { NextResponse } from 'next/server';

import { publicEnv } from '../../../../lib/env/public-env';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const { keycloakIssuer, keycloakClientId, stateAppOrigin } = publicEnv();
  const postLogout = `${stateAppOrigin}/login`;
  const logoutUrl = new URL(`${keycloakIssuer.replace(/\/$/, '')}/protocol/openid-connect/logout`);
  logoutUrl.searchParams.set('client_id', keycloakClientId);
  logoutUrl.searchParams.set('post_logout_redirect_uri', postLogout);

  const response = NextResponse.redirect(logoutUrl);
  response.cookies.delete('state_pkce_verifier');
  return response;
}
