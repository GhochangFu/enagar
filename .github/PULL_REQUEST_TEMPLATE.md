# What & why

<!-- One paragraph: what changed, and *why* (link the issue / ROADMAP item / ADR). -->

## Phase / Sprint

- [ ] Phase: <!-- e.g. Phase 1 -->
- [ ] Sprint: <!-- e.g. Sprint 1.2 -->

## Type

- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] docs
- [ ] test
- [ ] chore
- [ ] infra

## Checklist

- [ ] Lint passes (`pnpm run lint`)
- [ ] Typecheck passes (`pnpm run typecheck`)
- [ ] Tests pass (`pnpm run test`)
- [ ] No new `any`
- [ ] If a public type changed, `@enagar/types` updated and a Pact contract test updated
- [ ] If a new ADR is needed, drafted under `docs/ADRs/`
- [ ] If touching tenant data flow, RLS / tenant guard reviewed
- [ ] If touching the chatbot, PII redaction & cost telemetry verified (per ADR-0008)

## Screenshots / API examples

<!-- For UI changes — before/after. For API changes — sample request/response. -->
