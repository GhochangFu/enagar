import { messages, type Locale, type MessageKey, t } from '@enagar/i18n';

import type {
  GrievanceCatalogueCategory,
  GrievanceCatalogueResponse,
  GrievanceCatalogueSubtype,
  LocalizedName,
} from './types.js';

export function pickLocalizedName(name: LocalizedName, locale: Locale): string {
  const primary = locale === 'bn' ? name.bn : locale === 'hi' ? name.hi : name.en;
  const trimmed = (primary ?? name.en ?? '').trim();
  return trimmed.length > 0 ? trimmed : (name.en ?? '').trim();
}

function legacyCategoryKey(code: string): MessageKey | null {
  const candidates = [`grievance.cat.${code}`, `grievance.cat.${code.replace(/-/g, '_')}`] as const;
  for (const key of candidates) {
    if (key in messages.en) {
      return key as MessageKey;
    }
  }
  return null;
}

/** Resolve display label: API name → legacy i18n → raw code. */
export function resolveGrievanceCategoryLabel(
  code: string,
  name: LocalizedName | undefined,
  locale: Locale,
): string {
  if (name) {
    const fromApi = pickLocalizedName(name, locale);
    if (fromApi) {
      return fromApi;
    }
  }
  const legacyKey = legacyCategoryKey(code);
  if (legacyKey) {
    return t(legacyKey, locale);
  }
  return code;
}

export function resolveGrievanceSubtypeLabel(
  subtype: GrievanceCatalogueSubtype | undefined,
  locale: Locale,
): string | null {
  if (!subtype) {
    return null;
  }
  const fromApi = pickLocalizedName(subtype.name, locale);
  return fromApi || subtype.code;
}

export function categoryLabelFromCatalogue(
  catalogue: GrievanceCatalogueResponse | null | undefined,
  categoryCode: string,
  locale: Locale,
): string {
  const row = catalogue?.categories.find((c) => c.code === categoryCode);
  return resolveGrievanceCategoryLabel(categoryCode, row?.name, locale);
}

export function subtypeLabelFromCatalogue(
  catalogue: GrievanceCatalogueResponse | null | undefined,
  categoryCode: string,
  subtypeCode: string | null | undefined,
  locale: Locale,
): string | null {
  if (!subtypeCode?.trim()) {
    return null;
  }
  const category = catalogue?.categories.find((c) => c.code === categoryCode);
  const subtype = category?.subtypes.find((s) => s.code === subtypeCode);
  return resolveGrievanceSubtypeLabel(subtype, locale);
}

export function sortCatalogueCategories(
  categories: GrievanceCatalogueCategory[],
): GrievanceCatalogueCategory[] {
  return [...categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code),
  );
}
