# Glossary

Authoritative vocabulary for **eNagarSeba**. When a term is ambiguous, **this file wins** over chat, slides, and code comments.

> **Conflict policy.** If you see a term used differently in code or docs, update _that_ — don't redefine it here without a PR + reviewer.

> **Status:** v0.1 — locked at the end of Sprint 0.2. Phase-specific terms are added inline in their phase docs; cross-phase terms are added here in the same PR as the feature that introduces them.

---

## 1. Stakeholders & roles

| Term                  | Definition                                                                                                                                                                                                          | Code synonym                           | Notes                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Citizen**           | A natural person who consumes municipal services. Authenticated via mobile + OTP (Phase 1) and optionally **DigiLocker** (Phase 1+).                                                                                | `Citizen` (DB), `citizen` (JWT `role`) | Never _user_ in domain code — `user` is reserved for the underlying auth-system principal. |
| **Field Staff**       | A municipal employee performing on-the-ground work: ward inspectors, sanitation supervisors, surveyors, hearse-van operators. Uses `apps/staff-mobile`.                                                             | `staff`                                | Distinct from _Officer_ — Field Staff usually do not approve applications.                 |
| **ULB Officer**       | A back-office municipal employee who approves / rejects applications, assigns grievances, issues certificates.                                                                                                      | `officer`                              | Scoped by _role_ (e.g. `health_officer`) and _ward_ / _borough_.                           |
| **Tenant Admin**      | The senior admin for a single ULB. Configures service catalogue, fees, workflows, branding. Uses `apps/admin-tenant`.                                                                                               | `tenant_admin`                         | Cannot create or delete tenants.                                                           |
| **State Super-Admin** | An employee of the Department of Urban Development & Municipal Affairs (DoUD&MA), Govt. of West Bengal. Onboards / disables ULBs, manages global service templates, audits across tenants. Uses `apps/admin-state`. | `state_admin`                          | Highest privilege; cross-tenant.                                                           |
| **Operator**          | Any non-citizen authenticated principal: Field Staff ∪ ULB Officer ∪ Tenant Admin ∪ State Super-Admin. Used when a rule applies to "all employees, not citizens."                                                   | `operator`                             | Aggregate role; never stored as a primary role.                                            |
| **Sponsor**           | DoUD&MA representative who signs off on charter, scope, and go-live.                                                                                                                                                | —                                      | Out-of-system; tracked in `docs/charter.md`.                                               |

---

## 2. Tenancy & geography

| Term                              | Definition                                                                                                                                                                       | Notes                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Tenant**                        | A multi-tenant boundary. **In v1, exactly one Tenant = one ULB.** Every row in every domain table carries `tenant_id`.                                                           | The word _tenant_ is preferred in code; _municipality_ / _ULB_ are preferred in user-facing copy. |
| **ULB**                           | **U**rban **L**ocal **B**ody. The administrative entity (Municipal Corporation, Municipality, Notified Area). Synonymous with _Tenant_ in v1.                                    | Examples: KMC, HMC, CMC.                                                                          |
| **Municipal Corporation**         | A category of ULB serving cities with population ≥ ~5 lakh.                                                                                                                      | KMC, HMC, AMC, DMC, BMC, SMC, CMC.                                                                |
| **Municipality**                  | A category of ULB serving smaller towns.                                                                                                                                         | E.g. South Dum Dum (SDDM).                                                                        |
| **Borough**                       | A sub-division of a Municipal Corporation. KMC has 16 boroughs.                                                                                                                  | Used for grievance escalation.                                                                    |
| **Ward**                          | The smallest administrative unit, governed by an elected Councillor. KMC has 144 wards.                                                                                          | Many notifications are ward-scoped.                                                               |
| **Holding**                       | A unit of property recognized by the ULB for tax purposes. Identified by **Holding Number**. One physical building can have multiple holdings; multiple buildings can share one. | Format is ULB-specific (Phase 3 freezes formats per tenant).                                      |
| **Connection (Water / Sewerage)** | A metered or unmetered service link from the municipal main to a property. Identified by **Connection Number**.                                                                  | Distinct from _Holding_ — a holding may have 0..n connections.                                    |

---

## 3. Identity & access

