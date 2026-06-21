import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type ObjectStorageEnv = {
  disabled: boolean;
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  forcePathStyle: boolean;
};

export function loadObjectStorageEnv(): ObjectStorageEnv {
  return {
    disabled: process.env.OBJECT_STORAGE_DISABLED === 'true',
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT ?? 'http://127.0.0.1:9000',
    bucket: process.env.OBJECT_STORAGE_BUCKET ?? 'enagar-local',
    accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY ?? 'enagar_admin',
    secretKey: process.env.OBJECT_STORAGE_SECRET_KEY ?? 'minio_dev_pw_change_me',
    region: process.env.OBJECT_STORAGE_REGION ?? 'us-east-1',
    forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE !== 'false',
  };
}

export async function fetchObjectBytes(
  config: ObjectStorageEnv,
  objectKey: string,
): Promise<Buffer | null> {
  if (config.disabled) {
    console.warn('[form-import] OBJECT_STORAGE_DISABLED — cannot fetch source file in worker');
    return null;
  }

  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: config.forcePathStyle,
  });

  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
    }),
  );
  if (!response.Body) {
    return null;
  }
  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}
