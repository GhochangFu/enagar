# @enagar/i18n — STUB (Phase 2)

Translation runtime. v1 ships **English / Bengali / Hindi** (the same set the prototype demonstrates).

- Strings live as JSON files per locale under `src/locales/`
- ICU MessageFormat for plurals/genders/dates
- Type-safe keys (`t('home.title')`) generated from the source JSON
- Runtime fallback chain: requested → tenant default → English

## Status

Phase-0 stub. Locale enum + default already exported so other scaffolds can reference them. Implementation in Phase 2.