| Term           | Definition                                                                                                                                                                            | Notes                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **OTP**        | One-Time Password. 6 digits, 5-minute expiry, 3-attempt cap. Sent via SMS through MSG91 (Phase 1).                                                                                    | The primary citizen auth factor.                        |
| **MFA**        | Multi-Factor Authentication. **Required** for every Operator role; optional for Citizens.                                                                                             | TOTP (Phase 1) or hardware-key (Phase 6).               |
| **DigiLocker** | The Government of India identity wallet. Citizens link their account to fetch verified documents (Aadhaar, driving licence, marksheets) without uploading copies.                     | Phase 1+ integration. _Not_ yet in the prototype.       |
| **Aadhaar**    | The 12-digit Unique Identification number issued by UIDAI. Stored in eNagarSeba **only as the last 4 digits** (`aadhaar_last4`); the full number is fetched on-demand via DigiLocker. | We never persist a full Aadhaar number.                 |
| **JWT Claim**  | A field in the access token issued by Keycloak (per ADR-0009). Critical claims: `sub`, `tenant_id`, `tenant_code`, `role`, `ward_id?`.                                                | `tenant_id` is the **only** claim that drives RLS.      |
| **RLS**        | **R**ow-**L**evel **S**ecurity. PostgreSQL feature that filters every query by `tenant_id` regardless of the SQL written.                                                             | Enforced via `SET LOCAL app.tenant_id = …` per request. |

---

## 4. Service catalogue

| Term                   | Definition                                                                                                                                                                                                                             | Notes                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Service**            | A discrete offering a citizen can request from a ULB. Examples: _Birth Certificate_, _Property Tax Payment_, _Smart Parking Booking_. The platform ships **81 reference services** in 14 categories (see `docs/service-catalogue.md`). | The _unit of plug-and-play_ — every Service has a code, fees, eligibility, form schema, workflow, SLA. |
| **Service Category**   | A grouping of related services for navigation. 14 categories: Certificates, Tax & Property, Water & Sanitation, Building & Plan, … (see `docs/service-catalogue.md` §2).                                                               | UI-only; a service belongs to exactly one.                                                             |
| **Service Template**   | A _global_ service definition published by the State Super-Admin. ULBs can **adopt**, **override** (fees, SLA, form), or **decline**.                                                                                                  | Lives in `apps/admin-state`.                                                                           |
| **Service Code**       | An immutable string identifier, e.g. `birth-cert`, `prop-tax`, `smart-parking`. Unique across all tenants.                                                                                                                             | URL-safe, lowercase, hyphenated.                                                                       |
| **Form Schema**        | The **JSON-Schema** definition of a Service's input form. Drives the citizen-PWA, the mobile app, and server-side validation simultaneously.                                                                                           | One source of truth, three runtimes. (`@enagar/forms`.)                                                |
| **Eligibility**        | Pre-conditions a citizen must meet to apply (e.g. _minor child for Birth Certificate_, _holding-owner for Mutation_). Encoded as a JSON-Schema `if/then` expression evaluated server-side.                                             | Distinct from _required documents_.                                                                    |
| **Required Documents** | The list of supporting files a citizen must upload (or fetch via DigiLocker). Each document has a type (`pdf`/`jpg`), max size, and an optional template URL.                                                                          | Prefix `doc:` in the form schema.                                                                      |
| **Fees**               | The amount the citizen pays for a service. Stored as paise (integer). May be `0` (free), a fixed amount, slab-based, or computed from form input.                                                                                      | `fees_table` JSONB column on `services` (Phase 2).                                                     |
| **Late Fee / Penalty** | An additional charge applied when payment is past due. Typically _2 % per month_ on tax services.                                                                                                                                      | Computed at payment time, not stored.                                                                  |

---

## 5. Application lifecycle

