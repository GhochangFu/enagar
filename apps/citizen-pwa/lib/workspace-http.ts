import type { ServiceSummary, TokenResponse } from './workspace-types';

export async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; error?: string };
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
    if (Array.isArray(body.message)) {
      return body.message.map((part) => String(part)).join('; ');
    }
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
  } catch {
    /* response body may not be JSON */
  }
  return `Request failed (${response.status})`;
}

export function authHeaders(token: TokenResponse, withJson = true): HeadersInit {
  return withJson
    ? {
        authorization: `Bearer ${token.access_token}`,
        'content-type': 'application/json',
      }
    : {
        authorization: `Bearer ${token.access_token}`,
      };
}

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100);
}

export function getFixedFeePaise(serviceList: ServiceSummary[], code: string): number | null {
  const svc = serviceList.find((entry) => entry.code === code);
  if (!svc || svc.fee_type !== 'fixed') {
    return null;
  }
  const raw = (svc.fee_config as { amount_paise?: unknown }).amount_paise;
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null;
}
