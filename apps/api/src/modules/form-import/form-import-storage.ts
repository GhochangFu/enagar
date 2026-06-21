import { randomUUID } from 'node:crypto';

/** EN-43 — tenant-scoped object keys for municipal form-import source files. */
export function buildTenantFormImportObjectKey(
  tenantCode: string,
  serviceId: string,
  originalFilename: string,
  jobId = randomUUID(),
): string {
  const code = tenantCode.trim().toLowerCase();
  const safeName = sanitizeFilename(originalFilename);
  return `tenants/${code}/form-import/${serviceId}/${jobId}/${safeName}`;
}

/** EN-43 — state-scoped object keys for global template form-import source files. */
export function buildStateFormImportObjectKey(
  serviceCode: string,
  originalFilename: string,
  jobId = randomUUID(),
): string {
  const code = serviceCode.trim().toLowerCase();
  const safeName = sanitizeFilename(originalFilename);
  return `state/form-import/${code}/${jobId}/${safeName}`;
}

function sanitizeFilename(originalFilename: string): string {
  const base = originalFilename.split(/[/\\]/).pop()?.trim() || 'upload.bin';
  const cleaned = base.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 180);
  return cleaned.length > 0 ? cleaned : 'upload.bin';
}
