export type ObjectStorageConfig = {
  disabled: boolean;
  endpoint: string;
  publicEndpoint: string;
  /** Browser/CDN base for public object URLs (defaults to public endpoint). */
  publicBase: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  forcePathStyle: boolean;
};

const DEFAULT_BUCKET = 'enagar-local';
const DEFAULT_REGION = 'us-east-1';

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

/** Resolve object-storage settings from process env (merged with infrastructure/.env in dev). */
export function loadObjectStorageConfig(env: NodeJS.ProcessEnv = process.env): ObjectStorageConfig {
  const accessKey = env.OBJECT_STORAGE_ACCESS_KEY?.trim() || env.MINIO_ROOT_USER?.trim() || '';
  const secretKey = env.OBJECT_STORAGE_SECRET_KEY?.trim() || env.MINIO_ROOT_PASSWORD?.trim() || '';
  const endpoint =
    env.OBJECT_STORAGE_ENDPOINT?.trim() ||
    (env.MINIO_API_PORT ? `http://127.0.0.1:${env.MINIO_API_PORT.trim()}` : '');
  const publicEndpoint = env.OBJECT_STORAGE_PUBLIC_ENDPOINT?.trim() || endpoint;
  const publicBase = env.OBJECT_STORAGE_PUBLIC_BASE?.trim() || publicEndpoint;
  const disabledExplicit = env.OBJECT_STORAGE_DISABLED?.trim();
  const disabled =
    disabledExplicit !== undefined && disabledExplicit !== ''
      ? readBoolean(disabledExplicit, true)
      : !endpoint || !accessKey || !secretKey;

  return {
    disabled,
    endpoint,
    publicEndpoint,
    publicBase,
    bucket: env.OBJECT_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET,
    accessKey,
    secretKey,
    region: env.OBJECT_STORAGE_REGION?.trim() || DEFAULT_REGION,
    forcePathStyle: readBoolean(env.OBJECT_STORAGE_FORCE_PATH_STYLE, true),
  };
}

export function isObjectStorageRuntimeEnabled(config: ObjectStorageConfig): boolean {
  return !config.disabled && Boolean(config.endpoint && config.accessKey && config.secretKey);
}
