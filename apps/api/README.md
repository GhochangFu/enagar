# @enagar/api

NestJS backend for eNagarSeba.

## Stack (per ADR-0002)

- **NestJS 10** on **Node 20** with TypeScript strict mode
- **Pino** structured logging via `nestjs-pino`
- **Helmet** for security headers
- **Swagger** at `/docs` (disabled when `SWAGGER_ENABLED=false`)
- **Terminus** for `/healthz` (liveness) and `/ready` (readiness) probes

## Current surface

| Route                                                                                                     | Purpose                                      |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `GET /healthz`                                                                                            | Liveness — heap check                        |
| `GET /ready`                                                                                              | Readiness — RSS check                        |
| `GET /health`                                                                                             | Plain smoke-test health marker               |
| `GET /docs`                                                                                               | Swagger UI                                   |
| `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/refresh`, `POST /api/auth/logout` | Citizen auth flow                            |
| `GET /api/tenants`, `GET /api/tenants/:id/config`                                                         | Public tenant picker/config data             |
| `POST /api/citizen/register`, `GET /api/citizen/profile`, `PATCH /api/citizen/profile`                    | JWT-protected citizen profile API            |
| `PATCH /api/citizen/language`, `POST /api/citizen/select-tenant`                                          | JWT-protected citizen preference/tenant APIs |
| `POST /api/auth/aadhaar-link`                                                                             | Placeholder; real DigiLocker is blocked      |

## Tenant resolution

Protected handlers derive tenant context from the verified JWT claim through
`JwtAuthGuard`. `TenantContextMiddleware` keeps the `X-Tenant-Code` escape hatch
for local tooling only and rejects that header in production.

Admin-role JWTs (`tenant_admin`, `state_admin`) must include MFA evidence
through `amr: ["otp"]` or `acr: "mfa"`.

## Run locally

```bash
pnpm --filter @enagar/api dev      # http://localhost:3001/health
pnpm --filter @enagar/api build
pnpm --filter @enagar/api test
pnpm test:security
```

`PORT=3001` by default; override via env.
