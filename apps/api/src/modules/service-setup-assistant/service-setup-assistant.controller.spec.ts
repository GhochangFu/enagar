import { ServiceSetupAssistantController } from './service-setup-assistant.controller';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

describe('ServiceSetupAssistantController', () => {
  const principal: AuthenticatedPrincipal = {
    subject: 'staff-1',
    tenantId: 'tenant-1',
    tenantCode: 'kmc',
    roles: ['tenant_admin'],
    expiresAt: new Date(),
  };

  function buildController() {
    const adminTenant = {
      getServiceDesigner: jest.fn().mockResolvedValue({}),
    };
    const sessions = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      setCurrentStep: jest.fn(),
      assertSessionAccess: jest.fn().mockResolvedValue({ serviceId: 'svc-1' }),
    };
    const readiness = {
      forService: jest.fn(),
    };
    const controller = new ServiceSetupAssistantController(
      adminTenant as never,
      sessions as never,
      readiness as never,
    );
    return { controller, adminTenant, sessions, readiness };
  }

  it('createSession delegates with scoped inputs', async () => {
    const { controller, adminTenant, sessions } = buildController();
    sessions.createSession.mockResolvedValue({ id: 's1', current_step: 2 });

    await controller.createSession(principal, 'svc-1', { scope: 'form' });

    expect(adminTenant.getServiceDesigner).toHaveBeenCalledWith(principal, 'svc-1');
    expect(sessions.createSession).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      serviceId: 'svc-1',
      staffSubjectId: 'staff-1',
      scope: 'form',
    });
  });
});
