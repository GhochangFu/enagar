import { Module } from '@nestjs/common';

import { AdminStateGrievanceLibraryService } from './admin-state-grievance-library.service';
import { AdminStateController } from './admin-state.controller';
import { AdminStateService } from './admin-state.service';

@Module({
  controllers: [AdminStateController],
  providers: [AdminStateService, AdminStateGrievanceLibraryService],
})
export class AdminStateModule {}
