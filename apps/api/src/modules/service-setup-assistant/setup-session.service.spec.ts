import { ForbiddenException } from '@nestjs/common';

import { SetupSessionService } from './setup-session.service';

describe('SetupSessionService', () => {
  function makePrismaMock() {
    return {
      serviceSetupSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
  }

  it.each([
    ['full', 1],
    ['form', 2],
    ['workflow', 3],
    ['payment', 4],
    ['review', 5],
  ] as const)('maps scope %s to current_step %d', async (scope, expectedStep) => {
    const prisma = makePrismaMock();
    prisma.serviceSetupSession.create.mockResolvedValue({
      id: 'session-1',
      scope,
      currentStep: expectedStep,
      archetype: null,
      stepCompletion: {},
      status: 'active',
    });
    const service = new SetupSessionService(prisma as never);
    const result = await service.createSession({
      tenantId: 'tenant-1',
      serviceId: 'svc-1',
      staffSubjectId: 'staff-1',
      scope,
    });
    expect(result.current_step).toBe(expectedStep);
  });

  it('assertSessionAccess rejects a different tenant', async () => {
    const prisma = makePrismaMock();
    prisma.serviceSetupSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-2',
      staffSubjectId: 'staff-1',
    });
    const service = new SetupSessionService(prisma as never);
    await expect(service.assertSessionAccess('session-1', 'tenant-1', 'staff-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('assertSessionAccess rejects a different staff subject', async () => {
    const prisma = makePrismaMock();
    prisma.serviceSetupSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      staffSubjectId: 'staff-2',
    });
    const service = new SetupSessionService(prisma as never);
    await expect(service.assertSessionAccess('session-1', 'tenant-1', 'staff-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('setCurrentStep rejects a step not allowed for scope', async () => {
    const prisma = makePrismaMock();
    prisma.serviceSetupSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      staffSubjectId: 'staff-1',
      scope: 'form',
    });
    const service = new SetupSessionService(prisma as never);
    await expect(service.setCurrentStep('session-1', 'tenant-1', 'staff-1', 3)).rejects.toThrow(
      'not allowed for scope',
    );
  });
});
