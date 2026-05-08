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

Sprint 3.1A covers fixed-fee application payments only. Computed fees, deposits, refunds, challans, and receipt PDFs are intentionally deferred to later Phase 3 slices. Payment attempts and idempotency keys are modelled in Postgres immediately because payment correctness must not depend on process-local memory. The API therefore uses async-ready `CitizenStore`, `ApplicationStore`, and `PaymentStore` boundaries. `CitizenStore` is now backed by Postgres; `PostgresApplicationStore` is available behind `APPLICATION_STORE_PROVIDER=postgres`; and `PostgresPaymentStore` is available behind `PAYMENT_STORE_PROVIDER=postgres`. Gated `RUN_DB_TESTS=1` specs have passed against local Postgres for application persistence and payment/idempotency persistence against a real application foreign key.

Until real gateway sandbox credentials arrive, the next Phase 3 sequence is: Sprint 3.2 for receipts, GL postings, and reconciliation groundwork; Sprint 3.4A for citizen payment UI and recoverable failure states; and Sprint 3.3A for deposit/refund/challan data modelling without real refund API calls. Sprint 3.1B remains an interrupt lane and starts as soon as provider credentials and sandbox documentation are available.

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
- Execute gateway-independent slices in this order while credentials are pending: Sprint 3.2 receipts/GL/reconciliation, Sprint 3.4A citizen payment UI, then Sprint 3.3A deposit/refund/challan modelling.

## Compliance / verification

- `POST /payments/initiate` must require an `Idempotency-Key` header.
- Reusing an idempotency key with a different body must fail.
- Cross-tenant and cross-citizen payment access must return non-data-bearing not-found errors.
- `RUN_DB_TESTS=1` must prove Postgres application persistence and payment/idempotency persistence against the real `payments.application_id` foreign key before enabling Postgres payment storage in runtime environments.
- Real gateway adapters must implement `IPaymentGateway`; controller code must not import provider SDKs.

## References

- [`ROADMAP.md`](../../ROADMAP.md) Phase 3.
- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) Payments API.
