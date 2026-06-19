# Master Sprint 8.5D — Digital billboard (`ad-billboard`) — DEFERRED

> **Status:** **deferred 2026-06-18** — not part of active Sprint 8.5 implementation. Catalogue entry and global service definition remain for future work.

**Parent plan:** [`master-sprint-85-plan.md`](./master-sprint-85-plan.md) § 8.5D · Jira [**EN-24**](https://ghochangfu.atlassian.net/browse/EN-24)

**Reason:** Sponsor priority — complete hoarding calculator, LED booking, and health fleet bookings (8.5E/F) before digital billboard citizen entry.

---

## Intended scope (when unpaused)

| ID  | Deliverable                   | Detail                                                                                                                                 |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **`BillboardApplyWorkspace`** | PWA Advertising → Digital Billboard → cert-issuance apply path with service-specific form.                                           |
| D2  | **Optional size slab quote**  | Pure function with size bands (small/medium/large) when tenant configures `billboard_fee_slabs`; else catalogue fixed fee.             |
| D3  | **Admin**                     | Fee slab config in tenant service override (max 10 bands).                                                                             |

**Non-goals:** Structural engineering workflow redesign.

---

## What exists today

- Global catalogue documents `ad-billboard` (`cert-issuance`, `adv` category) in [`docs/service-catalogue.md`](../service-catalogue.md).
- No dedicated PWA workspace, size slab API, or admin slab editor.

---

## Revisit when

- Advertising slice sponsor unpause after 8.5E/F + hardening close, or
- Pilot ULB requests billboard self-service before other Phase 8 backlog items.

---

_Last updated: 2026-06-18_
