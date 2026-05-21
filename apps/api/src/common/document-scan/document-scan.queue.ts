import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { DOCUMENT_SCAN_QUEUE_NAME, isDocumentScanQueueEnabled } from './document-scan.config';

export type DocumentScanJobPayload = {
  documentId: string;
};

@Injectable()
export class DocumentScanQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(DocumentScanQueueService.name);
  private readonly connection: IORedis | null;
  private readonly queue: Queue<DocumentScanJobPayload> | null;

  constructor() {
    if (!isDocumentScanQueueEnabled()) {
      this.connection = null;
      this.queue = null;
      return;
    }

    const redisUrl = process.env.REDIS_URL?.trim();
    if (!redisUrl) {
      this.connection = null;
      this.queue = null;
      return;
    }

    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<DocumentScanJobPayload>(DOCUMENT_SCAN_QUEUE_NAME, {
      connection: this.connection,
    });
    this.logger.log('Document scan queue connected');
  }

  async enqueueScan(documentId: string): Promise<void> {
    if (!this.queue) {
      return;
    }
    await this.queue.add(
      'scan',
      { documentId },
      {
        jobId: `scan-${documentId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    await this.connection?.quit();
  }
}
