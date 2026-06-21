# EN-26 Phase 5 — Hardening & docs (EN-46–EN-49)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close EN-26 with extractor unit test coverage, tenant isolation security tests, and operator documentation for both admin portals.

**Architecture:** EN-46 skipped per ADR-0014/EN-27 (draft metadata audit deferred). EN-47 adds Jest specs for remaining extractors/parser/processor. EN-48 extends service + security fingerprint tests. EN-49 adds runbook + in-app operator help sections.

**Tech stack:** Jest, NestJS form-import module, operator help HTML

---

## EN-46 — Skipped

ADR-0014 defers draft `import_source` metadata to MVP+ pending sponsor confirmation. Job-level audit (`source_storage_key`) remains in place.

## EN-47 — Extractor unit tests

- `form-import-table.parser.spec.ts`
- `form-import-job.processor.spec.ts`
- `pdf-acroform.extractor.spec.ts`
- `pdf-digital-text.extractor.spec.ts`
- `form-import.mapper.spec.ts`

## EN-48 — Security / isolation

- Extend `form-import.service.spec.ts` (cross-service, state code mismatch)
- `tests/security/en26-form-import-isolation.spec.ts`

## EN-49 — Operator docs

- `docs/runbooks/form-import-operator-guide.md`
- Tenant + State operator help HTML sections
- Update `docs/runbooks/form-import.md` Phase 5 status
