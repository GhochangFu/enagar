# Threat model — eNagarSeba (Phase 0)

> **Scope:** the Phase-0 / Phase-1 architecture as described in `ARCHITECTURE.md`, the ADRs in `docs/ADRs/`, and the scaffolds committed at `77a7355`. This document is the input to the **Phase-1 security test backlog** (§7) — every test is implemented before Phase 1 closes.

> **Method:** [STRIDE](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats) per component, plus four cross-cutting passes (multi-tenancy, supply chain, AI inference, on-prem operations).

> **Cadence:** updated at the start of every phase. **Owners:** Platform Lead. **Reviewers:** DPO, sponsor.

---

## 1. Scope & non-goals

### In scope

- All citizen-facing surfaces (`apps/citizen-pwa`, `apps/mobile`).
- All operator surfaces (`apps/admin-tenant`, `apps/admin-state`, `apps/staff-mobile`).
- The API (`apps/api`), workers (`services/*`), Postgres, MinIO, Qdrant, Redis, Keycloak.
- The hosted-LLM boundary (per ADR-0008): OpenAI / Gemini.
- The on-prem deployment posture (per ADR-0005): WB SDC + DR.

### Non-goals (deliberately out of scope)

- Physical security of the WB SDC (covered by a separate state-level posture).
- Financial reconciliation between the platform and ULB treasury (Phase 3+ payment-rail work).
- Insider threat from a State Super-Admin colluding with a Tenant Admin (covered by audit trails + DPDP-mandated DPO escalation, not by code).
- Quantum-attack resistance (deferred until India's CCA mandates a post-quantum signature).

---

## 2. Trust boundaries

Each `═══` line is a trust boundary that **must** be enforced by code, not policy.

```
┌───────────────────────────── PUBLIC INTERNET ─────────────────────────────┐
│                                                                             │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                   │
│   │ Citizen PWA  │   │ Citizen RN   │   │ Operator UA  │  (untrusted)      │
│   │ (browser)    │   │ (mobile)     │   │ (any browser)│                   │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                   │
│          │ HTTPS + JWT      │                   │                            │
└──────────┼──────────────════╪═══════════════════╪════════════════════════════┘
           ▼                  ▼                   ▼
       ╔═══════════════════════════════════════════════╗ ◀── BOUNDARY 1: edge
       ║   API Gateway (TLS, WAF, rate-limit)          ║
       ║   • Validates JWT signature + tenant claim     ║
       ║   • Enforces per-tenant rate caps              ║
       ╚════════════════════╤══════════════════════════╝
                            │ mTLS (or in-cluster TLS)
       ╔════════════════════▼══════════════════════════╗ ◀── BOUNDARY 2: app
       ║   NestJS API (apps/api) + Workers              ║
       ║   • Sets RLS context per request               ║
       ║   • Owns PII redaction layer                   ║
       ╚══════╤═══════════════════╤══════════╤══════════╝
              │ Postgres wire     │ S3 API   │ HTTPS
       ╔══════▼══════════════════════╗  ╔════▼════╗  ╔══▼═════════════════╗
       ║ Postgres + RLS               ║  ║ MinIO  ║  ║ Hosted LLM boundary ║ ◀── BOUNDARY 3:
       ║ (single primary, replicated) ║  ║ (S3)   ║  ║ • OpenAI            ║   data leaving
       ╚══════════════════════════════╝  ╚════════╝  ║ • Gemini            ║   the platform
                                                      ║ • PII redacted      ║   (DPDP-critical)
                                                      ╚═════════════════════╝
       ╔═══════════════╗  ╔═══════════════╗  ╔═══════════════╗
       ║ Qdrant        ║  ║ Redis + BullMQ║  ║ Keycloak      ║
       ║ (vector KB)   ║  ║ (queue+cache) ║  ║ (IDP, ADR-9)  ║
       ╚═══════════════╝  ╚═══════════════╝  ╚═══════════════╝
                                ▲
                                │
       ╔════════════════════════╧══════════════════════╗
       ║ services/rag-indexer (Python, FastAPI)         ║
       ║   • Crawls public PDFs/CSVs (read-only)        ║
       ╚═════════════════════════════════════════════════╝
```

| #     | Boundary        | What crosses it                       | Why it's the highest-risk surface                     |
| ----- | --------------- | ------------------------------------- | ----------------------------------------------------- |
| 1     | Edge            | HTTPS-encrypted citizen requests      | Untrusted user agents, hostile networks               |
| 2     | App-server      | Authenticated, tenant-tagged requests | RLS context **must** be set or every guard fails open |
| 3     | Hosted LLM      | Prompt text + JSON-schema'd context   | PII leaving India; DPDP-critical                      |
| Cross | Tenant ↔ Tenant | (forbidden)                           | The single most expensive failure                     |

---

## 3. Asset inventory & sensitivity

| Asset                                    | Storage                                         | Sensitivity           | Encryption-at-rest          | Notes                                                        |
| ---------------------------------------- | ----------------------------------------------- | --------------------- | --------------------------- | ------------------------------------------------------------ |
| Citizen PII (name, mobile, address, DOB) | Postgres                                        | **PII**               | Postgres TDE (volume-level) | Mobile + Aadhaar last-4 are the high-value identifiers       |
| Aadhaar last-4                           | Postgres `citizens.aadhaar_last4`               | **PII**               | TDE                         | Full Aadhaar **never** persisted (DigiLocker on demand)      |
| Application content                      | Postgres `applications` + MinIO                 | **PII / regulated**   | TDE / SSE-S3                | Often contains parents' names, holdings, medical info        |
| Uploaded documents                       | MinIO                                           | **PII / regulated**   | SSE-S3 with KMS             | PAN, photos, deeds                                           |
| Generated certificates                   | MinIO                                           | **PII / regulated**   | SSE-S3 with KMS             | Citizen pulls via signed URL (TTL ≤ 5 min)                   |
| Payment receipts                         | Postgres + MinIO                                | Sensitive             | TDE / SSE-S3                | Transaction IDs, amounts                                     |
| Grievance content                        | Postgres `grievances` + MinIO photos            | Sensitive             | TDE / SSE-S3                | Photos are geotagged                                         |
| Operator credentials                     | Keycloak                                        | **Critical**          | Keycloak DB encrypted       | MFA-protected (ADR-0009)                                     |
| Tenant configuration                     | Postgres `tenants.config` JSONB                 | Internal              | TDE                         | Includes per-tenant LLM provider override                    |
| RAG knowledge-base chunks                | Qdrant                                          | Public-source-derived | At rest                     | Government documents — public, but tenant-scoped collections |
| Audit log                                | Postgres `audit_log` (append-only) + S3 archive | Critical              | TDE / SSE-S3                | Used for DPDP & RTI compliance                               |
| Service-account secrets                  | Keycloak realm + sealed-secret K8s              | **Critical**          | Sealed                      | Includes OpenAI / Gemini API keys                            |
| LLM prompt history                       | Postgres `chatbot_audit`                        | Sensitive             | TDE                         | **No raw query text** — only redacted form + hash            |

---

## 4. STRIDE per component

> Conventions:  
> **L** = likelihood (1-5), **I** = impact (1-5), **R = L × I**.  
> **Mitigation phase**: which phase delivers the listed control.  
> **Status**: ✅ done · 🟡 planned · 🔴 missing.

### 4.1 Citizen PWA / mobile (untrusted clients)

| ID   | Threat                                                                                 | Vector                                     | L   | I   | R   | Mitigation                                                                                                                                        | Phase | Status |
| ---- | -------------------------------------------------------------------------------------- | ------------------------------------------ | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| C-S1 | **Spoofing** — attacker replays a captured OTP                                         | Network sniff in cyber-cafe                | 3   | 4   | 12  | OTP single-use + 5-min expiry + 3-attempt cap; rate-limit by mobile + IP                                                                          | 1     | 🟡     |
| C-S2 | **Spoofing** — SIM-swap to receive citizen OTP                                         | Telco-side attack                          | 2   | 5   | 10  | Optional MFA enrolment for high-value services; risk-based step-up before fee waiver / mutation                                                   | 1+    | 🟡     |
| C-T1 | **Tampering** — modified mobile/PWA bundle on jailbroken device shows fake fees        | Local bundle patch                         | 3   | 3   | 9   | Server is sole source of truth for fees; client cannot self-issue receipts; cert-pinning on RN                                                    | 1     | 🟡     |
| C-T2 | **Tampering** — XSS into citizen PWA                                                   | Citizen-pasted markdown in chatbot history | 2   | 4   | 8   | DOMPurify on every citizen-rendered string; CSP `default-src 'self'`; no `dangerouslySetInnerHTML` outside the chatbot pane                       | 1, 7  | 🟡     |
| C-R1 | **Repudiation** — citizen claims they never submitted an application                   | Disputed timeline                          | 2   | 3   | 6   | Append-only `audit_log` row with IP, UA, JWT-jti, signed timestamp; receipt PDF includes hash                                                     | 1     | 🟡     |
| C-I1 | **Info disclosure** — direct-object reference to another citizen's application         | `/applications/87122` enumeration          | 4   | 5   | 20  | RLS at DB; controller checks `tenant_id` AND `citizen_id`; returns **404 not 403** to prevent existence leak                                      | 1     | 🟡     |
| C-I2 | **Info disclosure** — leak via browser history / push notification body                | Shared device                              | 3   | 3   | 9   | Notifications carry only docket numbers, never full names/Aadhaar; auto-logout after 30 min idle                                                  | 1     | 🟡     |
| C-D1 | **DoS** — flood the OTP endpoint to drain SMS budget                                   | Free-tier abuse                            | 4   | 4   | 16  | Per-mobile (5/h) + per-IP (20/h) + global (200/min) sliding-window quotas; CAPTCHA after 3 failures; SMS-vendor-side per-mobile cap               | 1     | 🟡     |
| C-E1 | **Elevation of privilege** — citizen JWT modified client-side to claim `operator` role | Token manipulation                         | 5   | 5   | 25  | RS256-signed JWTs; gateway rejects any unsigned/unsigned token; role claims **never** trusted from client; server-side role lookup keyed by `sub` | 1     | 🟡     |

### 4.2 API gateway + NestJS backend

| ID   | Threat                                            | Vector                               | L   | I   | R   | Mitigation                                                                                                                                                                  | Phase | Status                                   |
| ---- | ------------------------------------------------- | ------------------------------------ | --- | --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------- |
| A-S1 | Forged tenant header                              | `X-Tenant-Code` injected in dev mode | 5   | 5   | 25  | Header-based tenant resolution disabled in production; only JWT-claim resolution allowed; production middleware throws on header presence                                   | 1     | 🟡                                       |
| A-T1 | Mass-assignment of `tenant_id` via API body       | Sloppy controller wiring             | 4   | 5   | 20  | DTOs with `class-validator` `whitelist + forbidNonWhitelisted`; never spread the request body into Prisma `create`                                                          | 1     | ✅ (`ValidationPipe` wired in `main.ts`) |
| A-T2 | SSRF via "fetch document from URL" features       | Future feature creep                 | 3   | 4   | 12  | Outbound network egress gateway with allow-list (DigiLocker, MSG91, OpenAI, Gemini); block 169.254.x, 10.x, 172.16/12, 192.168                                              | 1+    | 🟡                                       |
| A-R1 | Operator action attributed to wrong officer       | Shared workstation                   | 2   | 4   | 8   | MFA per session; `audit_log.actor_id` from JWT-only; no impersonation feature in v1                                                                                         | 1     | 🟡                                       |
| A-I1 | **Cross-tenant data leak** via missed RLS context | Forgotten `SET LOCAL app.tenant_id`  | 3   | 5   | 15  | Prisma middleware sets RLS on every request; integration tests in `tests/security/tenant-isolation.spec.ts` issue queries from Tenant-A JWT for Tenant-B IDs and assert 404 | 1     | 🟡 (placeholder)                         |
| A-I2 | Verbose stack traces in 500s                      | NestJS default                       | 4   | 2   | 8   | `HttpExceptionFilter` strips messages in `NODE_ENV=production`; correlation-ID-only payload                                                                                 | 1     | 🟡                                       |
| A-D1 | Unbounded query / pagination                      | `?limit=999999`                      | 4   | 3   | 12  | Pagination guard caps `take` at 100; `where` in scoped repos; statement timeout 30 s in Postgres                                                                            | 1     | 🟡                                       |
| A-D2 | Slowloris / large body upload                     | Untimed multipart                    | 3   | 4   | 12  | Reverse-proxy timeouts (15 s); Multer file-size cap; `body-parser` `limit: '1mb'` for JSON                                                                                  | 1     | 🟡                                       |
| A-E1 | Privilege escalation via stale role cache         | Officer demoted, JWT still valid     | 3   | 4   | 12  | Short JWT TTL (15 min); refresh rotates roles; high-value actions re-check role at DB                                                                                       | 1     | 🟡                                       |

### 4.3 Postgres (Row-Level Security boundary)

| ID   | Threat                                                                        | Vector                                       | L   | I   | R   | Mitigation                                                                                                                                                   | Phase | Status |
| ---- | ----------------------------------------------------------------------------- | -------------------------------------------- | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------ |
| P-T1 | Direct SQL bypassing RLS                                                      | Migration script run as `postgres` superuser | 3   | 5   | 15  | Application connects as a non-bypassing role (`enagar_app`); migrations via dedicated `enagar_migrator` role; superuser only via SDC bastion + 2-person rule | 1     | 🟡     |
| P-T2 | Migration drops audit columns                                                 | Sloppy DDL                                   | 2   | 5   | 10  | Migrations reviewed in PR; CI diffs schema and fails on `DROP COLUMN audit_*`                                                                                | 1     | 🟡     |
| P-I1 | RLS policy false-positive (citizen sees another citizen's row in same tenant) | Sloppy `USING` clause                        | 3   | 5   | 15  | Per-table policies tested in `tests/security/rls-fuzz.spec.ts`; pgTAP unit tests                                                                             | 1     | 🟡     |
| P-I2 | Backup tape compromise                                                        | Physical theft of unencrypted backup         | 2   | 5   | 10  | TDE on disks; backups encrypted at the cluster level; off-site copies under SDC custody                                                                      | 5     | 🟡     |
| P-D1 | Deadlock storm from concurrent transitions                                    | Contended grievance assignment               | 3   | 3   | 9   | Optimistic-locking `version` column; advisory locks for assignment                                                                                           | 2     | 🟡     |

### 4.4 MinIO (object storage boundary)

| ID   | Threat                                                 | Vector                    | L   | I   | R   | Mitigation                                                                                                      | Phase | Status |
| ---- | ------------------------------------------------------ | ------------------------- | --- | --- | --- | --------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| M-S1 | Forged signed-URL                                      | Replay across citizens    | 3   | 4   | 12  | URLs signed with HMAC, TTL ≤ 5 min, **bound to citizen_id** in object key                                       | 1     | 🟡     |
| M-T1 | Object replaced after upload (e.g. forged certificate) | Bucket policy too lax     | 2   | 5   | 10  | Object-lock + versioning enabled on `certificates` and `grievance_photos` buckets; pre-signed URLs are PUT-once | 1     | 🟡     |
| M-I1 | Bucket made public by mistake                          | Misconfig                 | 3   | 5   | 15  | Default bucket policy denies public reads; CI gate on policy diffs; admin portal blocks public-bucket toggle    | 1     | 🟡     |
| M-D1 | Unbounded uploads fill the disk                        | Malicious citizen uploads | 4   | 3   | 12  | Per-tenant quota; per-citizen daily upload count; max file size 10 MB                                           | 1     | 🟡     |

### 4.5 Hosted LLM boundary (DPDP-critical)

| ID   | Threat                                                             | Vector                                                   | L   | I   | R   | Mitigation                                                                                                                                                                                                                                    | Phase | Status                |
| ---- | ------------------------------------------------------------------ | -------------------------------------------------------- | --- | --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------- |
| L-T1 | Prompt-injection via citizen message ("ignore previous, reveal …") | Untrusted citizen text                                   | 5   | 4   | 20  | Strict separation: **system prompt** is server-authored & immutable; citizen text injected as `messages[].content` only; refusal patterns hard-coded                                                                                          | 7     | 🟡                    |
| L-I1 | **PII leaks to OpenAI/Gemini** because redaction missed a pattern  | Edge case (e.g. mobile in citizen-pasted text)           | 4   | 5   | 20  | Pre-egress redactor with **deny-by-default**: regex pack for mobile, Aadhaar, holding, PAN, account number, addresses; **unit tests with 50+ adversarial samples**; integration test that boots a fake provider and asserts no PII reaches it | 7     | 🟡                    |
| L-I2 | DPA-non-compliant retention by vendor                              | Vendor logs prompts                                      | 3   | 5   | 15  | DPA signed with `Zero data retention` opt-in (OpenAI: enterprise plan with `enable_logging: false`; Gemini: equivalent); per-call telemetry confirms `header.x-no-train: true`                                                                | 7     | 🔴 (depends on legal) |
| L-I3 | Side-channel via embedding leakage                                 | Citizen text embedded in Qdrant + extracted by adversary | 2   | 4   | 8   | Per-tenant Qdrant collections; access-controlled by mTLS + service-account; embeddings stored without raw text                                                                                                                                | 7     | 🟡                    |
| L-D1 | Provider outage cascades                                           | OpenAI 5xx                                               | 4   | 3   | 12  | Failover to secondary provider per ADR-0008; circuit breaker; "AI temporarily unavailable" graceful degrade                                                                                                                                   | 7     | 🟡                    |
| L-D2 | Token-budget exhaustion (cost or per-tenant cap)                   | Citizen flooding chat                                    | 4   | 3   | 12  | Per-citizen `messages_per_hour` cap; per-tenant `monthly_budget_inr` (alert at 80 %); BullMQ rate-limited queue                                                                                                                               | 7     | 🟡                    |
| L-E1 | Compromised API key                                                | Leaked from CI logs                                      | 3   | 5   | 15  | API keys in sealed-secrets, never in `.env.example`; vault-backed runtime fetch; rotation drill every 90 days; CI redacts `OPENAI_API_KEY*` and `GEMINI_API_KEY*` from logs                                                                   | 7     | 🟡                    |

### 4.6 Identity provider (Keycloak — per ADR-0009)

| ID   | Threat                                          | Vector                         | L   | I   | R   | Mitigation                                                                                                                           | Phase | Status |
| ---- | ----------------------------------------------- | ------------------------------ | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------ | ----- | ------ |
| K-S1 | Operator brute-force / credential stuffing      | Stolen creds from other breach | 4   | 5   | 20  | Mandatory MFA for all operators; lockout after 5 failures + 15-min cooldown; `pwned-passwords` check at set-time                     | 1     | 🟡     |
| K-T1 | Realm export leaks public client secrets        | Misconfigured backup           | 2   | 5   | 10  | `Public client = false` everywhere; PKCE for mobile; client secrets sealed                                                           | 1     | 🟡     |
| K-I1 | OIDC discovery exposed to public                | Default config                 | 3   | 2   | 6   | `/auth/realms/{realm}/.well-known/openid-configuration` is public by design — but admin endpoints are firewalled to SDC bastion only | 1     | 🟡     |
| K-D1 | Keycloak unavailable → citizens can't log in    | Single instance                | 3   | 5   | 15  | HA Keycloak (≥ 2 nodes) behind LB; cached JWKS in API; cached sessions for 15 min                                                    | 5     | 🟡     |
| K-E1 | Privilege escalation via realm-admin compromise | Phished super-admin            | 2   | 5   | 10  | Hardware-key MFA mandatory for realm-admin role; high-priv admin actions emit Slack/email alerts                                     | 1+    | 🟡     |

### 4.7 Workers & queues (BullMQ on Redis)

| ID   | Threat                                                        | Vector                  | L   | I   | R   | Mitigation                                                                                                                | Phase | Status |
| ---- | ------------------------------------------------------------- | ----------------------- | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| Q-S1 | Job forged from outside the API (writes directly to Redis)    | Compromised pod         | 2   | 4   | 8   | Workers validate job payload schemas (`zod`); only API service has Redis write creds; network-policied                    | 2     | 🟡     |
| Q-T1 | Job re-execution causes double-charge / duplicate certificate | At-least-once semantics | 3   | 4   | 12  | All side-effecting handlers idempotent on `(tenant_id, application_id, transition_id)`; locks via Postgres advisory locks | 2     | 🟡     |
| Q-D1 | Queue saturation by malicious flood                           | Citizen rapid-submit    | 3   | 3   | 9   | Per-citizen rate-limit on submit; bullmq priority queues; back-pressure via 429                                           | 2     | 🟡     |

### 4.8 RAG indexer (Python FastAPI)

| ID   | Threat                                                     | Vector                               | L   | I   | R   | Mitigation                                                                                                               | Phase | Status |
| ---- | ---------------------------------------------------------- | ------------------------------------ | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------ | ----- | ------ |
| R-T1 | Crawler fetches malicious PDF that pivots to RCE in parser | Hostile PDF                          | 2   | 4   | 8   | Run indexer in a network-isolated worker pod; PyMuPDF + bandit-scan; no `eval`/`exec`; resource limits                   | 7     | 🟡     |
| R-I1 | Indexer leaks an unsanitized citizen message into the KB   | Future feature: "promote chat to KB" | 2   | 5   | 10  | KB ingestion is an **explicit admin step**; never auto-promotes citizen content; PII redactor runs again on every ingest | 7     | 🟡     |

### 4.9 Operator surfaces (admin portals)

| ID   | Threat                                                       | Vector                 | L   | I   | R   | Mitigation                                                                                                                  | Phase | Status |
| ---- | ------------------------------------------------------------ | ---------------------- | --- | --- | --- | --------------------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| O-S1 | Phished session token reused                                 | Stolen cookie          | 3   | 5   | 15  | `SameSite=Strict`; HSTS; admin portals mounted on a separate subdomain; IP allow-list for Tenant Admin (configurable)       | 6     | 🟡     |
| O-T1 | CSRF on configuration endpoints                              | Same-origin assumption | 3   | 5   | 15  | Double-submit token + `Origin` header check; CSRF middleware on all admin routes                                            | 6     | 🟡     |
| O-I1 | Admin portal exposes raw citizen PII unnecessarily           | Default search results | 4   | 4   | 16  | `aadhaar_last4` only; full mobile masked unless "reveal" clicked (audited); export limited to 1k rows + reason field        | 6     | 🟡     |
| O-E1 | Tenant Admin gains state-level access via misconfigured role | RBAC bug               | 2   | 5   | 10  | Role hierarchy enforced both in API guards AND DB row policies; integration test asserts each role can only see scoped data | 6     | 🟡     |

---

## 5. Cross-cutting threats

### 5.1 Multi-tenant isolation (the _one_ failure that ends the project)

| ID   | Threat                                          | Mitigation                                                                                                                           | Status |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| MT-1 | Citizen of Tenant A sees Tenant B's application | RLS + controller `tenant_id` check + integration test in `tests/security/tenant-isolation.spec.ts` (Phase 1 expands the placeholder) | 🟡     |
| MT-2 | Worker job runs for the wrong tenant            | Job payload includes `tenant_id`; worker entrypoint sets RLS context first; integration test asserts                                 | 🟡     |
| MT-3 | Reporting MV exposes cross-tenant rows          | MVs scoped by `tenant_id` predicate; refresh runs per-tenant                                                                         | 🟡     |
| MT-4 | Tenant disable does not stop in-flight jobs     | Tenant-disable hook drains BullMQ queues for that tenant; new submits 410                                                            | 🟡     |

### 5.2 Supply-chain integrity

| ID   | Threat                                                                 | Mitigation                                                                                                           | Status                                  |
| ---- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| SC-1 | Malicious npm dependency lands via auto-update                         | Renovate PRs (no auto-merge); Trivy fs scan on every PR (HIGH/CRITICAL fail); `pnpm audit` in CI                     | ✅ Trivy & Dependabot wired (`77a7355`) |
| SC-2 | Compromised `eslint-plugin-X` exfiltrates source on install            | Lockfile committed; CI uses `--frozen-lockfile`; `--ignore-scripts` for non-essential lifecycle hooks where possible | 🟡                                      |
| SC-3 | Compromised Docker base image                                          | Pinned digests for all `FROM` lines; renovate updates digests; scan images with Trivy in CI                          | 🟡                                      |
| SC-4 | Third-party CDN serves modified script in dev (`index.html` prototype) | Prototype is **dev-only**; production builds bundle every dep; no `unpkg` / `esm.sh` reaches prod                    | ✅                                      |

### 5.3 Privacy & DPDP compliance

| ID   | Threat                                                                                            | Mitigation                                                                                                                                                                                          | Status                  |
| ---- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| DP-1 | Cross-border transfer of PII to OpenAI / Gemini violates DPDP                                     | (a) DPA signed with vendor; (b) PII redactor between platform and vendor; (c) privacy notice discloses cross-border processing; (d) Tenant Admin can switch to Ollama if a ULB rejects cross-border | 🔴 (legal step pending) |
| DP-2 | Right-to-erasure request not propagated to MinIO / Qdrant                                         | DSR (Data Subject Request) workflow deletes rows + objects + embeddings within 30 days; audit row records the deletion                                                                              | 🟡                      |
| DP-3 | Minor's PII processed without parental consent (Birth Cert applications include child name + DOB) | Consent collected from applying parent; UI labels child fields explicitly; legal review in Sprint 0.2                                                                                               | 🟡                      |

### 5.4 On-prem operations

| ID   | Threat                                      | Mitigation                                                                                                | Status                                  |
| ---- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| OP-1 | Disaster recovery untested                  | Quarterly DR drill; synthetic-data restore validated; documented in `docs/runbooks/dr-drill.md` (Phase 9) | 🟡                                      |
| OP-2 | Logs contain PII                            | Pino redact list in `apps/api`; structured logs; quarterly audit                                          | ✅ wired (`apps/api/src/app.module.ts`) |
| OP-3 | Operator runs a destructive command in prod | Two-person rule for any `DELETE` / `TRUNCATE`; bastion sessions recorded                                  | 🟡                                      |

---

## 6. Top-10 risk-ranked summary

> Sorted by **R = L × I**. This is the priority order for Phase 1 hardening.

| #   | ID   | Threat                                          | R   | Phase | Status     |
| --- | ---- | ----------------------------------------------- | --- | ----- | ---------- |
| 1   | C-E1 | Forged JWT claims `operator` role               | 25  | 1     | 🟡         |
| 2   | A-S1 | Forged `X-Tenant-Code` header (dev → prod leak) | 25  | 1     | 🟡         |
| 3   | C-I1 | IDOR on application IDs                         | 20  | 1     | 🟡         |
| 4   | A-T1 | Mass-assignment of `tenant_id`                  | 20  | 1     | ✅ partial |
| 5   | L-T1 | Prompt-injection bypassing system prompt        | 20  | 7     | 🟡         |
| 6   | L-I1 | PII leak to hosted LLM (regex miss)             | 20  | 7     | 🟡         |
| 7   | K-S1 | Operator credential stuffing                    | 20  | 1     | 🟡         |
| 8   | O-I1 | Admin portal exposes excessive PII              | 16  | 6     | 🟡         |
| 9   | C-D1 | OTP-flood drains SMS budget                     | 16  | 1     | 🟡         |
| 10  | M-I1 | MinIO bucket made public                        | 15  | 1     | 🟡         |

---

## 7. Phase-1 security test backlog

Every test below **must** be implemented and passing before Phase 1 closes. They live in `tests/security/` (cross-cutting) or under each app's `test/` folder (component-specific).

### 7.1 Tenant isolation (`tests/security/tenant-isolation.spec.ts`)

- [ ] **TI-1** — seed Tenants A and B; issue Tenant-A JWT; attempt `GET /applications/{B-application-id}` → asserts **404** (not 403, not 200).
- [ ] **TI-2** — same as TI-1 for grievances, payments, certificates.
- [ ] **TI-3** — same as TI-1 but at the Prisma layer: connect with Tenant-A's RLS context, query for Tenant-B row by primary key → 0 rows.
- [ ] **TI-4** — same as TI-3 at raw `pg` layer with `SET LOCAL app.tenant_id = 'A'` and a `SELECT … WHERE id = '<B id>'` → 0 rows.
- [ ] **TI-5** — admit BullMQ job with mismatched `tenant_id` and `application_id`; worker entrypoint must reject the job, not execute it.
- [ ] **TI-6** — try to `INSERT` into a Tenant-A row from a Tenant-B context → DB raises RLS error.
- [ ] **TI-7** — Mat-view refresh per-tenant: count rows per tenant in the MV equals count rows per tenant in the source table.
- [ ] **TI-8** — disable Tenant-A → all in-flight jobs drained within 60 s; new submits return 410.

### 7.2 Authentication & session (`apps/api/test/auth.e2e-spec.ts`)

- [ ] **AU-1** — JWT with modified payload (role flipped from `citizen` to `operator`) is rejected with 401.
- [ ] **AU-2** — JWT signed with wrong key is rejected with 401.
- [ ] **AU-3** — Expired JWT is rejected with 401.
- [ ] **AU-4** — JWT for a deactivated tenant returns 410.
- [ ] **AU-5** — `X-Tenant-Code` header in `NODE_ENV=production` is **rejected** (not silently used).
- [ ] **AU-6** — OTP verification: 4 wrong attempts in a row trigger lockout for 15 min.
- [ ] **AU-7** — OTP cannot be reused after success.
- [ ] **AU-8** — MFA: an operator without MFA enrolled cannot reach any admin route — 403 with `mfa_required` code.

### 7.3 Authorization (`apps/api/test/authz.e2e-spec.ts`)

- [ ] **AZ-1** — citizen JWT cannot call any `/admin/*` route.
- [ ] **AZ-2** — Tenant Admin cannot reach `/state/*` routes.
- [ ] **AZ-3** — operator with role `health_officer` cannot approve a `building-plan` application.
- [ ] **AZ-4** — IDOR matrix: 10 entity types × 3 roles × 2 tenants → all forbidden cells return 404.
- [ ] **AZ-5** — Admin "reveal mobile" action: each call writes an `audit_log` row with reason + actor + timestamp.

### 7.4 Input validation (`apps/api/test/dto.spec.ts`)

- [ ] **IV-1** — every controller has `ValidationPipe` with `whitelist + forbidNonWhitelisted` (lint rule).
- [ ] **IV-2** — request body with extra `tenant_id` is **rejected** (not silently ignored).
- [ ] **IV-3** — `?limit=999999` is clamped to 100 (or rejected — pick one and stick to it).
- [ ] **IV-4** — file upload >10 MB returns 413.
- [ ] **IV-5** — JSON body >1 MB returns 413.

### 7.5 Object storage (`apps/api/test/minio.spec.ts`)

- [ ] **OS-1** — pre-signed URLs expire in ≤ 5 min.
- [ ] **OS-2** — pre-signed URL bound to one citizen cannot be used by another citizen's session (key prefix check).
- [ ] **OS-3** — every bucket has `block-public-access: true` (verified at boot via admin API).
- [ ] **OS-4** — uploads exceed per-citizen daily quota → 429.

### 7.6 Rate limiting (`apps/api/test/ratelimit.spec.ts`)

- [ ] **RL-1** — OTP request: 6th call from same mobile in 1 h → 429.
- [ ] **RL-2** — OTP request: 21st call from same IP in 1 h → 429.
- [ ] **RL-3** — Submit-application: 11th call from same citizen in 1 h → 429.
- [ ] **RL-4** — Quotas survive restart (Redis-backed counters).

### 7.7 Logging & audit (`apps/api/test/audit.spec.ts`)

- [ ] **AU-L1** — every state-changing endpoint writes an `audit_log` row with `(actor_id, tenant_id, entity_type, entity_id, verb, ip, ua, request_id)`.
- [ ] **AU-L2** — `audit_log` rows cannot be deleted (DB trigger raises).
- [ ] **AU-L3** — Pino logs do not contain `mobile`, `aadhaar_number`, `password`, `authorization` after redaction.

### 7.8 Build / supply chain (CI)

- [ ] **SC-CI-1** — Trivy fs scan: HIGH/CRITICAL → fail (already wired in `77a7355`; verify still passes weekly with no exceptions).
- [ ] **SC-CI-2** — `pnpm audit --audit-level=high` → fail.
- [ ] **SC-CI-3** — Pinned Docker `FROM` digests; CI rejects any unpinned `FROM`.
- [ ] **SC-CI-4** — `--frozen-lockfile` in every `pnpm install` step.

### 7.9 Phase-7 readiness (PII redaction unit harness — written _before_ Phase 7 starts)

- [ ] **PII-1** — fixture pack of **50** redacted vs. raw pairs (mobile, Aadhaar, holding, PAN, IFSC, account number, addresses, parents' names) drives `redact()` unit tests.
- [ ] **PII-2** — adversarial samples: zero-width-space-injected mobile, OCR'd photo of Aadhaar in markdown, PII spread across two consecutive messages.
- [ ] **PII-3** — fake LLM provider asserts no raw PII reaches `stream()`.

---

## 8. Open follow-ups (assigned in Sprint 0.2)

| #   | Topic                                                                       | Owner         | Due             |
| --- | --------------------------------------------------------------------------- | ------------- | --------------- |
| 1   | Sign Data Processing Agreement with OpenAI (zero-retention enterprise plan) | Sponsor + DPO | Phase 7 kickoff |
| 2   | Sign DPA with Google for Gemini equivalent                                  | Sponsor + DPO | Phase 7 kickoff |
| 3   | Privacy notice draft (Bengali / Hindi / English)                            | DPO + product | Phase 1 closing |
| 4   | DPO appointment notified to MeitY                                           | Sponsor       | Pre-launch      |
| 5   | Threat-model review with external auditor                                   | Platform Lead | Phase 9         |
| 6   | Pen-test plan (external + internal)                                         | Platform Lead | Phase 9         |

---

## Change log

| Date       | Change                                                           | Reviewer                         |
| ---------- | ---------------------------------------------------------------- | -------------------------------- |
| 2026-05-06 | v0.1 — initial Phase-0 STRIDE pass; Phase-1 test backlog locked. | _pending DPO + sponsor sign-off_ |
