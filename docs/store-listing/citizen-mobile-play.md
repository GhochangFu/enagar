# Play Store — Citizen app (Expo)

**Package:** `in.wb.enagarseba.citizen`  
**Track:** internal testing → production (pilot)

## Listing (en)

- **Title:** eNagarSeba Citizen
- **Short description:** Municipal services, applications, payments, and grievances for West Bengal citizens.
- **Full description:** eNagarSeba Citizen lets you browse ULB services, submit applications, pay fees (where enabled), and track grievances with SLA visibility. Built for the eNagarSeba pilot; sign in with mobile OTP.
- **Keywords:** municipal, West Bengal, ULB, grievance, birth certificate, property tax

## Data safety (draft bullets)

- Collects mobile number for OTP authentication.
- Optional push token for service alerts (disabled until notification backend is live in your environment).
- No sale of personal data; operational use only under programme policy.

## Deep links

- Custom scheme: `enagarseba://` (see `apps/mobile/app.json` `scheme`).
- Associated domains: configure after pilot host is final.
