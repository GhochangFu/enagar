# eNagarSeba — Project Charter

> **Status**: Draft, awaiting sponsor sign-off
> **Owner**: _TBD — sponsor name (suggested: Principal Secretary, DoUD&MA, Govt of West Bengal)_
> **Technical Lead**: _Current solo contributor (handle TBD)_
> **Date**: 2026-05-06

---

## 1. Vision

> **A single, sovereign, multilingual digital front-door to every municipal service in West Bengal — equally usable by a tea-stall vendor in Asansol and a property developer in Salt Lake — built once, deployed everywhere, owned by the Government of West Bengal forever.**

## 2. Mission

Replace the fragmented landscape of per-municipality websites, helpdesks, and paper queues with a unified mobile / web platform where:

- **Citizens** apply, pay, track, and complain in their language, on their phone, on their schedule.
- **Municipalities** configure their own services, fees, workflows, and branding without writing code.
- **The state** observes the entire system, benchmarks performance, and adds new ULBs as a data change — never as a code change.

## 3. Strategic Objectives (3-year)

| #   | Objective                              | Headline KPI                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Universal access to municipal services | ≥ 1 million active citizen accounts; ≥ 60 % of all eligible service requests filed digitally by Year 3                                                                                                                                                                                                                                                                           |
| O2  | Plug-and-play tenancy                  | New ULB live within 5 working days of MoU; zero engineering hours required                                                                                                                                                                                                                                                                                                       |
| O3  | Sovereign data infrastructure          | 100 % of citizen PII storage, identity, files, and the vector knowledge base on Government of WB infrastructure; zero recurring software-licence cost for self-hosted components. **AI inference uses approved third-party providers under DPDP-compliant DPAs with mandatory PII redaction at the platform boundary** (per [ADR-0008](./ADRs/ADR-0008-llm-provider-adapter.md)) |
| O4  | Transparent service delivery           | ≥ 95 % of services delivered within published SLA; SLA breach data publicly visible                                                                                                                                                                                                                                                                                              |
| O5  | Inclusive design                       | English / Bengali / Hindi at parity; WCAG 2.1 AA across all citizen surfaces; works on Android 9+ at 2 GB RAM                                                                                                                                                                                                                                                                    |

## 4. Success Metrics (per pilot ULB, 90 days post-launch)

| Tier           | Metric                                       | Target   |
| -------------- | -------------------------------------------- | -------- |
| **North Star** | Net Promoter Score from citizens             | ≥ 40     |
| Adoption       | Monthly Active Users / total electors        | ≥ 15 %   |
| Engagement     | Median services-per-citizen / month          | ≥ 1.5    |
| Quality        | SLA compliance                               | ≥ 90 %   |
| Quality        | Grievance reopen rate                        | ≤ 8 %    |
| Operational    | API P95 latency                              | < 500 ms |
| Operational    | Uptime                                       | ≥ 99.9 % |
| Financial      | Digital share of total ULB revenue collected | ≥ 40 %   |
| AI             | Sahayak first-response useful (👍 vs 👎)     | ≥ 75 %   |

## 5. Scope (v1, in)

- **Citizen surfaces**: PWA + React Native mobile app (en / bn / hi).
- **Citizen flows**: tenant select → 76 services × 14 categories → apply → pay → track → grievance → chatbot → notifications → profile.
- **Tenant Admin Portal**: full configuration domain (services, forms, workflows, fees, KB, staff, branding).
- **State Super-Admin Portal**: tenant onboarding, library curation, cross-tenant analytics.
- **Field-Officer / Enforcement App**: scoped Expo app with offline support, challan issue, GPS, photo evidence.
- **Sahayak AI**: RAG chatbot grounded in per-tenant KB + citizen context; sovereign inference (Ollama).
- **Payments**: pluggable gateway (first concrete adapter in Phase 3); receipts; deposits; refunds; challans.
- **Bookings, Smart-City stubs, Tenders**: per `ARCHITECTURE.md` §10.
- **Observability, security, DR**: Grafana / Loki / Prometheus; OWASP ASVS L2; MASVS L2; nightly DR snapshots.

## 6. Out of Scope (v1, deferred to Phase 12+)

- WhatsApp Business API channel (planned, but post-pilot).
- Voice-first chatbot (Whisper.cpp, post-pilot).
- IoT integrations (water tanker GPS, smart meters live telemetry) — planned but hardware-dependent.
- Aadhaar e-Sign for legal documents — depends on policy enabler.
- Cross-ULB profile portability with consent.
- e-Tender / e-Procurement (we deep-link to state portal).
- Public anonymised open-data API.

