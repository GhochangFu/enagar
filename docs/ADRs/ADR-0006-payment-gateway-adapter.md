# ADR-0006 — Payment gateway adapter

| Field               | Value                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| **Status**          | Accepted for Sprint 3.1A; real aggregator selection deferred                                           |
| **Date**            | 2026-05-08                                                                                             |
| **Decision-makers** | Project Technical Lead                                                                                 |
| **Supersedes**      | _none_                                                                                                 |
| **Superseded by**   | _none_                                                                                                 |
| **Related**         | ADR-0001 (Postgres), ADR-0002 (NestJS), ADR-0005 (On-prem), ADR-0010 (External-data provider adapters) |

## Context

Phase 3 needs reliable application payments, receipts, GL postings, refunds, challans, and reconciliation. Gateway sandbox credentials and the real payment aggregator details are not available yet, so we cannot safely bind the platform to Razorpay, PayU, or any other provider-specific API.

The platform still needs to move forward. Idempotency, tenant/citizen ownership checks, payment state transitions, amount validation, audit-friendly references, and PCI-DSS scope minimisation are internal platform responsibilities. These can be built and tested before the live gateway contract is available.

## Decision

**We adopt an `IPaymentGateway` adapter contract and ship Sprint 3.1A with a deterministic `stub` gateway as the only runnable adapter until sandbox credentials are issued.**

The API and domain services must depend on the interface, not on Razorpay/PayU SDKs directly. The first runnable implementation is `StubPaymentGateway`, used for local development, CI, and demos. Real gateway adapters remain credential-gated and aggregator-gated; they must be added without changing controller contracts or citizen-facing payment lifecycle semantics.

Sprint 3.1A covers fixed-fee application payments only. Computed slab fees remain a later slice. Sprint 3.2 **(closed 2026-05-11)** shipped immutable `receipts`, public verifier + QR contract metadata, `gl_postings`, IST-day CSV reconciliation groundwork, deterministic stub settlements, and `PaymentsService`/`PostgresPaymentStore` integration tests for those rows; printable receipt PDF/HTML pipelines stay future work. Sprint 3.3A **(closed 2026-05-11)** persists refundable **deposits**, finance **refund_dispatches**, enforcement **challans**, plus `/api/finance/*` staff RBAC staging flows — still **without** PSP refund disbursement RPCs (`complete-internal` bookkeeping only until Sprint 3.1B). Payment correctness continues to rely on Postgres persistence via async-ready `CitizenStore`, `ApplicationStore`, and `PaymentStore`; `CitizenStore` stays Postgres-backed, while `APPLICATION_STORE_PROVIDER=postgres` and `PAYMENT_STORE_PROVIDER=postgres` remain explicit activation gates.

Until PSP sandbox credentials land, backlog ordering is Sprint 3.4A ✅ (citizen payment UX closed 2026-05-11), Sprint 3.3A ✅ (`deposits` / `refund_dispatches` / `challans` tables + `/api/finance/*` internal approval flows closed 2026-05-11 — no PSP refund RPCs yet), and Sprint 3.1B as the PSP interrupt lane.

## Alternatives considered

| Option                                          | Pros                | Cons                                                                                   | Rejected because                                                    |
| ----------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Build Razorpay/PayU directly in controllers     | Fast initial demo   | Couples API to one vendor, hard to test without credentials, harder to swap per tenant | Violates the adapter pattern already used for external integrations |
| Block all Phase 3 work until credentials arrive | Avoids rework       | Stops progress on idempotency, DB/API shape, and failure handling                      | Gateway credentials are external to the engineering schedule        |
| Stub-only with no gateway interface             | Simple test harness | Encourages throwaway code and hides provider boundaries                                | The real adapter will arrive soon and needs a stable contract       |

## Consequences

### Positive

- Sprint 3.1A can start without sandbox credentials.
- Controllers and services stay gateway-agnostic.
- Idempotency and tenant/citizen isolation can be tested early.
- PCI-DSS scope remains narrow because no card data enters the platform.

### Negative / costs

- Real redirect URLs, webhook payloads, signature validation, refunds, and gateway reconciliation cannot be validated yet.
- Provider-specific settlement states may require additions once sandbox docs and credentials are available.
- Fixed-fee-only enforcement means computed property-tax payments and `deposit_paise` collection are blocked until the fee-rule/payment and deposits/refunds slices.

### Neutral / follow-ups required

- Choose the first real provider once aggregator details and sandbox access are confirmed: Razorpay, PayU, or a state-contracted aggregator.
- Add real webhook signature verification and replay protection before exposing public webhook processing.
- Keep provider activation explicit (`APPLICATION_STORE_PROVIDER=postgres`, `PAYMENT_STORE_PROVIDER=postgres`) until the remaining application workflows are ready for Postgres-by-default runtime activation.
- Execute gateway-independent slices in this order while credentials are pending: Sprint 3.4A citizen payment UI ✅; Sprint 3.3A deposit/refund/challan persistence + finance staff staging APIs (**receipt / GL groundwork completed Sprint 3.2, 2026-05-11** — **schema + approvals closed Sprint 3.3A 2026-05-11**).

## Compliance / verification

- `POST /payments/initiate` must require an `Idempotency-Key` header.
- Reusing an idempotency key with a different body must fail.
- Cross-tenant and cross-citizen payment access must return non-data-bearing not-found errors.
- `RUN_DB_TESTS=1` must prove Postgres application persistence, payment/idempotency persistence against `payments.application_id`, Sprint 3.2 settlement (`receipts` + `gl_postings`), and **Sprint 3.3A finance flows (`deposits`, `refund_dispatches`)** before widening Postgres payment activation in runtime environments.
- `POST /payments/stub/complete` must remain production gated (`ALLOW_STUB_PAYMENT_SETTLEMENT`) until Sprint 3.1B redirects/webhooks supersede deterministic capture.
- Real gateway adapters must implement `IPaymentGateway`; controller code must not import provider SDKs.

## References

- [`ROADMAP.md`](../../ROADMAP.md) Phase 3.
- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) Payments API.
