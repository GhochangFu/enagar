import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';

import { TransparencyController } from './transparency.controller';
import { TransparencyService } from './transparency.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TransparencyController],
  providers: [TransparencyService],
})
export class TransparencyModule {}
