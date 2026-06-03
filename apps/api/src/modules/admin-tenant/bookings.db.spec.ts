import { randomUUID } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';
import { ObjectStorageService } from '../../common/object-storage/object-storage.service';
import { BookingsDepositPaymentService } from '../bookings/bookings-deposit-payment.service';
import { BookingsService } from '../bookings/bookings.service';
import { PostgresPaymentStore } from '../payments/postgres-payment.store';
import { StubPaymentGateway } from '../payments/stub-payment.gateway';
import { ServicesService } from '../services/services.service';
import { TenantsService } from '../tenants/tenants.service';

import { AdminTenantService } from './admin-tenant.service';

import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';
import type { PaymentsService } from '../payments/payments.service';
import type { PostApprovalExecutionService } from '../work-orders/post-approval-execution.service';
import type { WorkOrdersService } from '../work-orders/work-orders.service';

const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

const stubPaymentsService = {} as unknown as PaymentsService;
const stubWorkOrdersService = {} as unknown as WorkOrdersService;
const stubPostApprovalExecution = {} as unknown as PostApprovalExecutionService;
const stubKeycloakProvisioner =
  {} as unknown as import('../../common/keycloak/keycloak-admin-provisioner.service').KeycloakAdminProvisionerService;

/** Fixed UTC anchors: 09:00–21:00 IST availability; 10:00–11:00 IST first slot. */
const AVAIL_START = new Date('2026-06-10T03:30:00.000Z');
const AVAIL_END = new Date('2026-06-10T15:30:00.000Z');
const SLOT_START = new Date('2026-06-10T04:30:00.000Z');
const SLOT_END = new Date('2026-06-10T05:30:00.000Z');

