# Phase 1 Auth ZAP Scan

## Status

Passed on 2026-05-07 after Docker Desktop was started.

Latest result:

```text
FAIL-NEW: 0  FAIL-INPROG: 0  WARN-NEW: 0  WARN-INPROG: 0  INFO: 0  IGNORE: 0  PASS: 119
```

## How To Run

Start the API first:

```powershell
pnpm --filter @enagar/api dev
```

Then run:

```powershell
pnpm security:zap:auth
```

Expected outputs:

- `docs/security/zap/phase-1-auth-zap.html`
- `docs/security/zap/phase-1-auth-zap.json`

Phase 1 exit criterion is satisfied when the scan completes with no high or critical findings.
