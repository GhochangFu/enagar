import { Module } from '@nestjs/common';

import { KeycloakAdminProvisionerService } from '../../common/keycloak/keycloak-admin-provisioner.service';
import { BookingsModule } from '../bookings/bookings.module';
import { FormImportModule } from '../form-import/form-import.module';
import { GrievancesModule } from '../grievances/grievances.module';
import { PaymentsModule } from '../payments/payments.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';

import { AdminTenantGrievanceConfigService } from './admin-tenant-grievance-config.service';
import { AdminTenantGrievanceGovernanceService } from './admin-tenant-grievance-governance.service';
import { AdminTenantOrgService } from './admin-tenant-org.service';
import { AdminTenantController } from './admin-tenant.controller';
import { AdminTenantService } from './admin-tenant.service';

@Module({
  imports: [BookingsModule, FormImportModule, GrievancesModule, PaymentsModule, WorkOrdersModule],
  controllers: [AdminTenantController],
  providers: [
    AdminTenantService,
    AdminTenantGrievanceConfigService,
    AdminTenantGrievanceGovernanceService,
    AdminTenantOrgService,
    KeycloakAdminProvisionerService,
  ],
  exports: [AdminTenantService],
})
export class AdminTenantModule {}
