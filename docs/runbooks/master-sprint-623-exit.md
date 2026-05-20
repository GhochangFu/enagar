# Master Sprint 6.23 Exit — Citizen Grievance Catalogue (PWA + Mobile)

**Status:** **closed — engineering** (2026-05-20)  
**Plan:** [`master-sprint-623-plan.md`](./master-sprint-623-plan.md) · **Prerequisite:** Sprint **6.21** closed; **6.22** closed

## Engineering checklist

| ID  | Criterion                                   | Pass | Evidence                                                                                                                                                                      |
| --- | ------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | PWA files with API-only categories          | ✅   | `grievances-workspace.tsx` uses `fetchPublicGrievanceCatalogue`; no `GRIEVANCE_CATEGORY_CODES`                                                                                |
| E2  | Mobile parity on device/emulator            | ✅   | Expo web `:8081` smoke **2026-05-20**: login `9836177767` → KMC → **Broken streetlight** → **Lamp out** → `GRV-KMC-2026-000017` with labels **Broken streetlight · Lamp out** |
| E3  | Deactivated category hidden in picker       | ✅   | API returns active catalogue only (`getActiveCatalogue`)                                                                                                                      |
| E4  | Subtype required when category has subtypes | ✅   | PWA + mobile block submit / redirect to subtype step                                                                                                                          |
| E5  | Offline draft stores codes                  | ✅   | `subtype_slug` in mobile draft envelope                                                                                                                                       |
| E6  | CI + `master-sprint-623.spec.ts`            | ✅   | Security spec + `lib/grievance-catalogue-filing.spec.ts`                                                                                                                      |

## Evidence

### Mobile web (`http://localhost:8081/login`)

1. OTP login (dev `12345`).
2. Hub → **Grievances** → **File a grievance** → **Kolkata Municipal Corporation (KMC)**.
3. Category grid includes admin-defined **Broken streetlight** (from 6.22 catalogue).
4. Subtype step: **Lamp out** / **Pole damaged**.
5. Submit → list at `/grievances` (KMC scope): **`GRV-KMC-2026-000017`** — **Broken streetlight · Lamp out**.

### PWA + Desk (prior smoke)

- PWA `:3000` filed `GRV-KMC-2026-000016`; Desk closed as municipality admin.

### Automated

```bash
pnpm test:security -- --runTestsByPath tests/security/master-sprint-623.spec.ts
pnpm --filter @enagar/admin-tenant test   # catalogue helper guard
scripts/sprint-623-mobile-smoke.ps1       # API leg + manual UI checklist
```

## Sign-off

| Role        | Initials | Date       |
| ----------- | -------- | ---------- |
| Engineering | —        | 2026-05-20 |
