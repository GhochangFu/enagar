import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { FormImportQueueModule } from '../../common/form-import/form-import.module';

import { FormImportService } from './form-import.service';

@Module({
  imports: [DatabaseModule, FormImportQueueModule],
  providers: [FormImportService],
  exports: [FormImportService],
})
export class FormImportModule {}
