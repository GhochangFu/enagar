# ADR-0009 — Identity provider: Keycloak (self-hosted) for citizen + operator authentication

| Field               | Value                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Status**          | Accepted                                                                                                        |
| **Date**            | 2026-05-06                                                                                                      |
| **Decision-makers** | Project Technical Lead                                                                                          |
| **Related**         | ADR-0001 (Postgres), ADR-0002 (NestJS), ADR-0003 (PWA + RN), ADR-0005 (On-prem hosting), ADR-0008 (LLM adapter) |

## Context

Phase 1 implements the identity layer of eNagarSeba. The platform must authenticate **two very different populations**:

1. **Citizens** (millions of mostly-passwordless users on slow networks) — primary factor is **mobile + OTP**, with optional **DigiLocker** for verified-document fetch and (eventually) verified-citizen status.
2. **Operators** (state super-admins, tenant admins, ULB officers, field staff) — must use **MFA-enforced** logins with role-based and ward-scoped access.

Cross-cutting requirements include:

- **Multi-tenancy**: every issued token must carry the `tenant_id` claim; tenant Admins must be unable to authenticate against another tenant's surface.
- **OIDC compliance**: NestJS `passport-jwt` + a public JWKS endpoint; PKCE for the React Native app; standard scopes/claims; Server-Sent-Events compatibility (Sahayak streaming).
- **On-prem**: per ADR-0005 the platform is hosted in the WB SDC. Citizen PII (including hashed credentials) must not leave India.
- **Open-source / sovereignty**: aligns with the platform pillars defined in `AGENT.md` §2.
- **Operational reality**: a single solo developer (per ratified team-shape) cannot maintain bespoke auth code across five clients — the IDP must do the heavy lifting.
- **Long-term integrations** (Phase 1+): DigiLocker (OAuth2), DDM-WB single-sign-on for operators (planned), MeitY UIDAI hooks, future state-CCA-issued certificates.

This ADR locks the IDP **before Phase 1 starts**, because every other Phase-1 deliverable (RLS context, tenant guard, citizen registration, DigiLocker integration, MFA enrolment, password resets, audit log) wires through it.

## Decision

