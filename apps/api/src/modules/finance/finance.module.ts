import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';

import { FinanceChallansService } from './finance-challans.service';
import { FinanceDepositsService } from './finance-deposits.service';
import { FinanceRefundDispatchesService } from './finance-refund-dispatches.service';
import { FinanceController } from './finance.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [FinanceController],
  providers: [FinanceDepositsService, FinanceRefundDispatchesService, FinanceChallansService],
})
export class FinanceModule {}
