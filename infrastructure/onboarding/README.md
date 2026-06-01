# Tenant org onboarding import (Phase 14)

State wizard **Activate municipality** / **Apply onboarding** loads the default org pack from the API (`DEFAULT_TENANT_ORG_IMPORT` in `apps/api/src/modules/tenant-org-onboarding/tenant-org-onboarding.data.ts`).

## Payload shape

```json
{
  "version": 1,
  "departments": [
    {
      "code": "public-works",
      "name": { "en": "Public Works Department", "bn": "...", "hi": "..." },
      "sort_order": 10
    }
  ],
  "designations": [
    {
      "code": "pwd_executive_engineer",
      "name": { "en": "Executive Engineer", "bn": "...", "hi": "..." },
      "scope": "department",
      "department_code": "public-works",
      "is_department_head": true
    },
    {
      "code": "chairperson",
      "name": { "en": "Chairperson", "bn": "...", "hi": "..." },
      "scope": "municipality",
      "can_reject_municipal": true
    }
  ]
}
```

## Custom pilot ULB

1. Export or copy the bundled default from `tenant-org-onboarding.data.ts`.
2. Save as e.g. `infrastructure/onboarding/pilot-ulb.import.json`.
3. Set `TENANT_ORG_IMPORT_PATH=/absolute/path/to/pilot-ulb.import.json` on the API before activate.

Upserts are **idempotent** — re-onboard safe.

## Default contents

- **24 departments** — Appendix A (`docs/workflow-designations.md`)
- **47 designations** — Appendix B sample roles + municipal ladder + hoarding pilot roles

Verify: `pnpm smoke:phase14-org`
