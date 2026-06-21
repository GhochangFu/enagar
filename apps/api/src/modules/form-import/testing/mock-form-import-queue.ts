import type { FormImportQueueService } from '../../../common/form-import/form-import.queue';

export function createMockFormImportQueue(): Pick<FormImportQueueService, 'enqueueImport'> {
  return {
    enqueueImport: jest.fn().mockResolvedValue(undefined),
  };
}
