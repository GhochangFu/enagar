import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { ServicesModule } from '../services/services.module';

import { CitizenSmartParkingController } from './citizen-smart-parking.controller';
import { SmartParkingAdminController } from './smart-parking.controller';
import { SmartParkingService } from './smart-parking.service';

@Module({
  imports: [ServicesModule, PaymentsModule],
  controllers: [SmartParkingAdminController, CitizenSmartParkingController],
  providers: [SmartParkingService],
  exports: [SmartParkingService],
})
export class SmartParkingModule {}
