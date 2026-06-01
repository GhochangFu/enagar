import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';

import { PostApprovalExecutionService } from './post-approval-execution.service';
import { WorkOrdersService } from './work-orders.service';

@Module({
  imports: [DatabaseModule],
  providers: [WorkOrdersService, PostApprovalExecutionService],
  exports: [WorkOrdersService, PostApprovalExecutionService],
})
export class WorkOrdersModule {}
