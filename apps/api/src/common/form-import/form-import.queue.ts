import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

import { FORM_IMPORT_QUEUE_NAME, isFormImportQueueEnabled } from './form-import.config';

export type FormImportJobPayload = {
  jobId: string;
};

@Injectable()
export class FormImportQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(FormImportQueueService.name);
  private readonly connection: IORedis | null;
  private readonly queue: Queue<FormImportJobPayload> | null;

  constructor() {
    if (!isFormImportQueueEnabled()) {
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
    this.queue = new Queue<FormImportJobPayload>(FORM_IMPORT_QUEUE_NAME, {
      connection: this.connection,
    });
    this.logger.log('Form import queue connected');
  }

  async enqueueImport(jobId: string): Promise<void> {
    if (!this.queue) {
      return;
    }
    await this.queue.add(
      'import',
      { jobId },
      {
        jobId: `form-import-${jobId}`,
        removeOnComplete: 200,
        removeOnFail: 100,
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
