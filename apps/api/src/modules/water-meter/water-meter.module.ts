import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';

import { CitizenWaterMeterController } from './citizen-water-meter.controller';
import { WaterMeterAdminController } from './water-meter-admin.controller';
import { WaterMeterService } from './water-meter.service';

@Module({
  imports: [PaymentsModule],
  controllers: [WaterMeterAdminController, CitizenWaterMeterController],
  providers: [WaterMeterService],
  exports: [WaterMeterService],
})
export class WaterMeterModule {}
