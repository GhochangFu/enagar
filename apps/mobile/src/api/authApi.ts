/** Public auth endpoints aligned with `{@link apps/api AuthController}`. */

export type TokenResponseShape = {
  access_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  refresh_token?: string;
  token_type: string;
  id_token?: string;
  scope?: string;
};

export async function sendOtp(
  apiRoot: string,
  mobile: string,
  tenant_code?: string,
): Promise<{ status: string }> {
  const base = apiRoot.replace(/\/$/, '');
  const response = await fetch(`${base}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mobile,
      ...(tenant_code && tenant_code.length > 0 ? { tenant_code } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`send-otp failed (${response.status})`);
  }

  return (await response.json()) as { status: string };
}

export async function verifyOtp(
  apiRoot: string,
  mobile: string,
  otp: string,
  tenant_code?: string,
): Promise<TokenResponseShape> {
  const base = apiRoot.replace(/\/$/, '');
  const response = await fetch(`${base}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mobile,
      otp,
      ...(tenant_code && tenant_code.length > 0 ? { tenant_code } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`verify-otp failed (${response.status})`);
  }

  return (await response.json()) as TokenResponseShape;
}
