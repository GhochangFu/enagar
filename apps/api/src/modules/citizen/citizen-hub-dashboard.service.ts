import { Injectable, Logger } from '@nestjs/common';

import { ApplicationsService } from '../applications/applications.service';
import { GrievancesService } from '../grievances/grievances.service';
import { PaymentsService } from '../payments/payments.service';
import { ServicesService } from '../services/services.service';
import { TenantsService } from '../tenants/tenants.service';

import type { CitizenHubDashboardResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { ApplicationReadScope } from '../applications/dto';

function countByTenantId(rows: readonly { tenant_id: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.tenant_id, (counts.get(row.tenant_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Aggregated hub view for the citizen PWA — fan-out: **3 parallel list calls** then
 * O(U + R) in-memory bucketing (catalogue size U, total rows R). **No per-ULB DB N+1**.
 * @see docs/runbooks/citizen-unified-hub.md
 */
@Injectable()
export class CitizenHubDashboardService {
  private readonly logger = new Logger(CitizenHubDashboardService.name);

  constructor(
    private readonly applications: ApplicationsService,
    private readonly payments: PaymentsService,
    private readonly grievances: GrievancesService,
    private readonly tenants: TenantsService,
    private readonly catalogue: ServicesService,
  ) {}

  async getDashboard(
    principal: AuthenticatedPrincipal,
    readScope?: ApplicationReadScope,
  ): Promise<CitizenHubDashboardResponse> {
    const started = performance.now();
    const [applicationSummaries, paymentRows, grievanceRows] = await Promise.all([
      this.applications.list(principal, readScope),
      this.payments.list(principal, readScope),
      this.grievances.list(principal, readScope),
    ]);

    const appCounts = countByTenantId(applicationSummaries);
    const paymentCounts = countByTenantId(paymentRows);
    const grievanceCounts = countByTenantId(grievanceRows);

    const municipalities = this.tenants.list().map((tenant) => ({
      tenant_id: tenant.id,
      tenant_code: tenant.code,
      theme_color: tenant.theme_color,
      application_count: appCounts.get(tenant.id) ?? 0,
      payment_count: paymentCounts.get(tenant.id) ?? 0,
      grievance_count: grievanceCounts.get(tenant.id) ?? 0,
    }));

    const distinctActiveServiceCount =
      this.catalogue.distinctActiveServiceCodesAcrossMunicipalities();
    const durationMs = Math.round((performance.now() - started) * 1000) / 1000;
    /** Structured hub metric — searchable in logs as `citizen_hub_dashboard`. */
    this.logger.log({
      citizen_hub_dashboard: true,
      municipality_scope: readScope?.municipalityTenantCode ?? null,
      jwt_tenant_code: principal.tenantCode ?? null,
      ulb_catalogue_rows: municipalities.length,
      application_rows: applicationSummaries.length,
      payment_rows: paymentRows.length,
      grievance_rows: grievanceRows.length,
      distinct_active_service_codes: distinctActiveServiceCount,
      duration_ms: durationMs,
    });

    return {
      generated_at: new Date().toISOString(),
      municipality_scope: readScope?.municipalityTenantCode ?? null,
      municipalities,
      distinct_active_service_codes: distinctActiveServiceCount,
    };
  }
}
