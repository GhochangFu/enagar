import { ForbiddenException } from '@nestjs/common';

import { CitizenPayOnlineDto } from './dto/citizen-pay-online.dto';
import { LookupLeasesDto } from './dto/lookup-leases.dto';
import { QueryLeaseInvoicesDto } from './dto/query-invoices.dto';
import { RecordLeasePaymentDto } from './dto/record-payment.dto';
import { LeaseInvoicesController } from './lease-invoices.controller';
import { hasLeaseInvoiceStaffAccess } from './lease-invoices.roles';
import { LeaseInvoicesService } from './lease-invoices.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

describe('LeaseInvoicesController', () => {
  let controller: LeaseInvoicesController;
  let service: jest.Mocked<LeaseInvoicesService>;

  const makeService = (): jest.Mocked<LeaseInvoicesService> =>
    ({
      listInvoices: jest.fn(),
      getInvoice: jest.fn(),
      recordPayment: jest.fn(),
      applyLateFeeIfOverdue: jest.fn(),
      startOnlinePayment: jest.fn(),
      settleOffline: jest.fn(),
      lookupLeasesByPhone: jest.fn(),
      citizenPayOnline: jest.fn(),
    }) as unknown as jest.Mocked<LeaseInvoicesService>;

  beforeEach(() => {
    service = makeService();
    controller = new LeaseInvoicesController(service);
  });

  it('delegates list to the service for a municipality_admin principal', async () => {
    const principal: AuthenticatedPrincipal = {
      subject: 'staff-1',
      tenantCode: 'kmc',
      roles: ['municipality_admin'],
      expiresAt: new Date(),
    };
    const dto: QueryLeaseInvoicesDto = {};
    service.listInvoices.mockResolvedValue([]);
    await controller.list(principal, dto);
    expect(service.listInvoices).toHaveBeenCalledWith('kmc', dto);
  });

  it('delegates get to the service for a tenant_admin principal', async () => {
    const principal: AuthenticatedPrincipal = {
      subject: 'staff-2',
      tenantCode: 'kmc',
      roles: ['tenant_admin'],
      expiresAt: new Date(),
    };
    service.getInvoice.mockResolvedValue({ id: 'i1' } as never);
    const result = await controller.get(principal, 'i1');
    expect(result).toEqual({ id: 'i1' });
    expect(service.getInvoice).toHaveBeenCalledWith('kmc', 'i1');
  });

  it('delegates pay to the service for a tenant_clerk principal', async () => {
    const principal: AuthenticatedPrincipal = {
      subject: 'staff-3',
      tenantCode: 'kmc',
      roles: ['tenant_clerk'],
      expiresAt: new Date(),
    };
    const dto: RecordLeasePaymentDto = { method: 'CASH_AT_DESK' };
    service.recordPayment.mockResolvedValue({ invoice: { id: 'i1' } } as never);
    await controller.pay(principal, 'i1', dto);
    expect(service.recordPayment).toHaveBeenCalledWith('kmc', 'i1', dto);
  });

  it('delegates the citizen lookup without a staff role check', async () => {
    const dto: LookupLeasesDto = { phone: '9876543210' };
    service.lookupLeasesByPhone.mockResolvedValue([{ id: 'lease-1' } as never]);
    const result = await controller.lookup(dto);
    expect(service.lookupLeasesByPhone).toHaveBeenCalledWith('9876543210');
    expect(result).toEqual([{ id: 'lease-1' }]);
  });

  it('delegates pay-as-citizen without a staff role check', async () => {
    const principal: AuthenticatedPrincipal = {
      subject: 'dev-citizen-9836177767',
      roles: ['citizen'],
      expiresAt: new Date(),
    };
    const dto: CitizenPayOnlineDto = { phone: '9836177767', method: 'ONLINE_GATEWAY' };
    service.citizenPayOnline.mockResolvedValue({
      invoiceId: 'i1',
      paymentId: 'p1',
      gatewayOrderId: 'order-1',
      redirectUrl: '/payments/stub/complete?payment_id=p1&order_id=order-1',
    });
    const result = await controller.payAsCitizen(principal, 'i1', dto);
    expect(service.citizenPayOnline).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'dev-citizen-9836177767' }),
      'i1',
      '9836177767',
    );
    expect(result).toMatchObject({ paymentId: 'p1' });
  });

  it('rejects a citizen principal with ForbiddenException', () => {
    const principal: AuthenticatedPrincipal = {
      subject: 'dev-citizen-1',
      tenantCode: 'kmc',
      roles: ['citizen'],
      expiresAt: new Date(),
    };
    expect(() => controller.list(principal, {} as QueryLeaseInvoicesDto)).toThrow(
      ForbiddenException,
    );
    expect(() => controller.get(principal, 'i1')).toThrow(ForbiddenException);
    expect(() =>
      controller.pay(principal, 'i1', { method: 'CASH_AT_DESK' } as RecordLeasePaymentDto),
    ).toThrow(ForbiddenException);
  });
});

describe('hasLeaseInvoiceStaffAccess', () => {
  it.each<[string[], boolean]>([
    [['municipality_admin'], true],
    [['tenant_admin'], true],
    [['tenant_clerk'], true],
    [['municipality_clerk'], true],
    [['state_admin'], true],
    [['citizen'], false],
    [['unknown'], false],
    [[], false],
  ])('roles=%p -> %p', (roles, expected) => {
    const principal: AuthenticatedPrincipal = {
      subject: 'staff-x',
      roles,
      expiresAt: new Date(),
    };
    expect(hasLeaseInvoiceStaffAccess(principal)).toBe(expected);
  });
});
