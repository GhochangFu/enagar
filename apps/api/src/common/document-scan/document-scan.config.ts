/** EICAR standard test string (detected as infected in dev stub mode). */
export const EICAR_TEST_SIGNATURE =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

export const DOCUMENT_SCAN_QUEUE_NAME = 'document-scan';

export function allowsClientScanSimulation(): boolean {
  return process.env.ALLOW_CLIENT_SCAN_SIMULATION === 'true';
}

export function isDocumentScanQueueEnabled(): boolean {
  if (allowsClientScanSimulation()) {
    return false;
  }
  return Boolean(process.env.REDIS_URL?.trim());
}

export function maxUploadIntentsPerApplicationPerHour(): number {
  const raw = Number(process.env.DOCUMENT_UPLOAD_INTENT_LIMIT_PER_HOUR ?? '30');
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
}
