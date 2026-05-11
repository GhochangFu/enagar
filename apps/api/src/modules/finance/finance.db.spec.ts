import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../common/database/prisma.service';

import { FinanceChallansService } from './finance-challans.service';
import { FinanceDepositsService } from './finance-deposits.service';
import { FinanceRefundDispatchesService } from './finance-refund-dispatches.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDb('Sprint 3.3A finance persistence', () => {
  const prisma = new PrismaService();
  const tenantId = randomUUID();
  const citizenId = randomUUID();

  const financePrincipal = {
    subject: `finance-db-${tenantId.slice(0, 8)}`,
    tenantId,
    tenantCode: `F${tenantId.slice(0, 5)}`,
    roles: ['tenant_admin'],
    expiresAt: new Date(Date.now() + 3_600_000),
  } satisfies AuthenticatedPrincipal;

  const depositsSvc = new FinanceDepositsService(prisma);
  const refundsSvc = new FinanceRefundDispatchesService(prisma);

  beforeAll(async () => {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        code: `F${tenantId.slice(0, 6)}`,
        name: 'Finance 3.3A DB fixture',
        languagesEnabled: ['en', 'bn', 'hi'],
      },
    });
    await prisma.citizen.create({
      data: {
        id: citizenId,
        tenantId,
        mobile: '9876588888',
        name: 'Finance fixture',
      },
    });
  });

  afterAll(async () => {
    await prisma.refundDispatch.deleteMany({ where: { tenantId } });
    await prisma.deposit.deleteMany({ where: { tenantId } });
    await prisma.challan.deleteMany({ where: { tenantId } });
    await prisma.citizen.deleteMany({ where: { id: citizenId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('runs deposit → refund dispatch → approve → internal complete', async () => {
    const deposit = await depositsSvc.create(financePrincipal, {
      citizen_id: citizenId,
      deposit_type: 'rent_deposit',
      reference_code: 'HALL-BOOK-1',
      amount_paise: 500_000,
    });
    expect(deposit.status).toBe('held');

    const eligible = await depositsSvc.markEligibleForRelease(financePrincipal, deposit.id);
    expect(eligible.status).toBe('eligible_for_release');

    const dispatch = await refundsSvc.submitFromEligibleDeposit(financePrincipal, deposit.id, {
      note: 'Fixture queue',
    });
    expect(dispatch.status).toBe('pending_review');

    const row = await prisma.deposit.findUniqueOrThrow({ where: { id: deposit.id } });
    expect(row.status).toBe('refund_pending_review');

    const approved = await refundsSvc.approve(financePrincipal, dispatch.id, {
      note: 'OK to refund',
    });
    expect(approved.status).toBe('approved');

    const completed = await refundsSvc.completeWithoutPsp(financePrincipal, dispatch.id, {
      psp_note: '(test)',
    });
    expect(completed.status).toBe('completed_without_psp');

    const finalDeposit = await prisma.deposit.findUniqueOrThrow({ where: { id: deposit.id } });
    expect(finalDeposit.status).toBe('refunded');
  });

  it('issues and settles a challan without PSP link', async () => {
    const challans = new FinanceChallansService(prisma);
    const issued = await challans.create(financePrincipal, {
      challan_no: `CH-${randomUUID().slice(0, 8)}`,
      violation_code: 'ENC-042',
      amount_paise: 50_000,
      issued_to_name: 'Smoke defaulter',
    });
    expect(issued.status).toBe('issued');
    const settled = await challans.markPaidWithoutPaymentLink(financePrincipal, issued.id);
    expect(settled.status).toBe('paid');
    expect(settled.paid_at).not.toBeNull();
  });
});
