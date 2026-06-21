import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';

import { FormImportService } from './form-import.service';

@Module({
  imports: [DatabaseModule],
  providers: [FormImportService],
  exports: [FormImportService],
})
export class FormImportModule {}
