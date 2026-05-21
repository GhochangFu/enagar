import { randomUUID } from 'node:crypto';

import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { loadObjectStorageConfig } from './object-storage.config';
import { ObjectStorageService } from './object-storage.service';

const describeStorage = process.env.RUN_STORAGE_TESTS === '1' ? describe : describe.skip;

describeStorage('ObjectStorageService integration (MinIO)', () => {
  let config: ReturnType<typeof loadObjectStorageConfig>;
  let service: ObjectStorageService;
  let rawClient: S3Client;

  beforeAll(async () => {
    process.env.OBJECT_STORAGE_DISABLED = 'false';
    process.env.OBJECT_STORAGE_ENDPOINT =
      process.env.OBJECT_STORAGE_ENDPOINT ?? 'http://127.0.0.1:9000';
    process.env.OBJECT_STORAGE_ACCESS_KEY =
      process.env.OBJECT_STORAGE_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? 'enagar_admin';
    process.env.OBJECT_STORAGE_SECRET_KEY =
      process.env.OBJECT_STORAGE_SECRET_KEY ??
      process.env.MINIO_ROOT_PASSWORD ??
      'minio_dev_pw_change_me';
    process.env.OBJECT_STORAGE_BUCKET = process.env.OBJECT_STORAGE_BUCKET ?? 'enagar-local';
    process.env.OBJECT_STORAGE_FORCE_PATH_STYLE = 'true';

    config = loadObjectStorageConfig();
    service = new ObjectStorageService();
    await service.onModuleInit();
    rawClient = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: config.forcePathStyle,
    });
  });

  it('presigns upload, accepts PUT, and headObject finds the bytes', async () => {
    const objectKey = `tenants/kmc/integration/${randomUUID()}.txt`;
    const body = `enagar-storage-smoke-${Date.now()}`;
    const signed = await service.presignUpload(objectKey, 'text/plain', 60_000);

    expect(signed.url).toMatch(/^https?:\/\//);

    const putResponse = await fetch(signed.url, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body,
    });
    expect(putResponse.ok).toBe(true);

    const head = await service.headObject(objectKey);
    expect(head?.content_length).toBeGreaterThan(0);

    await rawClient.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
      }),
    );
  });
});
