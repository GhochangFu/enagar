import { Injectable } from '@nestjs/common';

import { ApplicationsService } from '../applications/applications.service';
import { GrievancesService } from '../grievances/grievances.service';
import { PaymentsService } from '../payments/payments.service';
import { TenantsService } from '../tenants/tenants.service';

import type { CitizenHubDashboardResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { ApplicationReadScope } from '../applications/dto';

/**
 * Aggregated hub view for the citizen PWA — single round-trip for Sprint 2.2.
 * Respects the same hub vs workspace scope as underlying list APIs.
 */
@Injectable()
export class CitizenHubDashboardService {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly payments: PaymentsService,
    private readonly grievances: GrievancesService,
    private readonly tenants: TenantsService,
  ) {}

  async getDashboard(
    principal: AuthenticatedPrincipal,
    readScope?: ApplicationReadScope,
  ): Promise<CitizenHubDashboardResponse> {
    const [applicationSummaries, paymentRows, grievanceRows] = await Promise.all([
      this.applications.list(principal, readScope),
      this.payments.list(principal, readScope),
      this.grievances.list(principal, readScope),
    ]);

    const municipalities = this.tenants.list().map((tenant) => ({
      tenant_id: tenant.id,
      tenant_code: tenant.code,
      theme_color: tenant.theme_color,
      application_count: applicationSummaries.filter((row) => row.tenant_id === tenant.id).length,
      payment_count: paymentRows.filter((row) => row.tenant_id === tenant.id).length,
      grievance_count: grievanceRows.filter((row) => row.tenant_id === tenant.id).length,
    }));

    return {
      generated_at: new Date().toISOString(),
      municipality_scope: readScope?.municipalityTenantCode ?? null,
      municipalities,
    };
  }
}