| Term            | Definition                                                                                                                                                                                                 | Notes                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Application** | A single instance of a citizen requesting a service. Uniquely identified by **Application ID**: `WBM/<TENANT_CODE>/<SERVICE_CODE>/<YEAR>/<5-DIGIT-SEQUENCE>`. Example: `WBM/KMC/birth-cert/2026/00342`.    | The prototype's slice-3 abbreviation (`BC`, `PT`) is replaced with the full service code in v1 — see `docs/service-catalogue.md` §10. |
| **Workflow**    | The directed graph of _Stages_ through which an Application progresses. Each Service has exactly one Workflow.                                                                                             | Authored in `apps/admin-tenant`; runtime in `services/workflow-engine`.                                                               |
| **Stage**       | A node in a Workflow. Holds: name, owner role, allowed transitions, side-effects, SLA timer. Examples: _submitted_, _ward-inspector-verify_, _fee-calc_, _officer-approve_, _certificate-issue_, _closed_. | Uniform vocabulary across all services — the _stage definition_ is per-service, the _stage primitive_ is shared.                      |
| **Transition**  | A guarded move from one Stage to another. Carries a `verb` (e.g. `approve`, `reject`, `return-for-correction`), an optional comment, and an audit row.                                                     | Only the current owner role may transition.                                                                                           |
| **Status**      | The human-readable label of the _current stage_ shown to the citizen. Display label only — never used in business logic.                                                                                   | Use `current_stage_id` for code; `status_label` for UI.                                                                               |
| **Pending At**  | The role + location currently responsible for the next action. Surfaced in citizen UI as _"Pending at: Sanitation Inspector — Ward 64"_.                                                                   | Derived from the current stage's owner.                                                                                               |
| **SLA**         | **S**ervice-**L**evel **A**greement. The promised processing time, in working days. Triggers escalation when breached.                                                                                     | Per-stage and per-service.                                                                                                            |
| **Escalation**  | The action taken when an SLA is breached: notify next-up officer, post to Commissioner dashboard, optionally auto-approve.                                                                                 | Configurable in `apps/admin-tenant`.                                                                                                  |
| **Receipt**     | The proof of fee payment. Issued as a digitally-signed PDF. Identified by **Transaction ID** (`TXN<7-9 digits>`).                                                                                          | Distinct from _Certificate_.                                                                                                          |
| **Certificate** | The output document of a successful Application (Birth Certificate, Trade Licence, Building-Plan Approval). Pushed to citizen's DigiLocker and stored in MinIO.                                            | Identified by **Certificate Number** (per-service format).                                                                            |

---

## 6. Grievance redressal

| Term                         | Definition                                                                                                                                                                                                                   | Notes                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Grievance**                | A complaint filed by a citizen about a civic problem (sanitation, water, roads, lighting). Identified by **Docket Number**: `GRV/<TENANT_CODE>/<YEAR>/<CATEGORY_CODE>/<4-DIGIT-SEQUENCE>`. Example: `GRV/KMC/2026/SAN/4421`. | Never called _complaint_ in domain code.                                                                          |
| **Docket**                   | Synonym for _Grievance Number_. Used in citizen-facing copy ("share your docket number").                                                                                                                                    | UI-only term.                                                                                                     |
| **Grievance Category**       | A top-level grouping configured per tenant (and optionally from the **global grievance library**). Codes are kebab-case (e.g. `broken-streetlight`). Citizens see localized labels from `tenant_grievance_categories.name`.  | Tenant Admin **Masters**; State **Grievance library**. Legacy seed codes may still appear in Desk until migrated. |
| **Global grievance library** | State-published reference categories and sub-types (`global_grievance_categories`). Municipalities **adopt** rows into their tenant catalogue without redeploying apps.                                                      | State Admin `:3003` → Grievance library.                                                                          |
| **Adopt**                    | Copy a global category (+ active sub-types) into a tenant catalogue (`source = global_adopted`).                                                                                                                             | Tenant Admin or State municipality profile drawer.                                                                |
| **Fork**                     | Clone an adopted/global row into a tenant-only copy (`{code}-local`) so labels or sub-types can diverge.                                                                                                                     | Tenant Admin catalogue governance.                                                                                |
| **Deactivate**               | Set `is_active = false` on a catalogue row so it disappears from citizen pickers; historical grievances keep their stored codes.                                                                                             | Does not delete rows or rewrite `grievance_no`.                                                                   |
| **Sub-type**                 | A finer-grained classification within a Category (`tenant_grievance_subtypes`). Drives routing and SLA via Operations config. Examples: `lamp-out`, `pole-damaged`.                                                          | Required when the category has active sub-types.                                                                  |
| **Priority**                 | One of `Low`, `Medium`, `High`. **High** triggers a 24-hour SLA; otherwise 48 hours (default in prototype).                                                                                                                  | Citizen-selected; reviewable by triage.                                                                           |
| **Triage**                   | The first action after submission: confirm category, assign priority, route to the responsible Field Staff. Manual in v1; ML-assisted in Phase 8.                                                                            | Owned by Citizen Services.                                                                                        |
| **Resolution Photo**         | A geotagged photo signed at capture time on a Field Staff device, attached when a Grievance is marked resolved. Anti-tampering measure.                                                                                      | Phase 4.                                                                                                          |
| **Re-open**                  | A citizen action to dispute a _resolved_ status within 7 days. Re-opens automatically escalate to next-up officer.                                                                                                           | Citizen-only action.                                                                                              |

---

## 7. Revenue heads

