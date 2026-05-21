import type { DocumentScanQueueService } from '../../../common/document-scan/document-scan.queue';

export function createMockDocumentScanQueue(): Pick<DocumentScanQueueService, 'enqueueScan'> {
  return {
    enqueueScan: jest.fn().mockResolvedValue(undefined),
  };
}
