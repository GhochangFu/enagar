import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';

import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