describeDb('Sprint 8.1A bookable window + GiST overlap (DB)', () => {
  const prisma = new PrismaService();
  const tenantId = randomUUID();
  const tenantCode = `B${tenantId.replace(/-/g, '').slice(0, 6)}`.toUpperCase();
  const assetCode = `hall-${tenantId.slice(0, 8)}`;

  const staffPrincipal = {
    subject: `bookings-db-${tenantId.slice(0, 8)}`,
    tenantId,
    tenantCode,
    roles: ['municipality_admin'],
    expiresAt: new Date(Date.now() + 3_600_000),
  } satisfies AuthenticatedPrincipal;

  let assetId = '';
  let adminTenant: AdminTenantService;
  let bookingsService: BookingsService;
  let bookingPayments: BookingsDepositPaymentService;
  let paymentStore: PostgresPaymentStore;
  let servicesService: ServicesService;
  let tenantsService: TenantsService;
  const citizenSubject = `citizen-${tenantId.slice(0, 8)}`;
  const citizenId = randomUUID();

  beforeAll(async () => {
    adminTenant = new AdminTenantService(
      prisma,
      new ObjectStorageService(),
      stubPaymentsService,
      stubWorkOrdersService,
      stubPostApprovalExecution,
      stubKeycloakProvisioner,
    );
    bookingsService = new BookingsService(prisma);
    servicesService = new ServicesService(prisma);
    tenantsService = new TenantsService();
    paymentStore = new PostgresPaymentStore(prisma, tenantsService);
    bookingPayments = new BookingsDepositPaymentService(
      prisma,
      servicesService,
      new StubPaymentGateway(),
      paymentStore,
    );

    await prisma.tenant.create({
      data: {
        id: tenantId,
        code: tenantCode,
        name: 'Bookings 8.1A DB fixture',
        languagesEnabled: ['en', 'bn', 'hi'],
      },
    });

    const asset = await prisma.bookableAsset.create({
      data: {
        tenantId,
        code: assetCode,
        assetType: 'HALL',
        name: { en: 'DB smoke hall' },
        rateUnit: 'HOUR',
        baseRatePaise: 50_000,
        securityDepositPaise: 500_000,
        slotStepMinutes: 60,
        rules: { min_duration_minutes: 60 },
        isActive: true,
      },
    });
    assetId = asset.id;

    await prisma.citizen.create({
      data: {
        id: citizenId,
        tenantId,
        keycloakSubject: citizenSubject,
        mobile: '9876512345',
        name: 'Booking citizen',
      },
    });

    await prisma.bookableAssetAvailability.create({
      data: {
        tenantId,
        assetId,
        kind: 'available',
        startsAt: AVAIL_START,
        endsAt: AVAIL_END,
        note: 'DB smoke window',
      },
    });
  });

  afterAll(async () => {
    await prisma.paymentIdempotencyKey.deleteMany({ where: { tenantId } });
    await prisma.glPosting.deleteMany({ where: { tenantId } });
    await prisma.receipt.deleteMany({ where: { tenantId } });
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.deposit.deleteMany({ where: { tenantId } });
    await prisma.bookingReservation.deleteMany({ where: { tenantId } });
    await prisma.bookableAssetAvailability.deleteMany({ where: { tenantId } });
    await prisma.bookableAsset.deleteMany({ where: { tenantId } });
    await prisma.citizen.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.paymentIdempotencyKey.deleteMany({ where: { tenantId } });
    await prisma.glPosting.deleteMany({ where: { tenantId } });
    await prisma.receipt.deleteMany({ where: { tenantId } });
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.deposit.deleteMany({ where: { tenantId } });
    await prisma.bookingReservation.deleteMany({ where: { tenantId } });
  });

  it('accepts a hold inside an available window aligned to slot_step_minutes', async () => {
    const row = await adminTenant.addBookingReservation(staffPrincipal, {
      asset_code: assetCode,
      holder_name: 'Smoke citizen',
      starts_at: SLOT_START.toISOString(),
      ends_at: SLOT_END.toISOString(),
      status: 'hold',
    });
    expect(row.status).toBe('hold');
    expect(row.starts_at).toBe(SLOT_START.toISOString());
  });

  it('rejects a window outside available hours (assertBookableWindow)', async () => {
    await expect(
      adminTenant.addBookingReservation(staffPrincipal, {
        asset_code: assetCode,
        holder_name: 'Early bird',
        starts_at: new Date('2026-06-10T02:30:00.000Z').toISOString(),
        ends_at: new Date('2026-06-10T03:30:00.000Z').toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      adminTenant.addBookingReservation(staffPrincipal, {
        asset_code: assetCode,
        holder_name: 'Early bird',
        starts_at: new Date('2026-06-10T02:30:00.000Z').toISOString(),
        ends_at: new Date('2026-06-10T03:30:00.000Z').toISOString(),
      }),
    ).rejects.toThrow('Requested window is outside available hours');
  });

  it('rejects duration not aligned to slot_step_minutes', async () => {
    await expect(
      adminTenant.addBookingReservation(staffPrincipal, {
        asset_code: assetCode,
        holder_name: 'Half hour',
        starts_at: SLOT_START.toISOString(),
        ends_at: new Date('2026-06-10T05:00:00.000Z').toISOString(),
      }),
    ).rejects.toThrow(/positive multiple of 60 minutes/);
  });

  it('rejects overlapping holds via assertBookableWindow before GiST', async () => {
    await adminTenant.addBookingReservation(staffPrincipal, {
      asset_code: assetCode,
      holder_name: 'First',
      starts_at: SLOT_START.toISOString(),
      ends_at: SLOT_END.toISOString(),
    });

    await expect(
      adminTenant.addBookingReservation(staffPrincipal, {
        asset_code: assetCode,
        holder_name: 'Second',
        starts_at: new Date('2026-06-10T05:00:00.000Z').toISOString(),
        ends_at: new Date('2026-06-10T06:00:00.000Z').toISOString(),
      }),
    ).rejects.toThrow('Requested window overlaps an existing booking');
  });

  it('GiST EXCLUDE blocks overlapping hold inserted without app checks', async () => {
    await prisma.bookingReservation.create({
      data: {
        tenantId,
        assetId,
        holderName: 'Direct first',
        startsAt: SLOT_START,
        endsAt: SLOT_END,
        status: 'hold',
      },
    });

    await expect(
      prisma.bookingReservation.create({
        data: {
          tenantId,
          assetId,
          holderName: 'Direct overlap',
          startsAt: new Date('2026-06-10T05:00:00.000Z'),
          endsAt: new Date('2026-06-10T06:00:00.000Z'),
          status: 'hold',
        },
      }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/exclusion|no_time_overlap|23P01/i),
    });
  });

  it('allows a new hold after the prior booking is cancelled (GiST partial index)', async () => {
    const first = await prisma.bookingReservation.create({
      data: {
        tenantId,
        assetId,
        holderName: 'Cancelled holder',
        startsAt: SLOT_START,
        endsAt: SLOT_END,
        status: 'confirmed',
      },
    });

    await prisma.bookingReservation.update({
      where: { id: first.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    const second = await adminTenant.addBookingReservation(staffPrincipal, {
      asset_code: assetCode,
      holder_name: 'Replacement',
      starts_at: SLOT_START.toISOString(),
      ends_at: SLOT_END.toISOString(),
      status: 'hold',
    });
    expect(second.status).toBe('hold');
  });

  it('8.1B: lists slot grid with a taken hour after hold', async () => {
    const citizenPrincipal = {
      subject: citizenSubject,
      tenantId,
      tenantCode,
      roles: ['citizen'],
      expiresAt: new Date(Date.now() + 3_600_000),
    } satisfies AuthenticatedPrincipal;

    await bookingsService.createHold(citizenPrincipal, {
      tenant_code: tenantCode,
      asset_code: assetCode,
      starts_at: SLOT_START.toISOString(),
      ends_at: SLOT_END.toISOString(),
    });

    const grid = await bookingsService.listAssetSlots(
      tenantCode,
      assetCode,
      '2026-06-10T03:30:00.000Z',
      '2026-06-10T08:30:00.000Z',
    );
    const slot = grid.slots.find((row) => row.starts_at === SLOT_START.toISOString());
    expect(slot?.status).toBe('taken');
  });

  it('8.1B: quotes hourly rent and rejects second hold on same slot', async () => {
    const citizenPrincipal = {
      subject: citizenSubject,
      tenantId,
      tenantCode,
      roles: ['citizen'],
      expiresAt: new Date(Date.now() + 3_600_000),
    } satisfies AuthenticatedPrincipal;

    const quote = await bookingsService.quote({
      tenant_code: tenantCode,
      asset_code: assetCode,
      starts_at: SLOT_START.toISOString(),
      ends_at: SLOT_END.toISOString(),
    });
    expect(quote.rent_paise).toBe(50_000);
    expect(quote.deposit_paise).toBe(500_000);
    expect(quote.total_paise).toBe(550_000);

    await bookingsService.createHold(citizenPrincipal, {
      tenant_code: tenantCode,
      asset_code: assetCode,
      starts_at: SLOT_START.toISOString(),
      ends_at: SLOT_END.toISOString(),
    });

    await expect(
      bookingsService.createHold(citizenPrincipal, {
        tenant_code: tenantCode,
        asset_code: assetCode,
        starts_at: SLOT_START.toISOString(),
        ends_at: SLOT_END.toISOString(),
      }),
    ).rejects.toThrow('Selected slot is no longer free');
  });

  it('8.1B: confirms zero-deposit asset without deposit_id', async () => {
    const noDepositAsset = await prisma.bookableAsset.create({
      data: {
        tenantId,
        code: `free-${tenantId.slice(0, 6)}`,
        assetType: 'HALL',
        name: { en: 'Free hall' },
        rateUnit: 'HOUR',
        baseRatePaise: 10_000,
        securityDepositPaise: 0,
        slotStepMinutes: 60,
        isActive: true,
      },
    });
    await prisma.bookableAssetAvailability.create({
      data: {
        tenantId,
        assetId: noDepositAsset.id,
        kind: 'available',
        startsAt: AVAIL_START,
        endsAt: AVAIL_END,
      },
    });

    const citizenPrincipal = {
      subject: citizenSubject,
      tenantId,
      tenantCode,
      roles: ['citizen'],
      expiresAt: new Date(Date.now() + 3_600_000),
    } satisfies AuthenticatedPrincipal;

    const hold = await bookingsService.createHold(citizenPrincipal, {
      tenant_code: tenantCode,
      asset_code: noDepositAsset.code,
      starts_at: new Date('2026-06-10T06:30:00.000Z').toISOString(),
      ends_at: new Date('2026-06-10T07:30:00.000Z').toISOString(),
    });

    const confirmed = await bookingsService.confirmHold(citizenPrincipal, hold.id, {});
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.booking_no).toMatch(new RegExp(`^BK/${tenantCode}/`));
  });

  it('8.1C: deposit stub payment then confirm with booking_no on deposit', async () => {
    const citizenPrincipal = {
      subject: citizenSubject,
      tenantId,
      tenantCode,
      roles: ['citizen'],
      expiresAt: new Date(Date.now() + 3_600_000),
    } satisfies AuthenticatedPrincipal;

    const hold = await bookingsService.createHold(citizenPrincipal, {
      tenant_code: tenantCode,
      asset_code: assetCode,
      starts_at: SLOT_START.toISOString(),
      ends_at: SLOT_END.toISOString(),
    });

    const checkout = await bookingPayments.initiateForHold(
      citizenPrincipal,
      hold.id,
      { method: 'upi' },
      `booking-pay-${tenantId.slice(0, 8)}`,
    );
    expect(checkout.deposit_paise).toBe(500_000);
    expect(checkout.amount_paise).toBe(500_000);

    await paymentStore.settleStubLedger(
      citizenPrincipal,
      checkout.payment.id,
      checkout.payment.gateway_order_id,
      {
        serviceCode: 'community-hall',
        revenueHeadCode: 'booking-fee',
        accountingCode: 'rent',
      },
    );

    const deposit = await prisma.deposit.findUniqueOrThrow({
      where: { id: checkout.deposit_id },
    });
    expect(deposit.capturePaymentId).toBe(checkout.payment.id);
    expect(deposit.depositType).toBe('booking_security');

    const confirmed = await bookingsService.confirmHold(citizenPrincipal, hold.id, {
      deposit_id: checkout.deposit_id,
    });
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.booking_no).toMatch(new RegExp(`^BK/${tenantCode}/`));

    const depositAfter = await prisma.deposit.findUniqueOrThrow({
      where: { id: checkout.deposit_id },
    });
    expect(depositAfter.referenceCode).toBe(confirmed.booking_no);
  });

  it('8.1D: confirmation PDF for confirmed booking', async () => {
    const pdfAsset = await prisma.bookableAsset.create({
      data: {
        tenantId,
        code: `pdf-${tenantId.slice(0, 6)}`,
        assetType: 'HALL',
        name: { en: 'PDF test hall' },
        rateUnit: 'HOUR',
        baseRatePaise: 10_000,
        securityDepositPaise: 0,
        slotStepMinutes: 60,
        isActive: true,
      },
    });
    await prisma.bookableAssetAvailability.create({
      data: {
        tenantId,
        assetId: pdfAsset.id,
        kind: 'available',
        startsAt: AVAIL_START,
        endsAt: AVAIL_END,
      },
    });

    const citizenPrincipal = {
      subject: citizenSubject,
      tenantId,
      tenantCode,
      roles: ['citizen'],
      expiresAt: new Date(Date.now() + 3_600_000),
    } satisfies AuthenticatedPrincipal;

    const hold = await bookingsService.createHold(citizenPrincipal, {
      tenant_code: tenantCode,
      asset_code: pdfAsset.code,
      starts_at: new Date('2026-06-10T06:30:00.000Z').toISOString(),
      ends_at: new Date('2026-06-10T07:30:00.000Z').toISOString(),
    });

    const confirmed = await bookingsService.confirmHold(citizenPrincipal, hold.id, {}, tenantCode);
    expect(confirmed.booking_no).toBeTruthy();

    const pdf = await bookingsService.exportConfirmationPdf(
      citizenPrincipal,
      confirmed.booking_no!,
      tenantCode,
    );
    expect(pdf.subarray(0, 8).toString('utf8')).toBe('%PDF-1.4');
    const raw = pdf.toString('utf8');
    expect(raw).toContain('Booking Confirmation');
    expect(raw).toContain(confirmed.booking_no);
    expect(raw).toContain('IST');
  });
});
