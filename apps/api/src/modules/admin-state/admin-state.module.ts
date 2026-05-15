import { Module } from '@nestjs/common';

import { AdminStateController } from './admin-state.controller';
import { AdminStateService } from './admin-state.service';

@Module({
  controllers: [AdminStateController],
  providers: [AdminStateService],
})
export class AdminStateModule {}
