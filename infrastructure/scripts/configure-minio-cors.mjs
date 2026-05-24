/**
 * Ensure the dev object-storage bucket exists and apply CORS when the server supports it.
 *
 * MinIO RELEASE.2024-08 may return 501 on PutBucketCors — global CORS is set in
 * docker-compose via MINIO_API_CORS_ALLOW_ORIGIN (recreate the minio container after edits).
 *
 * Usage: pnpm infra:minio-cors
 */
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMinioCorsOrigins } from '../unified-portal/cors-origins.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(scriptDir, '..', '.env');

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!(key in process.env)) {
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
}

loadEnvFile(envPath);

const endpoint =
  process.env.OBJECT_STORAGE_ENDPOINT ??
  `http://127.0.0.1:${process.env.MINIO_API_PORT ?? '9000'}`;
const bucket = process.env.OBJECT_STORAGE_BUCKET ?? 'enagar-local';
const accessKey =
  process.env.OBJECT_STORAGE_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? 'enagar_admin';
const secretKey =
  process.env.OBJECT_STORAGE_SECRET_KEY ??
  process.env.MINIO_ROOT_PASSWORD ??
  'minio_dev_pw_change_me';

const client = new S3Client({
  endpoint,
  region: process.env.OBJECT_STORAGE_REGION ?? 'us-east-1',
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  forcePathStyle: true,
});

let bucketExists = false;
try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  bucketExists = true;
} catch {
  bucketExists = false;
}

if (!bucketExists) {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  // eslint-disable-next-line no-console
  console.log(`Created MinIO bucket "${bucket}" at ${endpoint}`);
} else {
  // eslint-disable-next-line no-console
  console.log(`MinIO bucket "${bucket}" already exists at ${endpoint}`);
}

try {
  const allowedOrigins = resolveMinioCorsOrigins(process.env);
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedOrigins: allowedOrigins,
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  // eslint-disable-next-line no-console
  console.log(`Bucket-level CORS configured on "${bucket}" for: ${allowedOrigins.join(', ')}`);
} catch (error) {
  const code =
    error && typeof error === 'object' && 'Code' in error ? String(error.Code) : '';
  if (code === 'NotImplemented' || code === 'NotImplementedException') {
    // eslint-disable-next-line no-console
    console.warn(
      `PutBucketCors not supported by this MinIO build — using global CORS from docker-compose (MINIO_API_CORS_ALLOW_ORIGIN).`,
    );
    // eslint-disable-next-line no-console
    console.warn(
      'If browser uploads still fail, recreate MinIO: pnpm infra:up -d minio  (or docker compose ... up -d minio)',
    );
  } else {
    throw error;
  }
}
