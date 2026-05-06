# @enagar/api

NestJS backend for eNagarSeba (Phase 0 scaffold).

## Stack (per ADR-0002)

- **NestJS 10** on **Node 20** with TypeScript strict mode
- **Pino** structured logging via `nestjs-pino`
- **Helmet** for security headers
- **Swagger** at `/docs` (disabled when `SWAGGER_ENABLED=false`)
- **Terminus** for `/healthz` (liveness) and `/ready` (readiness) probes

## Phase-0 surface

| Route          | Purpose                                                    |
| -------------- | ---------------------------------------------------------- |
| `GET /healthz` | Liveness — heap check                                      |
| `GET /ready`   | Readiness — RSS check (Phase 1 adds DB/Redis/MinIO/Qdrant) |
| `GET /health`  | Plain phase-marker for smoke tests                         |
| `GET /docs`    | Swagger UI                                                 |

## Tenant resolution

`TenantContextMiddleware` is wired up but currently only honours the
`X-Tenant-Code` header for dev convenience. Phase 1 swaps in JWT-claim
and subdomain resolution and adds Prisma RLS context.

## Run locally

```bash
pnpm --filter @enagar/api dev      # http://localhost:3001/health
pnpm --filter @enagar/api build
pnpm --filter @enagar/api test
```

`PORT=3001` by default; override via env.
