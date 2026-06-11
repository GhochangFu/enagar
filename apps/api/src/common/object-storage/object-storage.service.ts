import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  isObjectStorageRuntimeEnabled,
  loadObjectStorageConfig,
  type ObjectStorageConfig,
} from './object-storage.config';

export type ObjectStorageSignedUrl = {
  url: string;
  expires_at: string;
};

export type ObjectStorageHeadResult = {
  content_length: number;
  content_type: string | null;
};

const DEFAULT_UPLOAD_TTL_MS = 15 * 60 * 1000;
const DEFAULT_DOWNLOAD_TTL_MS = 5 * 60 * 1000;
const STUB_BUCKET = 'enagar-local';

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly config: ObjectStorageConfig;
  private client: S3Client | null = null;
  private bucketReady = false;

  constructor() {
    this.config = loadObjectStorageConfig();
  }

  isEnabled(): boolean {
    return isObjectStorageRuntimeEnabled(this.config);
  }

  getBucket(): string {
    return this.config.bucket;
  }

  /** Path-style public URL for branding/CDN (bucket + key under public base). */
  buildPublicObjectUrl(objectKey: string): string {
    this.assertSafeObjectKey(objectKey);
    const base = this.config.publicBase.replace(/\/+$/, '');
    const key = objectKey.trim();
    if (this.config.forcePathStyle) {
      return `${base}/${this.config.bucket}/${key}`;
    }
    return `${base}/${key}`;
  }

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.log('Object storage disabled — using minio:// stub URLs for upload/download');
      return;
    }

    this.client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKey,
        secretAccessKey: this.config.secretKey,
      },
      forcePathStyle: this.config.forcePathStyle,
    });

    await this.ensureBucket();
  }

  /** Reject path traversal and control characters in object keys. */
  assertSafeObjectKey(objectKey: string): void {
    const key = objectKey.trim();
    if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
      throw new BadRequestException('Invalid object key');
    }
    for (let i = 0; i < key.length; i += 1) {
      if (key.charCodeAt(i) < 0x20) {
        throw new BadRequestException('Invalid object key');
      }
    }
  }

  /** Keys must be under `tenants/{tenantCode}/` (case-insensitive tenant segment). */
  assertTenantObjectKey(objectKey: string, tenantCode: string): void {
    this.assertSafeObjectKey(objectKey);
    const code = tenantCode.trim().toLowerCase();
    if (!code) {
      throw new BadRequestException('Invalid tenant code');
    }
    const prefix = `tenants/${code}/`;
    if (!objectKey.trim().toLowerCase().startsWith(prefix)) {
      throw new BadRequestException('object_key must be tenant-prefixed');
    }
  }

  async presignUpload(
    objectKey: string,
    contentType: string,
    ttlMs = DEFAULT_UPLOAD_TTL_MS,
    referenceTime = new Date(),
  ): Promise<ObjectStorageSignedUrl> {
    this.assertSafeObjectKey(objectKey);
    if (!this.isEnabled() || !this.client) {
      return this.stubSignedUrl('upload', objectKey, referenceTime, ttlMs);
    }

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: Math.ceil(ttlMs / 1000) });
    return {
      url,
      expires_at: new Date(referenceTime.getTime() + ttlMs).toISOString(),
    };
  }

  async presignDownload(
    objectKey: string,
    ttlMs = DEFAULT_DOWNLOAD_TTL_MS,
    referenceTime = new Date(),
  ): Promise<ObjectStorageSignedUrl> {
    this.assertSafeObjectKey(objectKey);
    if (!this.isEnabled() || !this.client) {
      return this.stubSignedUrl('download', objectKey, referenceTime, ttlMs);
    }

    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: objectKey,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: Math.ceil(ttlMs / 1000) });
    return {
      url,
      expires_at: new Date(referenceTime.getTime() + ttlMs).toISOString(),
    };
  }

  async headObject(objectKey: string): Promise<ObjectStorageHeadResult | null> {
    this.assertSafeObjectKey(objectKey);
    if (!this.isEnabled() || !this.client) {
      return null;
    }

    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: objectKey,
        }),
      );
      return {
        content_length: Number(response.ContentLength ?? 0),
        content_type: response.ContentType ?? null,
      };
    } catch (error: unknown) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      if (status === 404) {
        return null;
      }
      throw error;
    }
  }

  async putObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    this.assertSafeObjectKey(objectKey);
    if (!this.isEnabled() || !this.client) {
      this.logger.log(
        `[stub] putObject key=${objectKey} bytes=${body.byteLength} type=${contentType}`,
      );
      return;
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObjectBuffer(objectKey: string): Promise<Buffer | null> {
    this.assertSafeObjectKey(objectKey);
    if (!this.isEnabled() || !this.client) {
      return null;
    }

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }),
    );
    if (!response.Body) {
      return null;
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  private stubSignedUrl(
    action: 'upload' | 'download',
    objectKey: string,
    referenceTime: Date,
    ttlMs: number,
  ): ObjectStorageSignedUrl {
    const expiresAt = new Date(referenceTime.getTime() + ttlMs).toISOString();
    const url = `minio://${STUB_BUCKET}/${objectKey}?action=${action}&expires_at=${encodeURIComponent(expiresAt)}`;
    return { url, expires_at: expiresAt };
  }

  private async ensureBucket(): Promise<void> {
    if (!this.client || this.bucketReady) {
      return;
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      this.bucketReady = true;
      return;
    } catch {
      /* create below */
    }

    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
      this.logger.log(`Created object storage bucket "${this.config.bucket}"`);
      this.bucketReady = true;
    } catch (error: unknown) {
      this.logger.warn(
        `Could not ensure bucket "${this.config.bucket}" — uploads may fail until the bucket exists`,
      );
      this.logger.debug(error);
    }
  }
}
