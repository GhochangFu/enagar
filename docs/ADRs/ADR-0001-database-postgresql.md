# ADR-0001 — Database engine: PostgreSQL 16

| Field               | Value                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **Status**          | Accepted                                                                                            |
| **Date**            | 2026-05-06                                                                                          |
| **Decision-makers** | Project Technical Lead (solo contributor for now); to be re-affirmed by sponsor on charter sign-off |
| **Supersedes**      | _none_                                                                                              |
| **Superseded by**   | _none_                                                                                              |
| **Related**         | ADR-0002 (Backend), ADR-0005 (Hosting), ADR-0004 (Workflow engine — pending)                        |

## Context

The platform is multi-tenant by design. Per `ARCHITECTURE.md` §3, the single most important architectural decision is how tenant isolation is enforced. Several related concerns must be answered by the same technology choice:

1. **Tenant isolation** — must be enforceable below the application layer (defence in depth) so an application-code bug cannot leak one ULB's data to another.
2. **Schema flexibility for `form_schema`, `tenant.config`, `services.description` (multilingual), `grievances.location`, `application.form_data`** — all of which are JSON in `ARCHITECTURE.md`.
3. **Anti-double-booking for halls / auditoria / equipment** (`bookings` table) — `ARCHITECTURE.md` §10 uses a **GiST exclusion constraint over `tstzrange`** which is a Postgres-native primitive.
4. **Open-source mandate** — total recurring software-licence cost target: ₹0 (`AGENT.md` §2 pillar 4).
5. **Sovereignty** — must be self-hostable on government infrastructure; on-prem deployment per ADR-0005.
6. **Operational maturity** — backup/restore, replication, monitoring, ecosystem of tooling.
7. **Existing user-context bias** — the project Cursor user-rule provides Azure SQL / SQL Server best-practice guidelines, suggesting team familiarity with Microsoft data stack. This was discussed and explicitly weighed.

## Decision

**We use PostgreSQL 16 as the primary database.**

It is the only commonly-available engine that satisfies all five of (Row-Level Security as a first-class feature, native JSONB with indexing operators, GiST exclusion constraints, free-and-open-source under PostgreSQL Licence, sovereign self-host) without compromise.

We will use:

- **Row-Level Security (RLS)** policies on every tenant-scoped table, gated by `current_setting('app.tenant_id')::uuid`.
- **JSONB** for `form_data`, `form_schema`, `tenant.config`, `services.description` (multilingual), `bookable_assets.rules`, `grievances.location`, etc., with `GIN` indexes where queried.
- **GiST exclusion constraints** for `bookings` anti-double-booking on `tstzrange(start_at, end_at)` per `bookable_asset_id`.
- **Logical replication** for read-replicas at scale (Phase 11+).
- **`pgcrypto`** for hashing (Aadhaar SHA-256 hashes).
- **`pg_trgm`** for case-insensitive name lookups (citizen registry, holding number).
- **Prisma** as the ORM (TypeScript-first; type-safe; integrates with NestJS).

## Alternatives considered

