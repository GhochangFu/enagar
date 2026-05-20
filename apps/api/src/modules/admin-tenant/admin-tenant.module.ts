import { Module } from '@nestjs/common';

import { GrievancesModule } from '../grievances/grievances.module';

import { AdminTenantGrievanceConfigService } from './admin-tenant-grievance-config.service';
import { AdminTenantGrievanceGovernanceService } from './admin-tenant-grievance-governance.service';
import { AdminTenantController } from './admin-tenant.controller';
import { AdminTenantService } from './admin-tenant.service';

@Module({
  imports: [GrievancesModule],
  controllers: [AdminTenantController],
  providers: [
    AdminTenantService,
    AdminTenantGrievanceConfigService,
    AdminTenantGrievanceGovernanceService,
  ],
})
export class AdminTenantModule {}
