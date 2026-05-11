import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { TenantsModule } from '../tenants/tenants.module';

import { GrievancesController } from './grievances.controller';
import { GrievancesService } from './grievances.service';

@Module({
  imports: [DatabaseModule, TenantsModule],
  controllers: [GrievancesController],
  providers: [GrievancesService],
  exports: [GrievancesService],
})
export class GrievancesModule {}
