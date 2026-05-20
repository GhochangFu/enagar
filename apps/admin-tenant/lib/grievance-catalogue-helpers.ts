export type GrievanceSubtypeRow = {
  id: string;
  code: string;
  name: unknown;
  sort_order: number;
  is_active: boolean;
};

/** Only show subtype rows when they were loaded for the currently selected category. */
export function subtypesVisibleForCategory(
  selectedCode: string | null,
  loadedForCode: string | null,
  subtypes: GrievanceSubtypeRow[],
): GrievanceSubtypeRow[] {
  if (!selectedCode || loadedForCode !== selectedCode) {
    return [];
  }
  return subtypes;
}
