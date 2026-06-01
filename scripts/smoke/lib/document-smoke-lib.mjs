/**
 * Upload + scan-clean a required document for smoke tests.
 * Requires ALLOW_CLIENT_SCAN_SIMULATION=true (default in dev) or confirm-upload path.
 */
export async function uploadCleanDocument(api, assertOk, token, applicationId, options) {
  const {
    documentCode,
    mimeType = 'application/pdf',
    originalName = `${documentCode}.pdf`,
    scanProvider = 'smoke',
    tenantCode,
  } = options;

  const headers = tenantCode ? { 'x-enagar-tenant-code': tenantCode } : {};
  const { res: intentRes, json: intent } = await api(
    'POST',
    '/documents/upload-intent',
    token,
    {
      application_id: applicationId,
      document_code: documentCode,
      original_name: originalName,
      mime_type: mimeType,
      size_mb: 0.01,
    },
    headers,
  );
  assertOk('upload-intent', intentRes.status, JSON.stringify(intent));

  if (process.env.ALLOW_CLIENT_SCAN_SIMULATION !== 'true') {
    const { res: confirmRes, text: confirmText } = await api(
      'POST',
      `/documents/${intent.id}/confirm-upload`,
      token,
      undefined,
      headers,
    );
    assertOk('confirm-upload', confirmRes.status, confirmText);
  }

  const { res: scanRes, text: scanText } = await api(
    'POST',
    `/documents/${intent.id}/scan-result`,
    token,
    { scan_status: 'clean', scan_provider: scanProvider },
    headers,
  );
  assertOk('scan-result', scanRes.status, scanText);
}

export function resolveApplicationFeePaise(service, fallbackPaise) {
  const preview = service?.fee_line_previews?.application;
  if (typeof preview === 'number' && Number.isInteger(preview) && preview > 0) {
    return preview;
  }
  const rule = service?.fee_lines?.application?.rule;
  if (rule?.type === 'fixed' && typeof rule.amount_paise === 'number' && rule.amount_paise > 0) {
    return rule.amount_paise;
  }
  return fallbackPaise;
}
