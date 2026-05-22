# Typography & PWA chrome — DM Sans (Option 2)

**Status:** Complete (Citizen PWA + Tenant Admin + State Admin)  
**Decision:** Sponsor chose **Option 2 — GovTech DM Sans** for Citizen PWA, Tenant Admin, and State Admin, with lighter icon+label buttons and aesthetic PWA header/footer.

## Goals

1. Replace **Plus Jakarta Sans** with **DM Sans** as the platform UI font (headings and body unified).
2. Keep **Noto Sans Bengali** / **Noto Sans Devanagari** for `bn` / `hi` locale stacks.
3. **Buttons:** `font-medium` (500), slightly smaller label sizes, optional **16px icon + label** via `@enagar/ui` `Button`.
4. **Icons:** Extend `Icon` set; use on Services cards, Grievances surfaces, and hub/workspace nav tabs.
5. **Citizen PWA chrome:** `CitizenPwaHeader` + `CitizenPwaFooter` on hub and workspace (preview-first in `docs/design-previews/citizen-pwa-shell-preview.html`).

## Files to change

| Area       | Files                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens     | `packages/config/styles/tricolor-calm.css`, `packages/config/tailwind/base.js`                                                                                                  |
| Apps       | `apps/citizen-pwa/app/globals.css`, `apps/admin-tenant/app/globals.css`, `apps/admin-state/app/globals.css`                                                                     |
| UI kit     | `packages/ui/src/components/Button.tsx`, `packages/ui/src/components/Icon.tsx`                                                                                                  |
| PWA        | `apps/citizen-pwa/components/citizen-site-shell.tsx`, `apps/citizen-pwa/lib/service-icons.ts`, `citizen-hub-components.tsx`, `citizen-workspace-components.tsx`, `app/page.tsx` |
| Grievances | `grievances-workspace.tsx` (primary CTAs → `Button` + icons where low-risk)                                                                                                     |
| Docs       | `docs/design-system.md` §2.2, this runbook                                                                                                                                      |

## Acceptance criteria

- [ ] All three Next apps render body and headings in DM Sans (no Plus Jakarta in CSS).
- [ ] `Button` defaults: `font-medium`, `text-xs`/`text-sm` by size, `icon` prop renders 16px glyph before label.
- [ ] Hub/workspace show header (brand, tagline, language) and footer (WB context, Euphoria credit, help links).
- [ ] Service cards show category icon; Apply uses icon+label button.
- [ ] Hub/workspace tab labels use `font-medium` (not `font-black`).
- [ ] Preview HTML matches implemented chrome within one revision cycle.
- [ ] `graphify update .` after code edits.

## Out of scope

- Figma export, tenant logo API fix (`/tenants` vs Postgres) — separate programme item.
- Mobile RN app fonts — web-only unless requested later.

## Verification

```bash
pnpm --filter citizen-pwa dev
# Open hub after login; confirm DM Sans, header/footer, icon buttons
npx serve docs/design-previews -p 8788
# Compare citizen-pwa-shell-preview.html to live hub
```