## 7. Stakeholder Map

| Stakeholder                               | Role                                            | Decision Power                                         |
| ----------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| _TBD_                                     | Executive Sponsor (DoUD&MA Principal Secretary) | Charter, budget, MoUs                                  |
| _TBD_                                     | Project Director                                | Day-to-day governance                                  |
| Municipal Commissioners (per pilot ULB)   | Tenant champions                                | Service catalogue sign-off, staff readiness            |
| Pilot ULBs (3): _TBD_                     | Field validators                                | UX feedback, KB authoring, training                    |
| Tenant Council (representative committee) | Quarterly road-mapping                          | Backlog prioritisation post-Phase 11                   |
| State IT / WBSCSC                         | Infrastructure operations                       | DC ops, security, DR                                   |
| MeitY / DigiLocker / NPCI                 | External integrations                           | API access, sandbox                                    |
| State Audit / DPDP Authority              | Compliance                                      | Annual sign-off                                        |
| **Engineering team**                      | Platform build                                  | Technical decisions per `AGENT.md`                     |
| **Citizens**                              | End users                                       | Indirectly — measured via NPS, grievances, app ratings |

## 8. Constraints

| Type                 | Constraint                                                                                                                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Regulatory**       | DPDP Act 2023, IT Act 2000, RTI Act 2005, WB Municipal Act 1993, WB Municipal Corporation Act 2006                                                                                                                                                                                                           |
| **Data sovereignty** | All citizen PII storage, identity, files, and vector KB must remain on government-owned / leased infrastructure inside India. **AI inference is the deliberate, audited exception** (ADR-0008): hosted-API inference is permitted with a signed DPA per provider and mandatory PII redaction at the boundary |
| **Licensing**        | Open-source only; no per-seat / per-tenant SaaS in the hot path                                                                                                                                                                                                                                              |
| **Linguistic**       | Three-language parity (en / bn / hi) is non-negotiable for citizen surfaces                                                                                                                                                                                                                                  |
| **Accessibility**    | WCAG 2.1 AA mandatory for all public-facing screens                                                                                                                                                                                                                                                          |
| **Budget**           | _TBD — please supply Capex + Opex envelope_                                                                                                                                                                                                                                                                  |
| **Timeline**         | _TBD — please confirm pilot launch target date_                                                                                                                                                                                                                                                              |
| **Hosting**          | On-prem WB government data centre per ADR-0005                                                                                                                                                                                                                                                               |

## 9. Schedule Reality Check

`ROADMAP.md` projects ~40 weeks of core build (Phase 0 → Phase 10) **assuming a team of 6–8 engineers + 1 PM + 1 designer + 1 QA**. Current contributor model is **solo**, which has three honest implications:

1. **Schedule extends 3–5×** at full scope. A 40-week plan becomes ~24–36 months for a solo developer.
2. **OR scope shrinks to a tight MVP** — recommended approach below.
3. **Parallel mobile + PWA from Phase 5 is overcommitted for solo work.** Recommend: PWA-first for the pilot (4 weeks lead), then RN port reusing `packages/forms` / `packages/sdk` / `packages/i18n`. The architecture stays unchanged; only the sequencing tightens.

### Recommended v1 MVP cut (if solo through Phase 10)

