# Web installable app — Citizen PWA

**Host (pilot):** per environment — e.g. `https://app.enagarseba.wb.gov.in`  
**Manifest:** generated from `apps/citizen-pwa/app/manifest.ts`  
**Service worker:** `apps/citizen-pwa/public/sw.js` (minimal lifecycle — extend for offline harder later)

## Listing notes

- **Name:** eNagarSeba Citizen
- **Description:** Installable citizen portal for municipal services across pinned West Bengal ULBs — applications, payments (stub/demo environments), and grievances.
- **Screenshots:** capture hub, workspace services, grievance detail, application dossier.
- **Web Push:** requires `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + API `POST /citizen/notifications/push-token` (see Sprint 5.4 runbook).

## Deep links (query)

- `?grievance=<uuid|grievance_no>` — opens **Grievances** tab and detail (session required).
- `?application=<docket>` — opens **My Applications** and dossier (session required).
