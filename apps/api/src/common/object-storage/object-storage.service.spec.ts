import { BadRequestException } from '@nestjs/common';

import { ObjectStorageService } from './object-storage.service';

describe('ObjectStorageService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, OBJECT_STORAGE_DISABLED: 'true' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns minio stub URLs when storage is disabled', async () => {
    const service = new ObjectStorageService();
    await service.onModuleInit();

    const signed = await service.presignUpload(
      'tenants/kmc/applications/a/documents/b/file.pdf',
      'application/pdf',
    );

    expect(signed.url).toContain('minio://enagar-local/');
    expect(signed.url).toContain('action=upload');
    expect(signed.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects unsafe object keys', () => {
    const service = new ObjectStorageService();
    expect(() => service.assertSafeObjectKey('../etc/passwd')).toThrow(BadRequestException);
    expect(() => service.assertSafeObjectKey('/absolute/key')).toThrow(BadRequestException);
  });

  it('requires tenant prefix for tenant-scoped keys', () => {
    const service = new ObjectStorageService();
    expect(() =>
      service.assertTenantObjectKey('tenants/hmc/grievances/evidence/x.jpg', 'KMC'),
    ).toThrow(BadRequestException);
    expect(() =>
      service.assertTenantObjectKey('tenants/kmc/grievances/evidence/x.jpg', 'KMC'),
    ).not.toThrow();
  });

  it('builds path-style public URLs from public base and bucket', () => {
    process.env = {
      ...originalEnv,
      OBJECT_STORAGE_DISABLED: 'true',
      OBJECT_STORAGE_PUBLIC_BASE: 'http://cdn.example',
      OBJECT_STORAGE_BUCKET: 'enagar-local',
      OBJECT_STORAGE_FORCE_PATH_STYLE: 'true',
    };
    const service = new ObjectStorageService();
    expect(service.buildPublicObjectUrl('KMC/branding/kmc-logo/logo.png')).toBe(
      'http://cdn.example/enagar-local/KMC/branding/kmc-logo/logo.png',
    );
  });

  it('stores and retrieves bytes via the in-memory stub when storage is disabled', async () => {
    process.env = { ...originalEnv, OBJECT_STORAGE_DISABLED: 'true' };
    const service = new ObjectStorageService();
    await service.onModuleInit();

    const key = 'tenants/kmc/lease-agreements/a/file.pdf';
    const body = Buffer.from('%PDF-1.4 stub bytes');

    expect(await service.headObject(key)).toBeNull();
    expect(await service.getObjectBuffer(key)).toBeNull();

    await service.putObject(key, body, 'application/pdf');

    const head = await service.headObject(key);
    expect(head).toEqual({ content_length: body.byteLength, content_type: 'application/pdf' });
    expect((await service.getObjectBuffer(key))?.equals(body)).toBe(true);
  });
});
