# @enagar/types

Shared **domain types** consumed by every workspace member.

## Status

Scaffolded in Phase 0. Filled out incrementally:

| Phase | Adds                                                             |
| ----- | ---------------------------------------------------------------- |
| 0     | `Tenant`, `TenantConfig`, `ILLMProvider` (ADR-0008 contract)     |
| 1     | `Citizen`, `Ward`, `Address`, `JWTClaims`                        |
| 2     | `Service`, `ServiceCategory`, `Application`, `Workflow`, `Stage` |
| 3     | `Payment`, `Deposit`, `Challan`, `Receipt`                       |
| 4     | `Grievance`, `SLAPolicy`                                         |
| 7     | `RAGContext`, `KBArticle`                                        |

## Rules

- **No runtime code.** Types only — no classes with bodies, no const objects.
- **No imports from other workspace packages.** Types are leaves of the dependency graph.
- **No `any`.** If something is genuinely unknown, use `unknown`.
