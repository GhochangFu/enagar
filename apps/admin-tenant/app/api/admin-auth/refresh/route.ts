import { NextResponse } from 'next/server';

import { publicEnv } from '../../../../lib/env/public-env';
import { keycloakTokenEndpoint } from '../../../../lib/env/server-keycloak-env';

export const dynamic = 'force-dynamic';

type RefreshRequest = {
  refresh_token?: string;
};

type TokenJson = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
};

export async function POST(request: Request): Promise<Response> {
  let body: RefreshRequest;
  try {
    body = (await request.json()) as RefreshRequest;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const refreshToken = body.refresh_token?.trim();
  if (!refreshToken) {
    return NextResponse.json({ message: 'refresh_token is required' }, { status: 400 });
  }

  const { keycloakClientId, apiBaseUrl } = publicEnv();

  let tokenRes: Response;
  try {
    tokenRes = await fetch(keycloakTokenEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: keycloakClientId,
        refresh_token: refreshToken,
      }),
    });
  } catch {
    return NextResponse.json({ message: 'Token refresh failed' }, { status: 502 });
  }

  let raw: TokenJson;
  try {
    raw = (await tokenRes.json()) as TokenJson;
  } catch {
    return NextResponse.json({ message: 'Token refresh failed' }, { status: 502 });
  }

  if (!tokenRes.ok || !raw.access_token || typeof raw.expires_in !== 'number') {
    return NextResponse.json({ message: 'Token refresh rejected' }, { status: 401 });
  }

  return NextResponse.json({
    access_token: raw.access_token,
    expires_at: Math.floor(Date.now() / 1000) + raw.expires_in,
    refresh_token: raw.refresh_token ?? refreshToken,
    api_base_url: apiBaseUrl,
  });
}
