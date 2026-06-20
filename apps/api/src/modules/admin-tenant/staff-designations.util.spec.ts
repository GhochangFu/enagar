import { loadStaffDesignationContext } from './staff-designations.util';

import type { PrismaService } from '../../common/database/prisma.service';

describe('loadStaffDesignationContext', () => {
  it('returns designation codes and capabilities for the staff user', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          userDesignations: [
            {
              designation: {
                code: 'hoarding_clerk',
                isDepartmentHead: false,
                canRejectMunicipal: false,
                isActive: true,
              },
            },
            {
              designation: {
                code: 'pwd_executive_engineer',
                isDepartmentHead: true,
                canRejectMunicipal: false,
                isActive: true,
              },
            },
          ],
        }),
      },
    } as unknown as PrismaService;

    const context = await loadStaffDesignationContext(prisma, {
      subject: 'kc-user-1',
      tenantId: 'tenant-1',
      roles: ['tenant_clerk'],
      expiresAt: new Date(),
    });

    expect(context.userId).toBe('user-1');
    expect(context.codes).toEqual(['hoarding_clerk', 'pwd_executive_engineer']);
    expect(context.capabilities[1]).toMatchObject({
      code: 'pwd_executive_engineer',
      is_department_head: true,
    });
  });

  it('returns empty context when staff user is not linked', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    await expect(
      loadStaffDesignationContext(prisma, {
        subject: 'missing',
        tenantId: 'tenant-1',
        roles: ['tenant_clerk'],
        expiresAt: new Date(),
      }),
    ).resolves.toEqual({ userId: null, codes: [], capabilities: [] });
  });
});
