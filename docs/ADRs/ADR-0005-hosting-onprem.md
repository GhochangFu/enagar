# ADR-0005 — Hosting target: On-prem WB Government data centre (cloud-portable design)

| Field               | Value                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**          | Accepted                                                                                                                              |
| **Date**            | 2026-05-06                                                                                                                            |
| **Decision-makers** | Project Technical Lead; final infrastructure capacity sign-off pending state IT                                                       |
| **Related**         | ADR-0001 (Postgres), ADR-0002 (NestJS), ADR-0008 (LLM provider adapter — AI-inference carve-out), Charter §8 (Sovereignty constraint) |

## Context

Citizen PII (Aadhaar hashes, mobile numbers, addresses, application content), payment records, identity material, and AI inference of citizen queries must remain on government-owned or government-leased infrastructure inside India. This is required by:

- The DPDP Act 2023 data-sovereignty provisions for government services.
- The Charter §8 sovereignty pillar: _"All citizen PII and AI inference must remain on government-owned / leased infrastructure inside India"_.
- `AGENT.md` §2 pillar 3 (current text): _"Data sovereignty for storage; pragmatic adapter for AI inference"_ — citizen PII storage, identity, files, and the vector KB stay on government infrastructure inside India; AI inference is the deliberate, audited exception per ADR-0008.

WB has its own State Data Centre (SDC) infrastructure operated by WBSCSC (West Bengal State Centre for State Computing) and DoIT. The platform must run there.

## Decision

**We deploy the platform on-prem in the WB State Data Centre, on a Kubernetes-based stack, with infrastructure-as-code that is intentionally cloud-portable.**

Concretely:

- **Primary deployment**: WBSDC (or designated equivalent) — Kubernetes (kubeadm or RKE2), 3 control-plane nodes + worker pool sized per-phase.
- **IaC**: Terraform (cloud-agnostic provider) + Helm charts. We deliberately avoid lock-in to any single cloud's PaaS surface so a state-cloud migration (Azure / AWS GovCloud-equivalent / NIC Cloud) remains a configuration change.
- **Object storage**: MinIO on-prem (S3 API compatible), erasure-coded across nodes.
- **Backup target**: a separate on-prem backup tier + an off-site copy at a designated DR location (DR drilling in Phase 10).
- **Identity**: Keycloak self-hosted in the same cluster; HA via Postgres-backed shared-state mode.
- **LLM inference**: ⚠️ **carve-out — see [ADR-0008](./ADR-0008-llm-provider-adapter.md).** The chatbot calls OpenAI / Gemini via the `ILLMProvider` adapter in production with mandatory PII redaction at the boundary; on-prem Ollama remains a configurable fallback (per-tenant override or a future migration). All other components below stay on-prem.
- **TLS**: terminated at Caddy / Nginx ingress; certificates from a state CA or Let's Encrypt (depending on policy on accepting external CAs).

### Cloud-portability discipline

Every IaC module must run against at least two targets in CI (kind or k3d for local; staging cluster for integration). No deployment artifact is allowed to depend on a cloud-specific PaaS that has no on-prem equivalent. Specifically:

| Capability   | On-prem implementation            | Cloud equivalents (for portability — not used) |
| ------------ | --------------------------------- | ---------------------------------------------- |
| K8s cluster  | RKE2 / kubeadm                    | EKS / AKS / GKE                                |
| DB           | Self-managed Postgres + Patroni   | Aurora / Azure DB / Cloud SQL                  |
| Object store | MinIO                             | S3 / Azure Blob / GCS                          |
| Cache        | Redis (self-managed, sentinel HA) | ElastiCache / Azure Cache / Memorystore        |
| Search       | Meilisearch                       | n/a                                            |
| Vector       | Qdrant                            | Pinecone (rejected — SaaS)                     |
| LLM          | Ollama                            | n/a                                            |
| TLS          | Caddy / Nginx                     | Cloud LB                                       |
| DNS          | State DNS / NIC DNS               | Route 53 / Azure DNS                           |
| Logs         | Loki                              | CloudWatch / Log Analytics                     |
| Metrics      | Prometheus                        | Managed Prometheus / Azure Monitor             |
| Traces       | Tempo                             | X-Ray / Application Insights                   |

