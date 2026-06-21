import { Module } from '@nestjs/common';

import { FormImportService } from './form-import.service';

@Module({
  providers: [FormImportService],
  exports: [FormImportService],
})
export class FormImportModule {}
