# Sprint 8.5B+ — Hoarding tax wired to deferred approval payment

**Goal:** Collect **permission fee + calculator hoarding tax** as one **approval** payment when desk issues the payment link.

| Component | Change |
| --------- | ------ |
| `hoarding-approval-fee.util.ts` | Breakdown: base + `tax_paise` → `total_approval_paise` |
| `applications.service` | On draft create + submit, set `fee_settlement.approval.amount_paise` |
| `fee-settlement.util` | `resolvePayableFeeLineAmountPaise` prefers settlement amount |
| `payments.service` | Desk link + citizen initiate use settlement amount |
| Desk / PWA | Show breakdown (permission + hoarding tax = total) |

**Edge cases:** No snapshot → approval fee unchanged. Invalid snapshot → ignore tax. Overflow guard on sum.
