import { BadRequestException, Injectable, Logger, NestMiddleware } from '@nestjs/common';

import type { TenantId } from '@enagar/types';
import type { NextFunction, Request, Response } from 'express';

/**
 * Rejects header-forged tenant context in production.
 *
 * Sprint 1.2 moves tenant resolution to the verified Keycloak JWT claim
 * inside `JwtAuthGuard`. The dev-only `X-Tenant-Code` escape hatch is kept
 * for local tooling, but it is explicitly disabled outside development.
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
    if (headerCode && process.env.NODE_ENV === 'production') {
      throw new BadRequestException('X-Tenant-Code is not accepted in production');
    }

    if (headerCode) {
      req.tenant = { id: 'tenant-stub' as TenantId, code: headerCode };
      this.log.debug(`tenant=${headerCode} (header-resolved, dev-only stub)`);
    }
    next();
  }
}
