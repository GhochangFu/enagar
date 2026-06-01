import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';

import { TenantOrgOnboardingService } from './tenant-org-onboarding.service';

@Module({
  imports: [DatabaseModule],
  providers: [TenantOrgOnboardingService],
  exports: [TenantOrgOnboardingService],
})
export class TenantOrgOnboardingModule {}
