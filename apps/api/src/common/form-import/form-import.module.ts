import { Module } from '@nestjs/common';

import { FormImportQueueService } from './form-import.queue';

@Module({
  providers: [FormImportQueueService],
  exports: [FormImportQueueService],
})
export class FormImportQueueModule {}
