import { NextResponse } from 'next/server';

import { publicEnv } from '../../../../lib/env/public-env';
import { pkceChallengeS256, randomPkceVerifier } from '../../../../lib/oauth/pkce';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const { keycloakIssuer, keycloakClientId, adminAppOrigin } = publicEnv();
  const verifier = randomPkceVerifier();
  const challenge = pkceChallengeS256(verifier);
  const redirectUri = `${adminAppOrigin}/auth/callback`;

  const params = new URLSearchParams({
    client_id: keycloakClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `${keycloakIssuer.replace(/\/$/, '')}/protocol/openid-connect/auth?${params}`;
  const response = NextResponse.redirect(authUrl);

  response.cookies.set('admin_pkce_verifier', verifier, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