**We adopt [Keycloak](https://www.keycloak.org/) (self-hosted, version 24+) as the sole identity provider for eNagarSeba.**

Specifically:

1. **Realm topology**: a single global realm `enagar` with **client-per-app** (citizen-pwa, citizen-rn, admin-tenant, admin-state, staff-mobile) and **roles** that include `tenant_id` as a claim mapper. We **do not** create one realm per ULB — that scales linearly with tenants and breaks the cross-tenant operator path. Tenant isolation is enforced via the `tenant_id` token claim + Postgres RLS, not realm separation.
2. **Citizen flow**: Keycloak's _Direct Grant_ + custom _OTP authenticator_ (Phase 1 Sprint 1.1). No password storage for citizens. DigiLocker is wired as a Keycloak _Identity Provider_ (OIDC broker) for verified-document fetch and account linking (Phase 1 Sprint 1.4).
3. **Operator flow**: Standard authorization-code + PKCE; MFA mandatory (TOTP for v1, WebAuthn / hardware-key in Phase 6 for state-admins).
4. **Token claims** issued in the access JWT:
   - `sub` (Keycloak user UUID)
   - `tenant_id` (custom mapper)
   - `tenant_code` (custom mapper, for human-readable logs)
   - `role` (`citizen` / `field_staff` / `officer:<dept>` / `tenant_admin` / `state_admin`)
   - `ward_id?` (for officers and field staff)
   - standard `iss`, `aud`, `exp`, `iat`, `jti`

   **API synonym handling (@enagar/api, Hub H5.1):** Some gateways/templates emit **`tenantId`** / **`tenantCode`**. `@enagar/api` accepts those **only when** they carry the **same semantics** as the snake_case claims (`resolveEnagarTenantFromJwtPayload` in `apps/api/src/common/auth/enagar-jwt-tenant-resolver.ts`). Canonical mapper output SHOULD remain **`tenant_id`** / **`tenant_code`**. If both snake and camel are present **and disagree**, verification returns **401**.

5. **Token lifetimes**: access 15 min, refresh 24 h (citizen) / 8 h (operator). Refresh-token rotation enabled. JWKS cached for 5 min in NestJS.
6. **High availability**: Keycloak deployed as **2+ pods** with shared Postgres (the same Postgres cluster from ADR-0001, in a dedicated `keycloak` schema). Distributed cache via Infinispan.

## Alternatives considered

| Option                                                                   | Pros                                                                                          | Cons                                                                                                                                                                                            | Rejected because                                                                                                                         |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Ory Hydra + Kratos + Keto** (decoupled OAuth + identity + permissions) | Cleanest separation of concerns; lightweight individual services; good docs; strong API-first | Three services to operate; less out-of-the-box admin UI; OTP / DigiLocker / MFA flows must be coded against Kratos hooks; smaller community than Keycloak                                       | Operational cost too high for solo dev; Keycloak's batteries-included posture wins for our team size                                     |
| **AWS Cognito / Azure AD B2C / Auth0 / Okta** (managed cloud IdP)        | Zero ops; mature OTP, MFA, social login; auto-scaling; managed JWKS                           | (a) Cross-border PII processing, **directly violates DPDP Act 2023 + ADR-0005's on-prem mandate** for citizen data; (b) recurring vendor cost; (c) ULB-rejection risk                           | Sovereignty constraint is hard; storage of citizen credentials must stay in India                                                        |
| **MOSIP / Aadhaar Authentication API as primary IdP**                    | Aligns with India Stack vision; no second password to remember                                | (a) Onboarding to Aadhaar Auth requires UIDAI ASA/AUA approvals; (b) every login becomes a state-API call (not appropriate for high-frequency operator flows); (c) MOSIP is heavy for our scale | Keycloak + DigiLocker covers verified-citizen requirement; Aadhaar Auth can be added as a Keycloak IdP-broker if/when ASA approval lands |
| **Custom NestJS auth (JWT + bcrypt + custom OTP)**                       | Full control; no third dependency to learn                                                    | Solo dev rebuilds known-secure primitives (password reset, MFA, account lockout, JWKS rotation, refresh-token revocation, OIDC discovery); high security risk                                   | Re-implementing OIDC is a known anti-pattern; security-debt cost dwarfs the learning curve of Keycloak                                   |
| **DigiLocker as primary IdP** (citizen-only)                             | Verified citizens out of the box; no OTP cost                                                 | (a) Excludes citizens who don't have / can't use DigiLocker (millions); (b) doesn't authenticate operators; (c) DigiLocker rate limits                                                          | Only viable as an _optional broker_, which Keycloak supports natively                                                                    |
| **FreeIPA / 389-DS**                                                     | LDAP-rooted, mature for back-office                                                           | Not OIDC-first; building citizen flows on top of LDAP is awkward                                                                                                                                | Wrong primitive for a primarily-mobile citizen base                                                                                      |

## Consequences

### Positive

- **One IdP, five clients.** Each app (citizen-pwa, mobile, admin-tenant, admin-state, staff-mobile) gets its own OIDC client with the right grant flow; the API verifies a single JWT shape.
- **OTP, MFA, password-reset, account-lockout, JWKS rotation** are all configuration, not code.
- **DigiLocker integration cost is a Keycloak Identity-Provider config**, not a custom OAuth implementation in the API.
- **Audit out of the box.** Keycloak's event listener stream feeds our audit log without us instrumenting login flows manually.
- **Realm export / import** lets us version-control the auth configuration in Git — `infrastructure/keycloak/realm-export.json` (Phase 1).
- **Sovereignty preserved.** Keycloak runs in the WB SDC, against the on-prem Postgres. No PII leaves India for the auth path.

### Negative / costs

- **Operational footprint.** Keycloak is a Java service (~512 MB baseline RAM per pod). HA deployment needs ≥ 2 pods + Postgres + Infinispan cache. Manageable but not trivial for solo dev — runbook is a Phase 1 deliverable.
- **Custom OTP authenticator** required (a Keycloak SPI in Java/JS) since the built-in SMS authenticator doesn't speak MSG91. Estimated 3-5 days build + tests in Phase 1 Sprint 1.1.
- **Theme work** required for the brand-faithful login screen — Keycloak themes are FreeMarker, not React. Estimated 2 days in Phase 1 Sprint 1.2.
- **Upgrade cadence.** Keycloak's major releases break non-trivially; we lock to a minor version and follow the LTS upgrade path (~yearly).
- **JWT-claim contract leakage.** Adding a new claim is a Keycloak-mapper change _and_ a NestJS guard change _and_ an SDK type bump — ergonomic discipline matters.

### Neutral / follow-ups required

- **Phase 1 Sprint 1.0**: Keycloak deployed via Helm in the dev infra docker-compose (`infrastructure/docker-compose.yml`); realm `enagar` defined in `infrastructure/keycloak/realm-export.json`; admin password sealed.
- **Phase 1 Sprint 1.1**: Custom MSG91-OTP authenticator SPI; OTP rate-limit policy (5 / hour / mobile, 20 / hour / IP, 200 / minute / global).
- **Phase 1 Sprint 1.2**: Citizen + operator login themes (KMC default + per-tenant brand override).
- **Phase 1 Sprint 1.3**: NestJS `JwtAuthGuard` + `TenantContextGuard` + `RolesGuard` wired against the JWKS endpoint with 5-minute key caching.
- **Phase 1 Sprint 1.4**: DigiLocker as a Keycloak Identity Provider (OIDC); citizen account linking; document-fetch flow.
- **Phase 1 Sprint 1.5**: TOTP MFA enforcement for all operator roles; recovery codes; MFA enrolment screen.
- **Phase 6**: WebAuthn / hardware-key for state-admins; risk-based step-up for sensitive citizen actions (mutation, fee waiver).
- **Operational runbook** (`docs/runbooks/keycloak.md`) by Phase 1 close: backup, restore, key rotation, realm-export drift detection — **see runbook** for H5.1 bootstrap and role parity.

## Compliance / verification

- **CI gate** (Phase 1+): `infrastructure/keycloak/realm-export.json` is the source of truth; CI fails if the deployed realm drifts (script compares export with running config in dev).
- **CI security tests**: every Phase-1 security test in `tests/security/` and `apps/api/test/` validates the JWT contract — forged tokens, expired tokens, modified claims, missing `tenant_id` all return 401 (see `docs/security/threat-model.md` §7.2).
- **Operator MFA gate**: a pre-deploy check refuses to promote a build if any role in the realm-export marks `otp_required = false` for `state_admin`, `tenant_admin`, or `officer:*`.
- **Quarterly key rotation**: documented runbook; Trivy / dependabot keep the Keycloak base image patched.
- **Audit pipeline**: Keycloak event listener → BullMQ → `audit_log` rows; coverage verified by an integration test.

## References

- `docs/runbooks/keycloak.md` — **Hub H5.1** operator bootstrap, realm export, role/API parity, staging smoke pointers.
- `AGENT.md` §2 — Pillar 1 (Sovereign by default for storage), Pillar 6 (Open-source mandate).
- `ARCHITECTURE.md` §3 — Open-source stack rationale: "Keycloak — Citizen identity, OIDC, MFA, RBAC; DigiLocker integration via OIDC broker."
- `ARCHITECTURE.md` §6 — Security & compliance: MFA, JWT lifetimes, audit log requirements.
- `docs/security/threat-model.md` §4.6 — Keycloak STRIDE pass.
- `docs/glossary.md` §3 — Identity terms (JWT claim, RLS, MFA, OTP, DigiLocker).
- Keycloak documentation — <https://www.keycloak.org/documentation>
- DigiLocker OAuth2 docs — <https://digilocker.gov.in/oauth2/2/docs>
- DPDP Act 2023 — <https://www.meity.gov.in/data-protection-framework>
