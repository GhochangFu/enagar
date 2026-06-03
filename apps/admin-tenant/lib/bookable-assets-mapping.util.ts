/** Keep only codes that exist in Operations → Bookings (ignore catalogue/seed placeholders). */
export function resolveBookableAssetCodesForMapping(
  requested: string[],
  assets: Array<{ code: string }>,
): string[] {
  const known = new Set(assets.map((asset) => asset.code));
  return [
    ...new Set(requested.map((code) => code.trim()).filter((code) => code && known.has(code))),
  ];
}

export function bookableAssetCodesMissingFromDb(
  requested: string[],
  assets: Array<{ code: string }>,
): string[] {
  const known = new Set(assets.map((asset) => asset.code));
  return [
    ...new Set(requested.map((code) => code.trim()).filter((code) => code && !known.has(code))),
  ];
}
