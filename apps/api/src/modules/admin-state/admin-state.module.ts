import { Module } from '@nestjs/common';

import { KeycloakAdminProvisionerService } from '../../common/keycloak/keycloak-admin-provisioner.service';
import { TenantOrgOnboardingModule } from '../tenant-org-onboarding/tenant-org-onboarding.module';

import { AdminStateGrievanceLibraryService } from './admin-state-grievance-library.service';
import { AdminStateController } from './admin-state.controller';
import { AdminStateService } from './admin-state.service';

@Module({
  imports: [TenantOrgOnboardingModule],
  controllers: [AdminStateController],
  providers: [
    AdminStateService,
    AdminStateGrievanceLibraryService,
    KeycloakAdminProvisionerService,
  ],
})
export class AdminStateModule {}