| Option                                         | Pros                                                                                         | Cons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Rejected because                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Azure SQL Database**                         | First-class managed service in Azure; team has existing T-SQL expertise; user-rule pre-baked | (a) hosting target is on-prem (ADR-0005), so the managed offering is irrelevant; (b) no native JSONB — `NVARCHAR(MAX) + JSON_VALUE` works but is far less ergonomic and lacks GIN-equivalent indexing; (c) **no native equivalent of GiST exclusion constraints** — anti-double-booking would need triggers + serializable isolation, more error-prone; (d) RLS in SQL Server is workable but more verbose (security predicates per table); (e) higher cost-per-core if licensed on-prem | On-prem mandate eliminates the managed advantage; structural fit gaps (JSON, exclusion) outweigh team familiarity. The Cursor user-rule for Azure SQL will still apply where we _do_ write SQL Server-style T-SQL (e.g. legacy integrations) but is **not the policy for new schema in this project.** |
| **SQL Server on-prem (Enterprise / Standard)** | T-SQL familiarity; mature on-prem ops                                                        | All Azure-SQL cons above; plus per-core licence cost violates `AGENT.md` pillar 4 (open-source only / ₹0 recurring)                                                                                                                                                                                                                                                                                                                                                                      | Licence cost + structural fit                                                                                                                                                                                                                                                                          |
| **MySQL 8**                                    | Familiar; simple                                                                             | Weaker JSON ecosystem than Postgres; no exclusion constraints; weaker RLS story (relies on view-based hacks)                                                                                                                                                                                                                                                                                                                                                                             | RLS not a first-class feature                                                                                                                                                                                                                                                                          |
| **MariaDB**                                    | True open-source MySQL fork                                                                  | Same RLS / exclusion gaps as MySQL                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Same as MySQL                                                                                                                                                                                                                                                                                          |
| **CockroachDB**                                | Distributed, Postgres wire-compatible                                                        | Operationally heavier; we don't need cross-region replication at v1; some Postgres features (GiST exclusion) not fully supported                                                                                                                                                                                                                                                                                                                                                         | Over-engineered for v1                                                                                                                                                                                                                                                                                 |
| **Document DB (MongoDB / DocumentDB)**         | Flexible schema                                                                              | Multi-document ACID was retrofitted; no RLS; transaction model harder for finance                                                                                                                                                                                                                                                                                                                                                                                                        | Finance ledger work needs strong relational guarantees                                                                                                                                                                                                                                                 |

## Consequences

### Positive

- **Defence-in-depth tenant isolation** is achieved at the database layer, not just in NestJS guards.
- The schema in `ARCHITECTURE.md` translates 1:1 with no rewrites.
- All tooling is free and self-hostable: `pgAdmin`, `pgBackRest`, `wal-e/wal-g`, `patroni` for HA, `pg_partman` for partitioning.
- Deep ecosystem integration with Prisma, NestJS, and the rest of the chosen stack.
- Booking anti-double-booking is _trivially correct_ via exclusion constraint; no race-condition-prone application logic.
- Skill is widely available in WB / India tech market.

### Negative / costs

- Team-skill ramp-up if contributors arrive with a SQL Server background (estimate: 1–2 weeks per developer to be fluent in JSONB + RLS idioms). Mitigation: a "Postgres for SQL Server developers" cheat-sheet in `docs/playbooks/` (to be authored Sprint 0.2).
- The Cursor user-rule "Azure SQL & SQL Server Best Practices" does **not** apply to new schema work in this project. Contributors must consciously translate principles (parameterised queries, covering indexes, batched DML, etc. — which are universal) without applying T-SQL syntax. This will be documented in `AGENT.md` §6.4 as a clarifying note.
- HA on-prem needs explicit attention (Patroni + etcd + repmgr). To be tackled in Phase 10 hardening.

### Neutral / follow-ups required

- **Sprint 0.2 follow-up**: write `docs/playbooks/postgres-for-sql-server-developers.md`.
- **Sprint 0.2 follow-up**: write `docs/playbooks/postgres-on-prem-ops.md` (backup, restore, HA scaffolding, version upgrades).
- **Phase 1 follow-up**: CI-level tenant-isolation test that fails the build if a new tenant table lacks an RLS policy.
- **Phase 11 follow-up**: load-shedding + read-replica architecture review for state-wide rollout.

## Compliance / verification

- **Build-time check**: a custom Prisma migration linter verifies that every table with a `tenant_id` column has a corresponding `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY tenant_isolation` statement in the same migration. CI fails otherwise.
- **Runtime check**: the NestJS request interceptor sets `app.tenant_id` PG session variable from the JWT claim before any query in the request scope. A request without `tenant_id` (other than auth endpoints) gets a 401.
- **Test check**: an integration test pack `tests/security/tenant-isolation.spec.ts` attempts ~50 cross-tenant accesses and asserts they all fail.

## References

- `ARCHITECTURE.md` §3 — Multi-Tenant Database Design
- PostgreSQL 16 release notes — <https://www.postgresql.org/docs/16/release-16.html>
- Postgres RLS docs — <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>
- Postgres exclusion constraints — <https://www.postgresql.org/docs/current/sql-createtable.html#SQL-CREATETABLE-EXCLUDE>
- Cursor user-rule "Azure SQL & SQL Server Best Practices" — applies to T-SQL / legacy SQL Server work only; **not** to new schema in this repository.
