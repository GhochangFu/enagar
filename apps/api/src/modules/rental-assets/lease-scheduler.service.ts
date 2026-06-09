import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line import/no-unresolved
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class LeaseSchedulerService {
  private readonly logger = new Logger(LeaseSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleLeaseScheduler() {
    this.logger.log('Running daily lease scheduler...');
    const now = new Date();

    // 1. Expiry Alerts (Agreements expiring within the next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const expiringAgreements = await this.prisma.leaseAgreement.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        asset: true,
      },
    });

    if (expiringAgreements.length > 0) {
      this.logger.warn(
        `[LEASE ALERT] ${expiringAgreements.length} agreements are expiring within 30 days.`,
      );
      // TODO: Integrate with actual notification service (e.g., email, in-app)
    }

    // 2. Invoice Generation
    // Fetch active agreements and their most recent invoice to determine the next billing period
    const activeAgreements = await this.prisma.leaseAgreement.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        invoices: {
          orderBy: { periodStart: 'desc' },
          take: 1,
        },
      },
    });

    let invoicesCreated = 0;
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    for (const agreement of activeAgreements) {
      const lastInvoice = agreement.invoices[0];
      let nextPeriodStart: Date;

      if (!lastInvoice) {
        nextPeriodStart = new Date(agreement.startDate);
      } else {
        nextPeriodStart = new Date(lastInvoice.periodEnd);
        nextPeriodStart.setDate(nextPeriodStart.getDate() + 1); // Next day
      }

      // Calculate next period end based on ratePeriod
      const nextPeriodEnd = new Date(nextPeriodStart);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ratePeriod = (agreement as any).ratePeriod;
      if (ratePeriod === 'MONTHLY') {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
      } else if (ratePeriod === 'QUARTERLY') {
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 3);
      } else if (ratePeriod === 'YEARLY') {
        nextPeriodEnd.setFullYear(nextPeriodEnd.getFullYear() + 1);
      }

      // Only generate if the next period is starting soon (within 7 days)
      if (nextPeriodStart <= sevenDaysFromNow) {
        // Check if an invoice already exists for this exact period to prevent duplicates
        const existingInvoice = await this.prisma.leaseInvoice.findFirst({
          where: {
            agreementId: agreement.id,
            periodStart: {
              equals: nextPeriodStart,
            },
          },
        });

        if (!existingInvoice) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const baseLeaseRatePaise = (agreement as any).baseLeaseRatePaise;
          await this.prisma.leaseInvoice.create({
            data: {
              tenantId: agreement.tenantId,
              agreementId: agreement.id,
              invoiceNo: `INV-${agreement.id.slice(0, 8)}-${Date.now()}`,
              periodStart: nextPeriodStart,
              periodEnd: nextPeriodEnd,
              dueDate: nextPeriodStart,
              amountPaise: baseLeaseRatePaise ?? 0,
              status: 'PENDING',
            },
          });
          this.logger.log(
            `[LEASE INVOICE] Generated invoice for agreement ${agreement.id} for period ${nextPeriodStart.toISOString()}`,
          );
          invoicesCreated++;
        }
      }
    }

    this.logger.log(`Lease scheduler completed. Created ${invoicesCreated} new invoice(s).`);
  }
}
