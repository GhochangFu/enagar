import { Module } from '@nestjs/common';

import { KeycloakAdminProvisionerService } from '../../common/keycloak/keycloak-admin-provisioner.service';
import { FormImportModule } from '../form-import/form-import.module';
import { TenantOrgOnboardingModule } from '../tenant-org-onboarding/tenant-org-onboarding.module';

import { AdminStateGrievanceLibraryService } from './admin-state-grievance-library.service';
import { AdminStateController } from './admin-state.controller';
import { AdminStateService } from './admin-state.service';

@Module({
  imports: [FormImportModule, TenantOrgOnboardingModule],
  controllers: [AdminStateController],
  providers: [
    AdminStateService,
    AdminStateGrievanceLibraryService,
    KeycloakAdminProvisionerService,
  ],
  exports: [AdminStateService],
})
export class AdminStateModule {}