| Phase | Full scope                       | Solo MVP                                                                                                                                        |
| ----- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation (full)                | Same                                                                                                                                            |
| 1     | Tenant + identity (full)         | Same                                                                                                                                            |
| 2     | Service & workflow engine (full) | **5 core services with full schemas** (Birth / Trade Licence / Property Tax / Water Connection / Building Plan); rest seeded with metadata only |
| 3     | Payments (full)                  | One gateway adapter; receipts + GL; defer deposits + challans to v1.1                                                                           |
| 4     | Grievances (full)                | Full (it's small)                                                                                                                               |
| 5     | Citizen mobile + PWA             | **PWA only**; RN deferred to v1.5                                                                                                               |
| 6     | Admin portals (full)             | Tenant admin only; State super-admin v1.1                                                                                                       |
| 7     | Sahayak AI                       | Full (it's mostly config + indexing)                                                                                                            |
| 8     | Bookings / Smart-City / Tenders  | **Bookings only**; rest deferred to v1.1                                                                                                        |
| 9     | Field-officer app                | **Defer to v1.1** entirely                                                                                                                      |
| 10    | Pilot launch                     | Full hardening, but at MVP scope                                                                                                                |

This MVP cut should be **achievable in 9–12 months solo** to a 1-ULB pilot. It's the recommended path. Please ratify or push back.

## 10. Top Risks (initial)

| #   | Risk                                                                         | Likelihood | Impact       | Mitigation                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------- | ---------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Solo schedule slip → loss of sponsor confidence                              | High       | High         | Public weekly progress, demo-driven milestones, MVP cut above                                                                                              |
| R2  | RLS misconfiguration → cross-tenant data leak                                | Medium     | Catastrophic | Mandatory tenant-isolation tests in CI; no PR merges without                                                                                               |
| R3  | Pen-test critical findings late in Phase 10                                  | Medium     | High         | Threat model in Phase 0; weekly Trivy + dependabot from day one                                                                                            |
| R4  | LLM hallucination of fees / SLAs in Sahayak                                  | Medium     | High         | Strict prompt + post-response numeric fact-check against services table                                                                                    |
| R4b | Hosted LLM provider outage / pricing change / TOS change (ADR-0008 exposure) | Medium     | High         | `ILLMProvider` adapter allows hot-swap; per-tenant secondary configured; cost telemetry + budget caps; revisit on-prem migration if cost or trust degrades |
| R4c | PII leak via redaction bypass                                                | Low        | Catastrophic | Adversarial PII test fixtures (≥ 25 cases) in CI; quarterly third-party review; runtime guard refuses unsigned-DPA tenants                                 |
| R5  | Pilot ULB staff resistance / training shortfall                              | Medium     | Medium       | 1-day on-site training + escalation hotline + champion-of-champion                                                                                         |
| R6  | DPDP Act compliance gap discovered late                                      | Low        | High         | DPDP review at end of Phase 1, again at Phase 10                                                                                                           |
| R7  | Payment gateway downtime during pilot                                        | Medium     | High         | Adapter pattern allows hot-swap; transparent status banner                                                                                                 |
| R8  | DigiLocker / Aadhaar integration delays                                      | Medium     | Medium       | OTP-only path remains primary; DigiLocker is enhancer, not blocker                                                                                         |

## 11. Escalation Path

```
Citizen / Tenant ULB issue
        │
        ▼
Helpdesk (L1) — 1800-345-3344, in-app, email
        │
        ▼
Project Engineering Lead — 24h triage SLA
        │
        ▼
Project Director — for tenant disputes / scope decisions
        │
        ▼
Executive Sponsor (DoUD&MA Pr. Secretary) — for cross-department issues
        │
        ▼
DoUD&MA Minister — for legislative / policy enablers
```

## 12. Sign-off Checklist

- [ ] Sponsor name and contact filled
- [ ] Project director name and contact filled
- [ ] Pilot ULBs identified (3)
- [ ] Budget envelope (Capex + Opex) confirmed
- [ ] Pilot launch target date confirmed
- [ ] Solo-vs-team contributor model confirmed; MVP cut ratified or modified
- [ ] DC capacity allocation request submitted to state IT
- [ ] DigiLocker / SMS DLT / Payment gateway sandbox accounts requested
- [ ] DPDP-Act / RTI-Act compliance officer assigned
- [ ] Data Processing Agreements (DPAs) signed with OpenAI and Google (per ADR-0008) before chatbot launch
- [ ] Privacy policy drafted with cross-border-processing disclosure (per ADR-0008)
- [ ] Designated Data Protection Officer (DPO) appointed

---

## Annex A — KPI Telemetry Strategy

Every KPI in §3–§4 must be auto-instrumented from day one:

- **Adoption / engagement**: Prometheus counters incremented on every meaningful citizen event, tagged with `tenant_id` + `ward` + `service_category`.
- **SLA compliance**: derived from `applications.sla_due_at` vs `closed_at`; published as a Grafana dashboard panel + monthly CSV.
- **API performance**: histograms via OpenTelemetry; P50/P95/P99 alerts.
- **AI quality**: thumbs feedback table → daily aggregation job.

Dashboards live in `infrastructure/grafana/dashboards/` and ship as code, not screenshots.

## Annex B — Charter Change Log

| Date       | Change                                                                                                                                                                                                          | Author   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2026-05-06 | Initial draft post Phase 0 ADR ratification (ADR-0001/2/3/5)                                                                                                                                                    | AI agent |
| 2026-05-06 | Sovereignty pillar revised: AI inference moved to hosted-API adapter per ADR-0008; DPA + privacy-policy + DPO items added to sign-off checklist; risks R4b (provider exposure) and R4c (redaction bypass) added | AI agent |

_This charter is a living document. Material changes require sponsor re-sign-off; minor changes require Project Director sign-off and a change-log entry._