## Alternatives considered

| Option                                                  | Pros                                                 | Cons                                                                                                                                                                            | Rejected because                                                                                           |
| ------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Azure (state cloud agreement)**                       | Managed services reduce ops burden; auto-scale; SLAs | Sovereignty: Indian Azure regions exist but are still operated by Microsoft, not the state; PII residency satisfied but not "government-operated"; SaaS lock-in cost over years | Charter sovereignty constraint chooses on-prem                                                             |
| **AWS / GCP**                                           | Same as Azure                                        | Same as Azure + no existing state agreement                                                                                                                                     | Same as Azure                                                                                              |
| **Hybrid (citizen-facing in cloud, sensitive on-prem)** | Cloud agility for stateless tier                     | Latency between on-prem DB and cloud API; doubles operational surface; complicates RLS context propagation across the boundary                                                  | Operational complexity not justified for v1                                                                |
| **NIC Cloud / MeghRaj**                                 | Government cloud                                     | Capacity / API maturity uncertain at our scale; on-prem already known good                                                                                                      | Lower risk to start with state-controlled DC; revisit at Phase 11 if NIC Cloud capacity becomes attractive |
| **Pure single-machine Docker Compose**                  | Simpler ops                                          | No HA; no rolling upgrades; not state-wide-rollout-capable                                                                                                                      | Suitable only for dev (`infrastructure/docker-compose.yml`)                                                |

## Consequences

### Positive

- **Sovereignty satisfied** unambiguously.
- **Predictable cost** — no per-API-call billing surprise as adoption scales.
- **Full operational control**: outage windows, security patching, upgrade cadence are all owned by the state team.
- **Data never crosses to a non-government operator**.
- IaC / Helm portability means a _future_ state-cloud move (NIC Cloud) is a configuration change, not a re-architecture.

### Negative / costs

- **Operational burden** on state IT + project team: HA, backups, OS patching, K8s upgrades, certificate rotation, monitoring, on-call rotation. Mitigation: Phase 10 hardening explicitly covers DR drills, runbooks, and 24×7 on-call.
- **Capacity planning** is up-front and harder to flex than cloud auto-scale. Mitigation: over-provision by 30 % for pilot; instrument carefully; Phase 11 includes a capacity review after the first 5 ULBs.
- **GPU acquisition** for Ollama at scale is a procurement project, not a credit-card click. Mitigation: CPU-only Llama 3.1 8B is acceptable for pilot volume; GPU procurement runway begins in Phase 8.
- **Disaster Recovery is fully on us** — no cross-AZ magic. Mitigation: nightly Postgres + MinIO snapshot replication to a designated DR site; quarterly DR drill from Phase 10.

### Neutral / follow-ups required

- **Sprint 0.2 follow-up**: capacity-planning request submitted to WBSCSC / state IT (`docs/playbooks/capacity-request.md`).
- **Sprint 0.2 follow-up**: write `docs/playbooks/onprem-bootstrap.md` covering K8s bring-up, namespace layout, network policies, and ingress.
- **Phase 1 follow-up**: identify the DR site and storage allocation.
- **Phase 10 follow-up**: full DR drill runbook + first drill executed.

## Compliance / verification

- **CI portability test**: every Helm chart deploys cleanly against `kind` (local Kubernetes-in-Docker). If a chart hard-codes a cloud-PaaS dependency, it fails this test.
- **Network policies**: Kubernetes `NetworkPolicy` objects enforce that workers only talk to the services they need; lateral movement is blocked. Verified by a `policy-test` job in CI.
- **Secrets**: stored in Sealed Secrets / Vault — never in git, never in compose files committed to the repo (`.env.example` is the only `.env*` file allowed in git).

## References

- Charter §8 — Constraints (Sovereignty)
- `AGENT.md` §2 — Pillars
- `ARCHITECTURE.md` §1 — Open-source stack
- DPDP Act 2023 — relevant sections on government processing of personal data
