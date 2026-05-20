import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { TenantsModule } from '../tenants/tenants.module';

import { GrievanceCatalogueService } from './grievance-catalogue.service';
import { GrievancesController } from './grievances.controller';
import { GrievancesService } from './grievances.service';
import { PublicGrievanceStatsController } from './public-grievance-stats.controller';

@Module({
  imports: [DatabaseModule, TenantsModule],
  controllers: [GrievancesController, PublicGrievanceStatsController],
  providers: [GrievancesService, GrievanceCatalogueService],
  exports: [GrievancesService, GrievanceCatalogueService],
})
export class GrievancesModule {}
