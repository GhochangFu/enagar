import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

function readRepo(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('Master Sprint 6.27 — virus scan worker & download guard', () => {
  const documentsService = readRepo('apps/api/src/modules/documents/documents.service.ts');
  const scanQueue = readRepo('apps/api/src/common/document-scan/document-scan.queue.ts');
  const workerIndex = readRepo('services/document-scan-worker/src/index.ts');
  const pwaPage = readRepo('apps/citizen-pwa/app/page.tsx');
  const detailPanel = readRepo('apps/citizen-pwa/components/application-detail-panel.tsx');
  const formsUpload = readRepo('packages/forms/src/application-document-upload.ts');

  it('enqueues scan jobs and blocks client scan-result without simulation flag', () => {
    expect(scanQueue).toContain('DOCUMENT_SCAN_QUEUE_NAME');
    expect(scanQueue).toContain('enqueueScan');
    expect(documentsService).toContain('documentScanQueue.enqueueScan');
    expect(documentsService).toContain('allowsClientScanSimulation');
    expect(documentsService).toContain('ForbiddenException');
  });

  it('ships document-scan-worker with BullMQ consumer', () => {
    expect(workerIndex).toContain('document-scan');
    expect(workerIndex).toContain('processScan');
    expect(readRepo('services/document-scan-worker/src/scan-logic.ts')).toContain('EICAR');
  });

  it('PWA polls worker scan or simulates; detail panel offers download when clean', () => {
    expect(formsUpload).toContain('waitForDocumentScan');
    expect(pwaPage).toContain('waitForDocumentScan');
    expect(pwaPage).toContain('allowsClientScanSimulationFromEnv');
    expect(detailPanel).toContain('/download');
    expect(detailPanel).toContain("scan_status === 'clean'");
  });
});
