# `@enagar/ui`

Web primitives for **`apps/citizen-pwa`**, **`apps/admin-tenant`**, **`apps/admin-state`** — Tailwind presets from **`@enagar/config/tailwind/base`** ( **`brand`** tokens read **`rgb(var(--brand-rgb))`** at runtime from **`@enagar/tenant-theme`**).

## Current exports (Phase 5 / Sprint 5.3+)

See **`src/form-primitives.tsx`**: **`TextField`**, **`NumberField`**, **`DateField`**, **`TextAreaField`**, **`SelectField`**, **`FieldLabel`**, **`SectionHeading`**, **`ChoicePill`**, **`ChoiceGrid`**, **`fieldControlClass`**, …

Citizen **`@enagar/forms/web`** (`DynamicFormFields`) composes these for **`createRenderPlan`** nodes (`platform: 'web'`).

## Consumer Tailwind **`content`** contract

Bundlers only emit classes appearing in scanned files — **apps MUST include**:

- `../../packages/ui/src/**/*.{ts,tsx}`
- **`@enagar/forms/web`** widgets: `../../packages/forms/src/web/**/*.{tsx}`

Reference: **`apps/citizen-pwa/tailwind.config.ts`**.

## Storybook / Radix backlog

Higher-level composites ( **`Button`**, **`Card`**, **Sheet**, … ) remain ROADMAP Phase **2 Storybook / Radix track** unless pulled forward deliberately.
