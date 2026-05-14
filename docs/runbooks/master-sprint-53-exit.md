# Master Phase 5 — **Sprint 5.3** exit (locked queue **#6**) — shared PWA form spine

**Status: closed — engineering (repo)** · **2026-05-14**  
_ROADMAP pointer: [`ROADMAP.md` § Locked queue](../../ROADMAP.md#locked-next-10-sprint-queue-priority-execution-order)._

This sprint delivers the **dual-surface parity spine** mandated for Phase 5: citizen **Apply** UX on **`apps/citizen-pwa`** consumes the same **`@enagar/forms`** render-plan contract as **`@enagar/mobile`**, layered on **`@enagar/ui`** Tailwind primitives (CSS vars **`--brand-rgb`** from **`@enagar/tenant-theme`**).

**CI (2026-05-14):** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:security`.

---

## Subsplit (execution)

| Subslice | Delivered                                                                                                                                                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5.3a** | **`@enagar/ui`** — form control primitives (**`fieldControlClass`**, **`TextField`**, **`ChoicePill`**, section chrome, …) replacing the Phase-0 stub. **`@enagar/config/eslint/react-library`** for library TSX lint (no bogus Next `pages/` requirement).                                                    |
| **5.3b** | **`@enagar/forms/web`** export — **`DynamicFormFields`** (**`ChoicePill`** parity includes **`multi-choice-list`**, aligning with **`DynamicFormFields`** Expo).                                                                                                                                               |
| **5.3c** | **Citizen PWA** refactor — **`lib/service-schemas.ts`** (fixture map + **`defaultFormValuesForService`**); **`tailwind.config.ts`** **`content`** includes **`packages/ui/src`** + **`packages/forms/src/web`** so production builds keep utility classes; **`app/page.tsx`** applies **`DynamicFormFields`**. |

---

## Exit criteria

- [x] **Single render contract:** PWA **`createRenderPlan`** (**`platform: 'web'`**) drives **`DynamicFormFields`** backed by **`@enagar/ui`**, not duplicated inline **`RenderField`** logic.
- [x] **Fixture map** lives in **`apps/citizen-pwa/lib/service-schemas.ts`** and mirrors **`@enagar/mobile`** / API smoke defaults.
- [x] **`pnpm lint`**, **`pnpm typecheck`**, **`pnpm test`**, **`pnpm test:security`** succeed.
- [x] **`ARCHITECTURE.md`**, **`ROADMAP.md`**, **`packages/ui/README.md`**, **`apps/citizen-pwa/README.md`**, **`docs/help/start-the-app-step-by-step.md`** cite this sprint.

### Deferred (unchanged roadmap owners)

**Sprint 5.4:** Web Push / deep-links / axe perf gates / Lighthouse hard CI (Phase 5 exit).

### Sign-off

| Role          | Notes                | Date           |
| ------------- | -------------------- | -------------- |
| Product owner | _(optional sponsor)_ |                |
| Engineering   | Repo CI verification | **2026-05-14** |
