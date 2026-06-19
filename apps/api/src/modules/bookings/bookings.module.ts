import { Module, forwardRef } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { PaymentsModule } from '../payments/payments.module';
import { ServicesModule } from '../services/services.module';

import { BookingsDepositPaymentService } from './bookings-deposit-payment.service';
import { BookingsService } from './bookings.service';
import { CitizenBookingsController } from './citizen-bookings.controller';
import { PublicBookingsController } from './public-bookings.controller';

@Module({
  imports: [DatabaseModule, forwardRef(() => PaymentsModule), ServicesModule],
  controllers: [PublicBookingsController, CitizenBookingsController],
  providers: [BookingsService, BookingsDepositPaymentService],
  exports: [BookingsService, BookingsDepositPaymentService],
})
export class BookingsModule {}
