export const FORM_IMPORT_QUEUE_NAME = 'form-import';

/** Async worker requires Redis and durable object storage (separate process cannot read API stub store). */
export function isFormImportQueueEnabled(): boolean {
  if (process.env.FORM_IMPORT_ASYNC === 'false') {
    return false;
  }
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return false;
  }
  const disabled = process.env.OBJECT_STORAGE_DISABLED;
  if (disabled === 'true' || disabled === '1') {
    return false;
  }
  return true;
}
