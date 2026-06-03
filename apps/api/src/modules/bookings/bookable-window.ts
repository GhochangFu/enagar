import { BadRequestException } from '@nestjs/common';

import type { PrismaService } from '../../common/database/prisma.service';

type BookableWindowDb = Pick<PrismaService, 'bookableAssetAvailability' | 'bookingReservation'>;

/** Sprint 8.1A/8.1B — availability, blackout, overlap, and slot-step alignment. */
export async function assertBookableWindow(
  prisma: BookableWindowDb,
  tenantId: string,
  asset: { id: string; slotStepMinutes: number },
  startsAt: Date,
  endsAt: Date,
): Promise<void> {
  const durationMs = endsAt.getTime() - startsAt.getTime();
  const stepMs = asset.slotStepMinutes * 60_000;
  if (durationMs <= 0 || durationMs % stepMs !== 0) {
    throw new BadRequestException(
      `Booking duration must be a positive multiple of ${asset.slotStepMinutes} minutes`,
    );
  }

  const available = await prisma.bookableAssetAvailability.findFirst({
    where: {
      tenantId,
      assetId: asset.id,
      kind: 'available',
      startsAt: { lte: startsAt },
      endsAt: { gte: endsAt },
    },
  });
  if (!available) {
    throw new BadRequestException('Requested window is outside available hours');
  }

  const blackout = await prisma.bookableAssetAvailability.findFirst({
    where: {
      tenantId,
      assetId: asset.id,
      kind: 'blackout',
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (blackout) {
    throw new BadRequestException('Requested window overlaps a blackout');
  }

  const overlap = await prisma.bookingReservation.findFirst({
    where: {
      tenantId,
      assetId: asset.id,
      status: { in: ['hold', 'confirmed'] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (overlap) {
    throw new BadRequestException('Requested window overlaps an existing booking');
  }
}
