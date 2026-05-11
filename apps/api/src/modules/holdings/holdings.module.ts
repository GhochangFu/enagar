import { Module } from '@nestjs/common';

import { TenantsModule } from '../tenants/tenants.module';

import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';

@Module({
  imports: [TenantsModule],
  controllers: [HoldingsController],
  providers: [HoldingsService],
  exports: [HoldingsService],
})
export class HoldingsModule {}
