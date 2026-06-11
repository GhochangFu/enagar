import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';

import { TenantConfigController } from './tenant-config.controller';
import { TenantConfigService } from './tenant-config.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TenantConfigController],
  providers: [TenantConfigService],
  exports: [TenantConfigService],
})
export class TenantConfigModule {}
