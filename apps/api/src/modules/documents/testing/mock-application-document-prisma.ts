import type { PrismaService } from '../../../common/database/prisma.service';
import type { ApplicationDocument } from '../../../generated/prisma';

/** In-memory Prisma mock for `application_documents` (unit + HTTP integration tests). */
export function createMockApplicationDocumentPrisma(): PrismaService {
  const rows = new Map<string, ApplicationDocument>();

  return {
    applicationDocument: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          scanProvider: null,
          scanSignature: null,
          scanCompletedAt: null,
        } as ApplicationDocument;
        rows.set(row.id, row);
        return row;
      }),
      update: jest.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const existing = rows.get(where.id);
          if (!existing) {
            throw new Error('Document not found');
          }
          const row = { ...existing, ...data, updatedAt: new Date() } as ApplicationDocument;
          rows.set(where.id, row);
          return row;
        },
      ),
      findUnique: jest.fn(
        async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
      ),
      findMany: jest.fn(async ({ where }: { where: { tenantId: string; applicationId: string } }) =>
        [...rows.values()].filter(
          (row) => row.tenantId === where.tenantId && row.applicationId === where.applicationId,
        ),
      ),
      count: jest.fn(
        async ({ where }: { where: { applicationId: string; createdAt?: { gte: Date } } }) =>
          [...rows.values()].filter((row) => {
            if (row.applicationId !== where.applicationId) {
              return false;
            }
            if (where.createdAt?.gte && row.createdAt < where.createdAt.gte) {
              return false;
            }
            return true;
          }).length,
      ),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    bookingReservation: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    bookableAsset: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    application: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    glPosting: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
}
