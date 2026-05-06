import { Injectable, Logger, NestMiddleware } from '@nestjs/common';

import type { TenantId } from '@enagar/types';
import type { NextFunction, Request, Response } from 'express';

/**
 * Phase-0 placeholder. Resolves the tenant for an incoming request and
 * stows it on `req.tenant` so downstream guards / Prisma middleware can
 * apply RLS scoping (`SET LOCAL app.tenant_id`).
 *
 * Resolution order (will be fleshed out in Phase 1):
 *   1. JWT claim `tenant_id` (Keycloak)
 *   2. `X-Tenant-Code` header (admin tooling, dev)
 *   3. Subdomain (`kmc.enagar.gov.in` → `kmc`)
 *
 * For now we attach a dummy tenant only when explicitly provided so
 * health probes and Swagger work without auth.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly log = new Logger(TenantContextMiddleware.name);

  use(
    req: Request & { tenant?: { id: TenantId; code: string } },
    _res: Response,
    next: NextFunction,
  ): void {
    const headerCode = req.header('x-tenant-code');
    if (headerCode) {
      req.tenant = { id: 'tenant-stub' as TenantId, code: headerCode };
      this.log.debug(`tenant=${headerCode} (header-resolved, stub)`);
    }
    next();
  }
}
