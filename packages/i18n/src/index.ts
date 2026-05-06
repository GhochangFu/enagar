// Phase-0 placeholder. Phase 2 imports the existing translation map from
// `MunicipalApp.jsx` (the prototype), restructures it into ICU MessageFormat,
// and adds runtime helpers `t(key, vars, locale)` and `useTranslation()`.

export type Locale = 'en' | 'bn' | 'hi';

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ['en', 'bn', 'hi'];
export const DEFAULT_LOCALE: Locale = 'en';