| Term                  | Definition                                                                                                | Notes                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Property Tax**      | The annual tax levied on a Holding. Self-assessed via SAS or assigned via valuation board.                | Late: 2 %/month interest.                   |
| **Water Tax**         | The annual tax for water supply. May or may not include consumption charges.                              | Per-Connection.                             |
| **Conservancy Tax**   | The annual tax for solid-waste removal.                                                                   | Per-Holding.                                |
| **Mutation Fee**      | The one-time fee paid when a Holding's owner changes.                                                     | ₹500 (KMC reference).                       |
| **Trade Licence Fee** | The annual fee for operating a trade (shop, workshop, eatery).                                            | Slab-based by trade type.                   |
| **Building Plan Fee** | The fee paid when applying for plan approval.                                                             | Per built-up sq.ft.                         |
| **Hoarding Fee**      | The fee for advertising rights on a public hoarding.                                                      | Per ward, per sq.ft., per month.            |
| **EMD**               | **E**arnest **M**oney **D**eposit. A refundable deposit submitted with a tender. 2-5 % of contract value. | Refunded within 30 days of award/rejection. |
| **Security Deposit**  | A refundable deposit submitted by a contractor before work begins. 5-10 % of contract value.              | Refunded after defect-liability period.     |
| **RTI Fee**           | ₹10 application fee for **R**ight **T**o **I**nformation requests. BPL-exempt.                            | Statutory.                                  |

---

## 8. AI / chatbot

| Term                    | Definition                                                                                                                                                                                                  | Notes                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Sahayak**             | The eNagarSeba citizen chatbot. Bengali for _helper_. Powers FAQs, status look-ups, service navigation.                                                                                                     | Phase 7.                                                   |
| **`ILLMProvider`**      | The TypeScript interface every LLM vendor adapter must satisfy. Defined in `@enagar/types`. Per-tenant override of provider (OpenAI / Gemini / Ollama) drives routing.                                      | See `docs/ADRs/ADR-0008-llm-provider-adapter.md`.          |
| **RAG**                 | **R**etrieval-**A**ugmented **G**eneration. Pipeline: embed → vector-search Qdrant → re-rank → inject as context → LLM call.                                                                                | Anti-hallucination guard.                                  |
| **Knowledge Base / KB** | The corpus of **government source documents** (by-laws, fee schedules, FAQs) chunked and embedded into Qdrant. Curated by State Super-Admin.                                                                | Citation-bearing — every answer must cite a KB chunk URL.  |
| **PII Redaction**       | The mandatory step of replacing personally-identifiable information (mobile, Aadhaar last 4, holding number, name) with placeholder tokens before any prompt leaves the platform boundary for a hosted LLM. | Reverse-mapped server-side after the response. (ADR-0008.) |
| **Provider Failover**   | Automatic switch to a secondary LLM provider when the primary returns >2 consecutive errors in 60 s.                                                                                                        | Per ADR-0008.                                              |
| **Context**             | The non-PII data attached to a Sahayak prompt: current screen, current tenant, locale, user role.                                                                                                           | `LLMRequest.systemPrompt` carries this.                    |
| **Refusal**             | The Sahayak response when a query is out-of-scope, asks for legal advice, or requests data the user is not authorized to see. Hard-coded patterns; never LLM-generated.                                     | Logged for audit.                                          |

---

## 9. Storage & infra

| Term            | Definition                                                                                                    | Notes                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Postgres**    | PostgreSQL 16 (per ADR-0001). Single primary database for all domain data.                                    | Multi-tenant via `tenant_id` + RLS.            |
| **MinIO**       | S3-compatible object storage hosted on-prem. Holds uploaded documents, generated certificates, signed photos. | Replication target outside this scope.         |
| **Qdrant**      | Open-source vector database. Holds embeddings for the Sahayak Knowledge Base.                                 | Per-tenant collections.                        |
| **Redis**       | In-memory cache + BullMQ queue backbone.                                                                      | Used for rate-limit counters too.              |
| **BullMQ**      | Redis-backed job queue. Drives `services/workflow-engine`, `notification-worker`, `reporting-worker`.         | Replaces a heavier engine per ADR-0004 (open). |
| **Keycloak**    | Open-source identity provider (OIDC). Issues JWTs, manages roles, MFA, password reset.                        | Per ADR-0009.                                  |
| **Meilisearch** | Open-source full-text search engine. Powers typo-tolerant service / grievance lookup.                         | Per-tenant indexes.                            |
| **WB SDC**      | West Bengal State Data Centre. The on-prem hosting target (per ADR-0005).                                     | Disaster-recovery in Salt Lake.                |

---

## 10. Process verbs (state-transition vocabulary)

> One verb per outcome. **Never invent new verbs** without updating this table.

