jest.mock('../admin-state/admin-state.service', () => ({
  AdminStateService: jest.fn(),
}));

import { createBlankFormSchemaDraft } from '@enagar/forms';
import { createLinearWorkflowDraft } from '@enagar/workflow';

import { ReadinessChecklistService } from './readiness-checklist.service';

describe('ReadinessChecklistService', () => {
  it('returns red when form draft is missing', async () => {
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        form_draft: null,
        form_published: null,
        workflow_draft: null,
        workflow_published: null,
        workflow_pattern: null,
      }),
      getServiceConfig: jest.fn().mockResolvedValue({
        fee_rule: { type: 'fixed', amount_paise: 1000, currency: 'INR' },
        required_documents: [],
        revenue_head: null,
        bookable_asset_codes: [],
      }),
    };

    const service = new ReadinessChecklistService(adminTenant as never, {} as never);
    const result = await service.forService('tenant-1', 'service-1');
    const formItem = result.items.find((item) => item.key === 'form_draft_valid');
    expect(formItem?.status).toBe('red');
    expect(result.ready_to_publish).toBe(false);
  });

  it('returns ready_to_publish true when all checks pass', async () => {
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        form_draft: {
          form_schema: createBlankFormSchemaDraft('svc-code', { en: 'Service' }),
        },
        form_published: { version: 1 },
        workflow_draft: {
          definition: createLinearWorkflowDraft('svc-code'),
        },
        workflow_published: { version: 1 },
        workflow_pattern: null,
      }),
      getServiceConfig: jest.fn().mockResolvedValue({
        fee_rule: { type: 'free', currency: 'INR' },
        required_documents: [{ code: 'doc-1' }],
        revenue_head: null,
        bookable_asset_codes: [],
      }),
    };

    const service = new ReadinessChecklistService(adminTenant as never, {} as never);
    const result = await service.forService('tenant-1', 'service-1');
    expect(result.ready_to_publish).toBe(true);
  });
});
