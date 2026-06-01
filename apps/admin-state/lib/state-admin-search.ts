export type StateAdminSearchHit =
  | { kind: 'tenant'; code: string }
  | { kind: 'library'; code: string }
  | { kind: 'audit_actor'; actor: string };

type TenantListItem = { code: string; name: string };
type LibraryListItem = { code: string; name?: unknown };

function pickLabel(json: unknown): string {
  if (typeof json === 'string') return json;
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    const rec = json as Record<string, unknown>;
    for (const key of ['en', 'bn', 'hi']) {
      const value = rec[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
  }
  return '';
}

export function resolveStateAdminSearch(
  rawQuery: string,
  ctx: {
    tenants: TenantListItem[];
    library: LibraryListItem[];
  },
): StateAdminSearchHit | null {
  const query = rawQuery.trim();
  if (!query) return null;

  const normalized = query.toLowerCase();

  const tenantByCode = ctx.tenants.find((row) => row.code.toLowerCase() === normalized);
  if (tenantByCode) return { kind: 'tenant', code: tenantByCode.code };

  const tenantByName = ctx.tenants.find((row) => row.name.toLowerCase().includes(normalized));
  if (tenantByName) return { kind: 'tenant', code: tenantByName.code };

  const libraryByCode = ctx.library.find((row) => row.code.toLowerCase() === normalized);
  if (libraryByCode) return { kind: 'library', code: libraryByCode.code };

  const libraryByName = ctx.library.find((row) =>
    pickLabel(row.name).toLowerCase().includes(normalized),
  );
  if (libraryByName) return { kind: 'library', code: libraryByName.code };

  if (query.includes('@') || normalized.includes('admin')) {
    return { kind: 'audit_actor', actor: query };
  }

  return null;
}
