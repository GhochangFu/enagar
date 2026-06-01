import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

import { DEFAULT_TENANT_ORG_IMPORT, parseTenantOrgImport } from './tenant-org-onboarding.data';
import { provisionTenantOrgFromImport } from './tenant-org-onboarding.provision';

import type { TenantOrgImport, TenantOrgProvisionResult } from './tenant-org-onboarding.types';

@Injectable()
export class TenantOrgOnboardingService {
  private readonly logger = new Logger(TenantOrgOnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  resolveDefaultImport(): TenantOrgImport {
    const configured = process.env.TENANT_ORG_IMPORT_PATH?.trim();
    if (!configured) {
      return DEFAULT_TENANT_ORG_IMPORT;
    }
    try {
      const absolute = resolve(configured);
      const parsed = parseTenantOrgImport(JSON.parse(readFileSync(absolute, 'utf8')));
      this.logger.log(`Loaded tenant org import from ${absolute}`);
      return parsed;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`TENANT_ORG_IMPORT_PATH failed (${detail}); using bundled default import`);
      return DEFAULT_TENANT_ORG_IMPORT;
    }
  }

  async provisionForTenant(
    tenantId: string,
    payload?: TenantOrgImport,
  ): Promise<TenantOrgProvisionResult> {
    return provisionTenantOrgFromImport(
      this.prisma,
      tenantId,
      payload ?? this.resolveDefaultImport(),
    );
  }
}
