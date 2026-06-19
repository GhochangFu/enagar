import { Module } from '@nestjs/common';

import { AdvertisingAdminController } from './advertising-admin.controller';
import { AdvertisingService } from './advertising.service';
import { CitizenAdvertisingController } from './citizen-advertising.controller';

@Module({
  controllers: [AdvertisingAdminController, CitizenAdvertisingController],
  providers: [AdvertisingService],
  exports: [AdvertisingService],
})
export class AdvertisingModule {}
