import { Module } from '@nestjs/common';
// eslint-disable-next-line import/no-unresolved
import { ScheduleModule } from '@nestjs/schedule';

import { LeaseSchedulerService } from './lease-scheduler.service';
import { RentalAssetsController } from './rental-assets.controller';
import { RentalAssetsService } from './rental-assets.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [RentalAssetsController],
  providers: [RentalAssetsService, LeaseSchedulerService],
})
export class RentalAssetsModule {}
