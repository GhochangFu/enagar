import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';

import { CitizenEvChargingController } from './citizen-ev-charging.controller';
import { EvChargingAdminController } from './ev-charging-admin.controller';
import { EvChargingService } from './ev-charging.service';

@Module({
  imports: [PaymentsModule],
  controllers: [EvChargingAdminController, CitizenEvChargingController],
  providers: [EvChargingService],
  exports: [EvChargingService],
})
export class EvChargingModule {}
