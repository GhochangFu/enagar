# ADR-0002 — Backend framework: NestJS on Node 20 (TypeScript)

| Field               | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| **Status**          | Accepted                                                         |
| **Date**            | 2026-05-06                                                       |
| **Decision-makers** | Project Technical Lead                                           |
| **Related**         | ADR-0001 (Database), ADR-0003 (Mobile / PWA), ADR-0005 (Hosting) |

## Context

The platform's backend must serve five clients (Citizen PWA, Citizen RN, Tenant Admin, State Super-Admin, Field Officer App), expose an OpenAPI-driven REST surface, manage a typed SDK consumed by every client, integrate with Postgres + Redis + Qdrant + Ollama + MinIO + Keycloak, and run background jobs. It must do this with strong type safety, modular boundaries that match per-tenant isolation, and an idiomatic path to splitting micro-services later (chatbot, indexer, workflow worker).

## Decision

**We use NestJS 10+ on Node.js 20 (LTS) with TypeScript strict mode for the API and all NestJS-based worker services.**

NestJS provides:

- A modular architecture (one module per domain area: `auth`, `tenant`, `citizen`, `service`, `application`, `payment`, `grievance`, `chatbot`, `notification`) that maps directly to the per-tenant feature surface.
- First-class OpenAPI generation via `@nestjs/swagger` — the OpenAPI spec is the contract; clients derive a typed SDK from it.
- Guards, pipes, interceptors that align with the cross-cutting concerns we need: JWT verification, tenant binding, validation, structured logging, error mapping to RFC 7807 `application/problem+json`.
- Native Prisma integration patterns; Postgres RLS sits cleanly behind a request-scoped Prisma client that runs `SET LOCAL app.tenant_id = $jwt.tenant_id` before every transaction.
- BullMQ integration (`@nestjs/bullmq`) for the workers in `services/notification-worker`, `services/reporting-worker`, etc.
- Full Server-Sent Events support (used by Sahayak AI streaming).

Node 20 LTS is supported until April 2026 — this should be re-evaluated annually; we will move to Node 22 LTS once we are stable on 20.

## Alternatives considered

| Option                          | Pros                                                                        | Cons                                                                                                                                                                                                                                                   | Rejected because                                        |
| ------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| **ASP.NET Core / .NET 8 (C#)**  | Strong typing; high performance; great IDE; pairs naturally with SQL Server | (a) Postgres ecosystem maturity is weaker (Npgsql + EF Core works but lags Prisma in JSONB ergonomics); (b) team-language fragmentation if frontend is TypeScript; (c) higher memory baseline; (d) no benefit since we don't use SQL Server (ADR-0001) | Loss of TypeScript end-to-end; chosen DB is Postgres    |
| **Spring Boot / Java 21**       | Battle-tested; large talent pool                                            | Verbose; slowest dev iteration; no shared types with frontend                                                                                                                                                                                          | Productivity hit for solo / small team                  |
| **Fastify (raw, no framework)** | Fastest Node framework; small surface                                       | We'd reinvent module structure, DI, OpenAPI gen, validation                                                                                                                                                                                            | NestJS solves all this idiomatically                    |
| **tRPC**                        | End-to-end TS without OpenAPI                                               | Mobile / 3rd-party / future-WhatsApp / DigiLocker integrations need plain HTTP/OpenAPI                                                                                                                                                                 | OpenAPI is non-negotiable for our integration footprint |
| **Hono / Elysia (edge-native)** | Lean; fast cold-start                                                       | We're on-prem K8s, not edge; no decisive advantage                                                                                                                                                                                                     | Solving a problem we don't have                         |
| **Go (Gin / Echo)**             | Compiled, low memory                                                        | No type sharing with TS clients; smaller talent pool in WB                                                                                                                                                                                             | Same fragmentation argument as .NET                     |

## Consequences

### Positive

- **Single language across the stack**: TypeScript in API, PWA, RN, admin portals, packages, services. Shared types in `packages/types`. Shared SDK in `packages/sdk`.
- OpenAPI generated from decorators → `pnpm run generate:sdk` produces a fully typed client used by all five client apps.
- Clean module boundaries; future micro-service split (chatbot, indexer, workflow) is a code-extraction exercise, not a rewrite.
- Strong testing story: NestJS testing utilities + Jest + Supertest for HTTP + Pact for contract.
- Hot-reload dev experience via `nest start --watch` is excellent.

### Negative / costs

- Heavier than Fastify-raw at runtime (~30–60 MB baseline RAM per worker). Acceptable for our load profile.
- Decorator-heavy code style takes 1–2 days to onboard for a Node/Express developer.
- DI container overhead is visible in flame graphs but never the bottleneck (DB and external IO dominate).

### Neutral / follow-ups required

- **Sprint 0.2 follow-up**: NestJS module template with `@nestjs/swagger`, validation pipe, error filter, tenant guard pre-installed.
- **Sprint 0.2 follow-up**: SDK generation script (`pnpm run generate:sdk`) wired into Turborepo pipeline.
- **Phase 1 follow-up**: integration with Keycloak via `passport-jwt` + JWKS rotation strategy.

## Compliance / verification

- **Code review checklist** in `AGENT.md` §6: every controller has `@ApiTags` and `@ApiResponse`; every DTO uses `class-validator`; every service is unit-testable.
- **CI**: `pnpm run lint` (`@typescript-eslint`) + `pnpm run typecheck` (`tsc --noEmit`); `--max-warnings 0`.
- **CI**: OpenAPI spec is regenerated on every PR; if the spec diff is non-trivial and the SDK is not regenerated in the same PR, CI fails.

## References

- `ARCHITECTURE.md` §5 — API endpoints
- `ARCHITECTURE.md` §7 — Project structure
- NestJS docs — <https://docs.nestjs.com/>
- Node 20 LTS schedule — <https://nodejs.org/en/about/releases>
