import { createBlankFormSchemaDraft } from '@enagar/forms';

import { TenantFormTools } from './tenant-form.tools';

describe('TenantFormTools', () => {
  const principal = {
    subject: 'staff-1',
    tenantId: 'tenant-1',
    roles: ['tenant_admin'],
    expiresAt: new Date(),
  };

  const baseCtx = {
    principal,
    session: {
      id: 'sess-1',
      scope: 'form' as const,
      current_step: 2 as const,
      archetype: null,
      step_completion: {},
      status: 'active' as const,
    },
    tenantId: 'tenant-1',
    serviceId: 'svc-1',
    step: 2 as const,
    scope: 'form' as const,
  };

  it('rejects applyFormDraft when service_code mismatches', async () => {
    const adminTenant = {
      saveFormDraft: jest
        .fn()
        .mockRejectedValue(new Error('Form schema service_code must match the tenant service')),
      getServiceDesigner: jest.fn(),
    };
    const prisma = { tenantService: { findFirst: jest.fn() } };
    const tools = new TenantFormTools(adminTenant as never, prisma as never);
    const schema = createBlankFormSchemaDraft('WRONG', { en: 'Test' });

    await expect(tools.definitions()[0]!.execute(baseCtx, { form_schema: schema })).rejects.toThrow(
      'service_code',
    );
  });

  it('proposeFormFields normalizes LLM-shaped fields and saves draft', async () => {
    const schema = createBlankFormSchemaDraft('svc', { en: 'Test' });
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({
        service: { code: 'svc', name: { en: 'Test' } },
        form_draft: { form_schema: schema },
      }),
      saveFormDraft: jest.fn().mockResolvedValue({
        form_schema: schema,
      }),
    };
    const prisma = { tenantService: { findFirst: jest.fn() } };
    const tools = new TenantFormTools(adminTenant as never, prisma as never);
    const propose = tools.definitions().find((tool) => tool.name === 'proposeFormFields')!;

    const result = await propose.execute(baseCtx, {
      fields: [
        {
          type: 'Text',
          label: "Guardian's Name",
          position: 'after',
          referenceField: 'Applicant name',
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.draftUpdated).toBe('form');
    expect(adminTenant.saveFormDraft).toHaveBeenCalledTimes(1);
    const saved = adminTenant.saveFormDraft.mock.calls[0]![2] as {
      form_schema: { fields: { id: string }[] };
    };
    const applicantIdx = saved.form_schema.fields.findIndex((f) => f.id === 'applicant_name');
    expect(saved.form_schema.fields[applicantIdx + 1]?.id).toBe('guardians_name');
  });
});
