import { Global, Module } from '@nestjs/common';

import { DocumentScanQueueService } from './document-scan.queue';

@Global()
@Module({
  providers: [DocumentScanQueueService],
  exports: [DocumentScanQueueService],
})
export class DocumentScanModule {}
