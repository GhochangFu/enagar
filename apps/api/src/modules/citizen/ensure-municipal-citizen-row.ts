import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

/**
 * Ensures a `Citizen` row exists for `(targetTenantId, keycloakSubject)` so municipal FKs
 * (applications, grievances) succeed under Option A portal JWTs. Copies profile fields from
 * any existing row for the same subject (typically the WBPORTAL profile).
 */
export async function ensureMunicipalCitizenRow(
  db: PrismaService,
  keycloakSubject: string,
  targetTenantId: string,
): Promise<string> {
  const existing = await db.citizen.findFirst({
    where: { tenantId: targetTenantId, keycloakSubject },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const source = await db.citizen.findFirst({
    where: { keycloakSubject },
    orderBy: { updatedAt: 'desc' },
  });
  const mobile = source?.mobile?.trim() ?? '';
  if (!mobile) {
    throw new BadRequestException(
      'Citizen profile must be registered with a mobile number before filing',
    );
  }

  const created = await db.citizen.create({
    data: {
      tenantId: targetTenantId,
      keycloakSubject,
      mobile,
      name: source?.name ?? null,
      languagePref: source?.languagePref ?? 'en',
    },
  });

  return created.id;
}
