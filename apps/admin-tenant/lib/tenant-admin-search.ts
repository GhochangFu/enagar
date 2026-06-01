export type TenantAdminSearchHit =
  | { kind: 'docket'; docketNo: string }
  | { kind: 'grievance'; id: string }
  | { kind: 'service'; serviceId: string };

type SearchContext = {
  apiBase: string;
  token: string;
  isAdmin: boolean;
};

type GrievanceListItem = {
  id: string;
  grievance_no: string;
};

type ServiceListItem = {
  id: string;
  code: string;
  name: unknown;
};

function authHeaders(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

function pickLabel(json: unknown): string {
  if (typeof json === 'string') {
    return json;
  }
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const rec = json as Record<string, unknown>;
    for (const key of ['en', 'bn', 'hi']) {
      const value = rec[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
    const first = Object.values(rec).find((entry) => typeof entry === 'string' && entry.trim());
    if (typeof first === 'string') {
      return first;
    }
  }
  return '';
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function tryDocket(query: string, ctx: SearchContext): Promise<TenantAdminSearchHit | null> {
  const res = await fetch(
    `${ctx.apiBase}/admin/tenant/desk/applications/${encodeURIComponent(query)}`,
    { cache: 'no-store', headers: authHeaders(ctx.token) },
  );
  if (res.ok) {
    return { kind: 'docket', docketNo: query };
  }
  return null;
}

async function tryGrievanceById(
  id: string,
  ctx: SearchContext,
): Promise<TenantAdminSearchHit | null> {
  const res = await fetch(`${ctx.apiBase}/admin/tenant/desk/grievances/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    headers: authHeaders(ctx.token),
  });
  if (res.ok) {
    return { kind: 'grievance', id };
  }
  return null;
}

async function tryGrievanceByNumber(
  query: string,
  ctx: SearchContext,
): Promise<TenantAdminSearchHit | null> {
  const queues = ctx.isAdmin ? (['my', 'all'] as const) : (['my'] as const);
  const normalized = query.toLowerCase();
  const seen = new Set<string>();

  for (const queue of queues) {
    const res = await fetch(`${ctx.apiBase}/admin/tenant/desk/inbox/grievances?queue=${queue}`, {
      cache: 'no-store',
      headers: authHeaders(ctx.token),
    });
    if (!res.ok) {
      continue;
    }
    const rows = (await res.json()) as GrievanceListItem[];
    for (const row of rows) {
      if (seen.has(row.id)) {
        continue;
      }
      seen.add(row.id);
      if (row.grievance_no.toLowerCase() === normalized) {
        return { kind: 'grievance', id: row.id };
      }
    }
  }

  return null;
}

async function tryService(query: string, ctx: SearchContext): Promise<TenantAdminSearchHit | null> {
  if (!ctx.isAdmin) {
    return null;
  }
  const res = await fetch(`${ctx.apiBase}/admin/tenant/services`, {
    cache: 'no-store',
    headers: authHeaders(ctx.token),
  });
  if (!res.ok) {
    return null;
  }
  const rows = (await res.json()) as ServiceListItem[];
  const normalized = query.toLowerCase();
  const exactCode = rows.find((row) => row.code.toLowerCase() === normalized);
  if (exactCode) {
    return { kind: 'service', serviceId: exactCode.id };
  }
  const byName = rows.find((row) => pickLabel(row.name).toLowerCase().includes(normalized));
  if (byName) {
    return { kind: 'service', serviceId: byName.id };
  }
  return null;
}

export async function resolveTenantAdminSearch(
  rawQuery: string,
  ctx: SearchContext,
): Promise<TenantAdminSearchHit | null> {
  const query = rawQuery.trim();
  if (!query) {
    return null;
  }

  const docketHit = await tryDocket(query, ctx);
  if (docketHit) {
    return docketHit;
  }

  if (isUuid(query)) {
    const grievanceHit = await tryGrievanceById(query, ctx);
    if (grievanceHit) {
      return grievanceHit;
    }
  }

  const grievanceNumberHit = await tryGrievanceByNumber(query, ctx);
  if (grievanceNumberHit) {
    return grievanceNumberHit;
  }

  return tryService(query, ctx);
}

export function tenantAdminSearchHref(hit: TenantAdminSearchHit): string {
  if (hit.kind === 'docket') {
    return `/dashboard/desk?docket=${encodeURIComponent(hit.docketNo)}`;
  }
  if (hit.kind === 'grievance') {
    return `/dashboard/desk?grievance=${encodeURIComponent(hit.id)}`;
  }
  return `/dashboard/services/${hit.serviceId}`;
}