| Verb                      | Meaning                                                                                                  | Used by                | Generates                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------- |
| **submit**                | Citizen action: the form passes validation and is queued for processing.                                 | Citizen                | Application ID + audit row.                  |
| **withdraw**              | Citizen action: the application is cancelled by the citizen before approval.                             | Citizen                | Final stage _withdrawn_.                     |
| **assign**                | Operator action: the application is routed to a specific officer.                                        | Operator               | Updated `pending_at`.                        |
| **return-for-correction** | Operator action: the application is sent back to the citizen for missing / wrong info.                   | Operator               | Editable application + citizen notification. |
| **approve**               | Operator action: the application moves to the next stage. Final-stage approve issues the Certificate.    | Operator               | Stage transition + audit.                    |
| **reject**                | Operator action: terminal failure with a reason.                                                         | Operator               | Final stage _rejected_.                      |
| **resolve**               | Operator action (grievances only): mark the issue fixed. Citizen has 7 days to dispute.                  | Field Staff / Operator | Resolution photo + final stage.              |
| **escalate**              | System or operator action: the SLA is breached / a citizen disputes; the application moves up the chain. | System / Operator      | Notification + dashboard alert.              |
| **close**                 | Terminal verb: no further transitions are possible.                                                      | System                 | Locked record.                               |

---

## 11. Reserved abbreviations

| Acronym         | Expansion                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| **ADR**         | Architecture Decision Record                                                                               |
| **AGPL**        | Affero General Public Licence (our chosen licence)                                                         |
| **BPL**         | Below Poverty Line (welfare eligibility)                                                                   |
| **DPDP**        | **D**igital **P**ersonal **D**ata **P**rotection Act, 2023 (India)                                         |
| **DPA**         | Data Processing Agreement (with hosted LLM vendors)                                                        |
| **DPO**         | Data Protection Officer                                                                                    |
| **EMD**         | Earnest Money Deposit                                                                                      |
| **FSSAI**       | Food Safety & Standards Authority of India                                                                 |
| **GIS**         | Geographic Information System                                                                              |
| **IDP**         | Identity Provider (the OIDC server, i.e. Keycloak)                                                         |
| **JSON-Schema** | The standard at <https://json-schema.org> — Draft 2020-12 in v1                                            |
| **MASVS**       | Mobile Application Security Verification Standard (OWASP)                                                  |
| **MV**          | Materialized View (Postgres)                                                                               |
| **NOC**         | No-Objection Certificate                                                                                   |
| **OIDC**        | OpenID Connect (auth protocol)                                                                             |
| **OTP**         | One-Time Password                                                                                          |
| **PII**         | Personally Identifiable Information                                                                        |
| **RBAC**        | Role-Based Access Control                                                                                  |
| **RLS**         | Row-Level Security (Postgres)                                                                              |
| **RTI**         | Right To Information (statutory disclosure regime)                                                         |
| **SAS**         | Self-Assessment System (property tax)                                                                      |
| **SDC**         | State Data Centre                                                                                          |
| **SLA**         | Service-Level Agreement                                                                                    |
| **SSE**         | Server-Sent Events (chatbot streaming transport)                                                           |
| **STRIDE**      | Spoofing / Tampering / Repudiation / Info-disclosure / DoS / Elevation-of-privilege threat-model framework |
| **SWM**         | Solid Waste Management                                                                                     |
| **ULB**         | Urban Local Body                                                                                           |

---

## 12. Anti-patterns

> Do not introduce these terms in new code or docs. Replace on sight.

| Avoid                                           | Use instead                            | Why                                                                                 |
| ----------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `user` (in domain code)                         | `citizen` / `operator` / specific role | _user_ hides the trust boundary that drives RLS.                                    |
| `complaint`                                     | `grievance`                            | _grievance_ is the statutory term used in the Public Grievance Redressal Mechanism. |
| `municipality` (in domain code)                 | `tenant`                               | Code references _tenant_; UI copy uses _municipality_ / ULB name.                   |
| `submission` (the noun)                         | `application`                          | The _act_ is "submit"; the _thing_ is "application".                                |
| `password` (for citizens)                       | `OTP`                                  | Citizens never set a password.                                                      |
| `request` (in workflow code)                    | `application` / `transition`           | Too generic; collides with HTTP request.                                            |
| `event-noc-form-v3` and similar versioned slugs | A `version` column on `services`       | We don't bake versions into IDs.                                                    |

---

## Change log

| Date       | Change                             | Reviewer                   |
| ---------- | ---------------------------------- | -------------------------- |
| 2026-05-06 | v0.1 — initial draft (Sprint 0.2). | _pending sponsor sign-off_ |
