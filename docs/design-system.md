# Design system

> **Purpose.** Lock the visual + interaction language for every eNagarSeba surface (citizen-PWA, mobile, admin portals, staff app) so that Phase-2 component work has a tokenised foundation rather than ad-hoc CSS.

> **Scope of v0.1.** Tokens, iconography, multi-tenant theming model, component inventory, and **textual wireframes** for the six critical citizen flows. Pixel-level Figma artefacts are intentionally out of scope — we are an open-source government project and wireframes need to survive copy-paste, version control, and code review.

> **Status:** Sprint 0.2 deliverable. Implemented incrementally from Phase 2 onwards under `@enagar/ui` (web) and `@enagar/ui-native` (RN).  
> **Phase UX (Sprints 6.14–6.19):** Sponsor-confirmed revamp — **Tricolor Calm** platform pastels + tenant palette derivation — see [`docs/runbooks/phase-ux-revamp-plan.md`](./runbooks/phase-ux-revamp-plan.md). Typography locked to **DM Sans** (Option 2 — GovTech) + **Noto** (bn/hi) across Citizen PWA, Tenant Admin, and State Admin; see [`docs/runbooks/typography-dm-sans-ux-plan.md`](./runbooks/typography-dm-sans-ux-plan.md).

---

## 1. Design principles

1. **Accessibility is non-negotiable.** WCAG 2.1 AA on every page. Touch targets ≥ 44 px. Visible focus rings. Real `<button>`, real `<a>`, real `<label>`. Screen-reader tested in English first, Bengali next.
2. **Multilingual-first.** Every screen mockup is rendered in **all three** locales before sign-off. We do not say "we'll add Bengali later." Strings live in `@enagar/i18n` from day one.
3. **Tenant-themable, never tenant-fragmented.** A ULB can change its **brand colour, logo, default language, and feature flags** at runtime. It cannot change the layout, navigation, or component shapes — those are platform-wide.
4. **Mobile-first, but not mobile-only.** Citizen surfaces are designed for a 360 px Android in poor connectivity, then progressively enhanced for tablet, then desktop. Operator surfaces start at 1280 px.
5. **Consistency over cleverness.** A `Card` looks the same across services. A `submit` button reads `submit` everywhere. Surprises cost trust in a government app.
6. **Information density on operator surfaces, breathing room on citizen surfaces.** Citizens process one decision per screen. Officers process twenty.
7. **No "wow" moments at the cost of speed.** No multi-second hero animations. No autoplay video. The first contentful paint on the slowest target device determines our motion budget.

---

## 2. Tokens

### 2.1 Colour tokens

#### Brand (per-tenant, runtime-overridable)

The Tailwind preset (`@enagar/config/tailwind/base`) maps `bg-brand` / `text-brand` to two CSS variables. The default values are KMC's. `@enagar/tenant-theme` rewrites them at runtime.

```css
:root {
  --brand-rgb: 15 76 117; /* default: KMC slate-blue (#0F4C75) */
  --brand-fg-rgb: 255 255 255;
  --brand-muted-rgb: 232 237 241; /* mix(brand, white, 88%) — badges, chips */
  --brand-surface-rgb: 237 242 246; /* mix(brand, white, 92%) — tenant header wash */
}
```

#### Warm Coral platform shell — Option B+ Pro (Citizen PWA, sponsor-locked 2026-05)

Imported from `@enagar/config/styles/tricolor-calm.css` (filename retained). **Solid colours only — no gradients.** Peach/salmon are **accents**, not full-page fills.

| Token            | Hex       | CSS variable            | Tailwind                    | Use                              |
| ---------------- | --------- | ----------------------- | --------------------------- | -------------------------------- |
| Canvas           | `#FAF7F4` | `--canvas-rgb`          | `bg-canvas`                 | Page background (warm white)     |
| Surface          | `#FFFFFF` | `--surface-rgb`         | `bg-surface`                | Cards, modals                    |
| Warm border      | `#E8DDD6` | `--border-warm-rgb`     | `border-warm-border`        | Dividers                         |
| Peach accent     | `#FFCDAA` | `--peach-accent-rgb`    | `bg-peach-accent`           | Top strip, small chips only      |
| Peach soft       | `#FFF0E6` | `--peach-soft-rgb`      | `bg-peach-soft`             | Optional card highlight          |
| Platform primary | `#BF4A0A` | `--platform-accent-rgb` | `text-platform-accent`      | Hub CTAs (`applyPlatformTheme`)  |
| Link on canvas   | `#7A3A12` | `--link-rgb`            | `text-link`                 | Inline links on canvas           |
| Mint band        | `#E8F0E7` | `--mint-band-rgb`       | `bg-mint-band`              | KPI strip, grievance detail head |
| Sage             | `#9CB898` | `--sage-rgb`            | `bg-sage`                   | Chips, badges                    |
| Forest           | `#4A6B47` | `--forest-rgb`          | `bg-forest` / `text-forest` | Secondary actions, KPI numbers   |
| Ink primary      | `#2B211F` | `--text-primary-rgb`    | `text-ink-primary`          | Headings, body                   |
| Ink secondary    | `#5C4A47` | `--text-secondary-rgb`  | `text-ink-secondary`        | Meta, captions                   |
| Ink muted        | `#7A6561` | `--text-muted-rgb`      | `text-ink-muted`            | Placeholders                     |

Runtime: `applyPlatformTheme()` sets hub/auth brand to **`#BF4A0A`** (`PLATFORM_BRAND_HEX`); `applyTenantTheme(tenant)` sets ULB `theme_color` in workspace. Preview: [`docs/design-previews/citizen-pwa-palette-preview.html`](./design-previews/citizen-pwa-palette-preview.html).

| Tenant | Hex       | Theme rationale                    |
| ------ | --------- | ---------------------------------- |
| KMC    | `#0F4C75` | Heritage municipal blue            |
| HMC    | `#1B5E20` | Howrah river / Iron-bridge green   |
| CMC    | `#6A1B9A` | Chandannagar's French legacy       |
| BMC    | `#0277BD` | Bidhannagar (Salt Lake) coastal    |
| SMC    | `#2E7D32` | Siliguri / Himalayan foothill      |
| AMC    | `#BF360C` | Asansol's industrial heritage      |
| DMC    | `#37474F` | Durgapur's steel grey              |
| SDDM   | `#4527A0` | South Dum Dum's residential indigo |

> **Override rule.** A new tenant may pick any colour with **WCAG AA contrast ratio ≥ 4.5:1** against `--brand-fg-rgb`. The admin portal validates contrast at colour-pick time and refuses to save sub-AA values.

#### Semantic palette (platform-wide, not overridable)

| Role             | Light                 | Dark                  | Use                     |
| ---------------- | --------------------- | --------------------- | ----------------------- |
| `text-primary`   | `#0F172A` (slate-900) | `#F8FAFC` (slate-50)  | Headings, body          |
| `text-secondary` | `#475569` (slate-600) | `#94A3B8` (slate-400) | Captions, meta          |
| `text-muted`     | `#64748B` (slate-500) | `#64748B`             | Disabled, placeholders  |
| `bg-base`        | `#F8FAFC` (slate-50)  | `#0B1120`             | Page background         |
| `bg-surface`     | `#FFFFFF`             | `#111827`             | Cards, panels           |
| `bg-elevated`    | `#FFFFFF`             | `#1F2937`             | Modal / popover surface |
| `border`         | `#E2E8F0` (slate-200) | `#334155` (slate-700) | Dividers                |
| `success`        | `#16A34A` (green-600) | `#22C55E`             | Approved, paid          |
| `warning`        | `#D97706` (amber-600) | `#F59E0B`             | Pending, late           |
| `danger`         | `#DC2626` (red-600)   | `#EF4444`             | Rejected, errors        |
| `info`           | `#0284C7` (sky-600)   | `#0EA5E9`             | Notifications           |

> **Status verbs map** (matches glossary §10): `success` = `submit`/`approve`/`resolve`; `warning` = `pending`/`return-for-correction`/`escalate`; `danger` = `reject`; `info` = neutral (`assign`, `submitted`).

### 2.2 Typography

```
DM Sans               →  default Latin (en) — body and headings (unified stack)
Noto Sans Bengali     →  bn (system fallback first, Noto next)
Noto Sans Devanagari  →  hi
Plus Jakarta Sans     →  deprecated (replaced by DM Sans, 2026-05)
Inter                 →  deprecated as default (removed in 6.14); legacy docs only
```

| Token          | Size  | Line-height | Weight | Use                        |
| -------------- | ----- | ----------- | ------ | -------------------------- |
| `text-xs`      | 12 px | 16 px       | 500    | Caption, helper text       |
| `text-sm`      | 14 px | 20 px       | 500    | Form labels, secondary nav |
| `text-base`    | 16 px | 24 px       | 400    | Body                       |
| `text-lg`      | 18 px | 28 px       | 600    | Card titles                |
| `text-xl`      | 20 px | 28 px       | 600    | Section headings           |
| `text-2xl`     | 24 px | 32 px       | 700    | Page titles                |
| `text-3xl`     | 30 px | 36 px       | 700    | Hero titles                |
| `text-display` | 36 px | 40 px       | 700    | Onboarding splash          |

> **Bengali / Hindi sizing.** Devanagari and Bengali scripts have larger optical x-heights. We bump `line-height` by 4 px (`+0.25rem`) when the active locale is `bn` or `hi`. The shared Tailwind preset will expose `font-bn` / `font-hi` utility classes wired to those families.

**Citizen PWA rendering (Sprint 6.16 + B+ Pro palette).** `apps/citizen-pwa/app/globals.css` imports platform tokens; body and headings use **DM Sans** via `var(--tenant-font-family)` / `var(--platform-heading-font)` with **Noto** fallbacks. Hub/workspace use `CitizenPwaHeader` / `CitizenPwaFooter` (preview: [`docs/design-previews/citizen-pwa-shell-preview.html`](./design-previews/citizen-pwa-shell-preview.html)). Buttons use `@enagar/ui` **font-medium** labels with optional **16px icon + label**. Auth/hub use **warm white canvas** + white cards; **burnt orange** primary and **forest/sage** secondary accents. Grievance list/detail surfaces use semantic chips:

| Field    | Values (examples)              | Chip tone                       |
| -------- | ------------------------------ | ------------------------------- |
| Status   | submitted, in progress, closed | sky / indigo / emerald          |
| Status   | reopened, escalated            | orange                          |
| Priority | low → urgent                   | emerald → amber → orange → rose |

Tenant colour appears as a left stripe on grievance cards; status/priority chips are platform-semantic, not tenant-derived.

### 2.3 Spacing

8-pt grid. Tailwind defaults work; we use only the multiples-of-4 we actually need:

```
0  ·  4 px (1)  ·  8 px (2)  ·  12 px (3)  ·  16 px (4)  ·  24 px (6)
       ·  32 px (8)  ·  48 px (12)  ·  64 px (16)
```

### 2.4 Radius

```
rounded-sm  =  4 px   (tag, badge)
rounded     =  8 px   (button, input)
rounded-lg  =  12 px  (chip, alert)
rounded-2xl = 16 px   (card)              ← citizen surfaces use this by default
rounded-3xl = 24 px   (sheet, modal)
rounded-full= 9999 px (avatar, pill)
```

### 2.5 Elevation (box shadows)

```
shadow-none
shadow-sm   →  0 1 2 rgba(15,23,42,.06)            (subtle hover)
shadow      →  0 1 3 rgba(15,23,42,.10) + 0 1 2 rgba(15,23,42,.06)  (card)
shadow-lg   →  0 10 15 rgba(15,23,42,.10)          (modal, sticky bar)
shadow-2xl  →  0 25 50 rgba(15,23,42,.25)          (chatbot pop-out)
```

### 2.6 Motion

- **Duration.** `100 ms` micro (hover/press), `200 ms` small (drawer, toast), `300 ms` page transition.
- **Easing.** `cubic-bezier(0.16, 1, 0.3, 1)` ("ease-out-quart") for entries; linear for spinners.
- **Reduced motion.** Respect `prefers-reduced-motion`. Crossfade replaces slide. No bounce on form errors.

### 2.7 Iconography

**Lucide** is the only icon set in v1. Pinned at `lucide-react` (web) and `lucide-react-native` (mobile), version-locked to ensure perfectly consistent visuals across platforms. ~120 icons in active use, drawn from the prototype audit. Phase 2 publishes an `icons.ts` mapping file under `@enagar/ui` so calling code uses semantic names (`<Icon name="grievance" />`) instead of Lucide-specific imports.

> **No emoji in production UI.** The prototype uses emoji for tenant logos and category icons; v1 replaces them with line-art illustrations + Lucide icons.

---

## 3. Multi-tenant theming model

```
┌─────────────────────────────────────────────────────────┐
│ Browser at https://kmc.enagar.gov.in                     │
│                                                          │
│  1. Edge resolver maps subdomain → tenant_id ────────┐  │
│  2. /api/tenant/me returns:                          │  │
│     { theme_color, logo_url, languages, …  }         │  │
│  3. @enagar/tenant-theme.applyTenantTheme(tenant)    ▼  │
│     ↓                                                    │
│     document.documentElement.style.setProperty(          │
│       '--brand-rgb',     '15 76 117'                     │
│     );                                                   │
│     document.documentElement.style.setProperty(          │
│       '--brand-fg-rgb',  '255 255 255'                   │
│     );                                                   │
│     <body class="font-bn">  // when locale is bn         │
│  4. Logo swapped to <img src="/static/logos/kmc.svg">    │
│  5. Splash uses brand colour; splash text in tenant      │
│     default language unless citizen has saved a pref     │
└─────────────────────────────────────────────────────────┘
```

- **Zero rebuilds** to add a tenant: create the tenant row, drop a logo SVG into MinIO, point a subdomain.
- **Photo + photo background.** Tenants may upload a _splash background_ (1080×1920) for the mobile app's first-launch screen. Optional; sensible default if absent.
- **Font priority list.** A tenant whose primary language is Bengali ships `Noto Sans Bengali` first in the `font-family` chain so first contentful paint uses the right script.
- **Mascot / illustration set.** Each tenant can ship two custom illustrations (empty-state, error-state). Provided as SVG, dimensioned 320×240 max.

---

## 4. Component inventory

> **Inventory only.** API design lives in `@enagar/ui`'s component-by-component PRs in Phase 2.

### 4.1 Atoms (`@enagar/ui/atoms`)

| Component            | Web | RN  | Notes                                                                                                                                |
| -------------------- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`             | ✅  | ✅  | Variants: `primary` (brand), `secondary` (slate), `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. Loading state. Icon-left / icon-right. |
| `Input`              | ✅  | ✅  | Text, email, tel (10-digit Indian), number. Built-in label + helper-text + error slot.                                               |
| `OTPInput`           | ✅  | ✅  | 6 grouped boxes, auto-advance, paste-ful.                                                                                            |
| `Select`             | ✅  | ✅  | Native on RN (action-sheet); custom Radix on web.                                                                                    |
| `Textarea`           | ✅  | ✅  | Auto-grow with character count (no hard limit by default).                                                                           |
| `Checkbox` / `Radio` | ✅  | ✅  |                                                                                                                                      |
| `Switch`             | ✅  | ✅  | For settings toggles.                                                                                                                |
| `FilePicker`         | ✅  | ✅  | Drag-and-drop on web; camera + gallery on RN. Live thumbnail.                                                                        |
| `DatePicker`         | ✅  | ✅  | Indian dd/mm/yyyy default. Range mode for filters.                                                                                   |
| `Badge`              | ✅  | ✅  | Status pills: `pending`, `paid`, `approved`, `rejected`, `closed`.                                                                   |
| `Tag`                | ✅  | ✅  | Service category.                                                                                                                    |
| `Icon`               | ✅  | ✅  | Wrapper around Lucide so we can swap libraries later.                                                                                |
| `Avatar`             | ✅  | ✅  | User initials → DiceBear → uploaded photo (in that order).                                                                           |
| `Skeleton`           | ✅  | ✅  | Loading placeholder; matches the eventual shape.                                                                                     |

### 4.2 Molecules (`@enagar/ui/molecules`)

| Component                          | Notes                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------- | ----- | ------------------------------------------ |
| `FormField`                        | `Label` + `Input` + `HelperText` + `Error` rolled up. RJSF-compatible. |
| `Field` (RJSF)                     | Per-control widget consumed by `@enagar/forms`.                        |
| `Card`                             | Service card, application card, grievance card. Always `rounded-2xl`.  |
| `Stat`                             | `label + value + trend` (used on operator dashboards).                 |
| `EmptyState`                       | Illustration + message + CTA. Tenant-customisable illustration.        |
| `Alert`                            | `info`/`success`/`warning`/`danger` with optional action.              |
| `Toast`                            | Auto-dismiss 4 s; tap to dismiss; queues.                              |
| `Sheet` (web) / `BottomSheet` (RN) | For multi-action menus and filters.                                    |
| `Modal`                            | Confirmation, edit-in-place, payment-step. Esc closes; trap focus.     |
| `Drawer`                           | Operator-side multi-step.                                              |
| `Stepper`                          | Progress through application flow (1 of 4 → 4 of 4).                   |
| `Tabs`                             | Application / Grievance detail screens.                                |
| `LanguagePicker`                   | `EN                                                                    | বাংলা | हिंदी` segmented control. Shows in header. |

### 4.3 Organisms (`@enagar/ui/organisms`)

| Component             | Notes                                                                          |
| --------------------- | ------------------------------------------------------------------------------ |
| `AppHeader`           | Brand logo, title, language picker, notifications icon, profile menu.          |
| `AppFooter`           | (Citizen) Helpline + DPDP-link + privacy.                                      |
| `BottomNav`           | (RN + small-screen PWA) Home · Services · Grievance · Sahayak · Profile.       |
| `ServiceCard`         | Icon, name, "popular" tag, fee preview, SLA, CTA.                              |
| `ApplicationCard`     | Icon, service name, status badge, pending-at, last-action date.                |
| `GrievanceCard`       | Category icon, docket no., status, SLA-remaining countdown.                    |
| `Timeline`            | Vertical step list with status icons; used on application + grievance details. |
| `PaymentSummary`      | Itemised fees + late fee + total + payment-method picker.                      |
| `ChatBubble` / `Chat` | Citizen / Sahayak alternating bubbles, tool-call surfacing, typing indicator.  |
| `KbCitation`          | Sahayak's "source: <link>" pill below an answer.                               |
| `OfficerQueue`        | (Operator) Filterable, sortable list with bulk actions.                        |

### 4.4 Templates (`@enagar/ui/templates`)

| Template                   | Composes                                        |
| -------------------------- | ----------------------------------------------- |
| `OnboardingTemplate`       | Splash → Language → Login → OTP → Tenant select |
| `CitizenAppTemplate`       | `AppHeader` + main + `BottomNav`                |
| `ServiceCatalogueTemplate` | Search + category strip + grid                  |
| `ApplicationFlowTemplate`  | `Stepper` + per-step content + sticky CTA       |
| `OperatorTemplate`         | Sidebar + content + secondary panel             |

---

## 5. Wireframes — six critical citizen flows

> **Notation.** ASCII rectangles approximate **a 360 × small-screen-height** slice. Borders denote screen edges, not card chrome.

### 5.1 Authenticate (Login → OTP → DigiLocker link)

```
┌───────── Login ─────────────────────┐
│ ‹ back              [EN] [বাং] [हिंदी]│
│                                      │
│  [Logo / mascot]                     │
│  Welcome to eNagarSeba                │
│  Enter your mobile number to begin    │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │ 📱 +91   ┃  9 8 3 0 0 1 2 3 4 5 │ │
│  └─────────────────────────────────┘ │
│                                      │
│   [    Get OTP    ]  ← brand-filled  │
│                                      │
│  ─────  or  ─────                    │
│   [  Login with DigiLocker  ]        │
│                                      │
│  By continuing you agree to the      │
│  Privacy Policy & Terms.             │
└──────────────────────────────────────┘

           ↓  (server sends OTP)

┌───────── Enter OTP ──────────────────┐
│ ‹ back                                │
│                                      │
│  We sent a 6-digit OTP to             │
│  +91 *****  3 4 5                    │
│                                      │
│  [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] [ _ ] │
│                                      │
│   00:54 left  ·  Resend (greyed)     │
│                                      │
│   [    Verify    ]                   │
│                                      │
│  Used a wrong number? Change          │
└──────────────────────────────────────┘

           ↓  (success)

┌──── Welcome, Bappa! ─────────────────┐
│  Choose your municipality              │
│                                      │
│  ┌──────────────┐  ┌──────────────┐  │
│  │   🏛 KMC     │  │   🌉 HMC     │  │
│  │   Kolkata    │  │   Howrah     │  │
│  │   144 wards  │  │   66 wards   │  │
│  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  │
│  │   🏯 CMC     │  │   🌆 BMC     │  │
│  └──────────────┘  └──────────────┘  │
│  …                                    │
└──────────────────────────────────────┘
```

**Failure / edge cases visualised:**

- Wrong OTP after 4 tries → inline `Alert(danger)` _"Too many incorrect attempts. Try again in 15 minutes."_; **Get OTP** disabled.
- SIM-swap heuristic flagged → inline step-up modal "We've noticed unusual activity. Confirm by uploading a selfie + Aadhaar via DigiLocker."

---

### 5.2 Service catalogue browse

```
┌── Home (after auth, KMC) ─────────────┐
│ ☰  KMC                  🔔 (3)  👤    │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │ 🔍  Search a service...         │ │
│  └─────────────────────────────────┘ │
│                                      │
│  POPULAR                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │📜BC  │ │💧PT  │ │📋TL  │ │🎫CH  │ │
│  │Birth │ │Prop  │ │Trade │ │Hall  │ │
│  │Cert  │ │Tax   │ │Lic   │ │Book  │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ │
│                                      │
│  CATEGORIES                          │
│  ▸ Certificates           4 services │
│  ▸ Tax & Property         5 services │
│  ▸ Water & Sanitation     7 services │
│  ▸ Building & Plan        4 services │
│  ▸ Health Services        5 services │
│  ▸ … (14 in total)                   │
│                                      │
│  ANNOUNCEMENTS                       │
│  • Property tax rebate till 31 May   │
│  • Dengue fogging — Borough VIII     │
│                                      │
│ [Home][Services][Grievance][Sahayak][👤]│
└──────────────────────────────────────┘
```

**Search behaviour:** typo-tolerant (Meilisearch). Category chips above results filter live. Empty state suggests "_not finding it? File an RTI_" with a deep link.

---

### 5.3 Apply for a service (multi-step form)

Stepper variant, taking Birth Certificate as the canonical example:

```
┌── 1 of 4: Eligibility check ─────────┐
│ ‹ Birth Certificate                   │
│                                      │
│  •  Free if filed within 21 days      │
│  •  ₹50 fee (21 days–1 year)          │
│  •  After 1 year → magistrate order   │
│                                      │
│  Date of birth:                       │
│  [   12 / 04 / 2026   ]               │
│                                      │
│  ✅ You are eligible to file for free.│
│                                      │
│  [   Continue   ]                    │
└──────────────────────────────────────┘

┌── 2 of 4: Child & parent details ────┐
│  Child's name *  ┃                ┃   │
│  Date of birth * ┃ 12/04/2026     ┃   │
│  Gender *  ◯ Male  ◯ Female  ◯ Other │
│  Place of birth *┃                ┃   │
│  Father's name * ┃                ┃   │
│  Mother's name * ┃                ┃   │
│  Address *       ┃                ┃   │
│                  ┃                ┃   │
│  Ward number *   ┃                ┃   │
│  Hospital discharge slip *  📎 upload │
│                                      │
│  [ Save draft ]    [    Continue   ] │
└──────────────────────────────────────┘

┌── 3 of 4: Review ────────────────────┐
│  Verify your details:                 │
│   Child       Aritra Sengupta        │
│   DOB         12 Apr 2026            │
│   Place       Kolkata Municipal Hosp.│
│   Father      Bappa Sengupta         │
│   Mother      Anwesha Sengupta       │
│   Address     22 Park Street, KMC    │
│                                      │
│   Documents   ✅ Hospital discharge  │
│                                      │
│  Edit any section ↑                  │
│  [    Continue to payment   ]        │
└──────────────────────────────────────┘

┌── 4 of 4: Payment / Submit ──────────┐
│  Application fee   FREE              │
│  (within 21 days)                    │
│                                      │
│  [   Submit application   ]          │
│                                      │
│  After submit, you can track in      │
│  My Applications.                    │
└──────────────────────────────────────┘

           ↓  (success)

┌─── Submitted ✅ ─────────────────────┐
│  Application no.                      │
│  WBM/KMC/birth-cert/2026/00342        │
│                                      │
│  Estimated processing: 7 days         │
│  Pending at: Ward inspector — Ward 64 │
│                                      │
│  [ Track application ] [ Done ]      │
└──────────────────────────────────────┘
```

> **Note.** When `fees ≠ free`, step 4 surfaces the `PaymentSummary` organism with payment-method picker (UPI / Net Banking / Card / Wallet). Tax services skip steps 1-3 entirely (see 5.4).

---

### 5.4 Pay tax (lookup → calculate → pay → receipt)

Property-tax flow:

```
┌── Property Tax ──────────────────────┐
│ ‹ back                                │
│                                      │
│  Enter holding number                 │
│  ┌─────────────────────────────────┐ │
│  │ 64 / PARK-ST / 12B               │ │
│  └─────────────────────────────────┘ │
│  Don't have it?  Look up by address  │
│                                      │
│  [    Fetch dues    ]                │
└──────────────────────────────────────┘

┌── Dues for 64/PARK-ST/12B ───────────┐
│  Owner       Bappa Sengupta           │
│  Built-up    1 200 sq.ft.            │
│  Ward        64 — Borough VIII       │
│                                      │
│  ─────  Dues breakdown  ──────       │
│  Annual property tax     ₹ 4 200     │
│  + late fee (3 mo, 2%/mo) ₹    252   │
│  ──────────────────────────────────  │
│  Total payable           ₹ 4 452     │
│                                      │
│  Method:                              │
│  ◉ UPI    ◯ Net banking    ◯ Card    │
│                                      │
│  [    Pay ₹4 452    ]                │
└──────────────────────────────────────┘

           ↓  (gateway)

┌── Payment successful ────────────────┐
│  TXN4429187                           │
│  Paid via UPI                         │
│  12 Apr 2026, 10:23 AM                │
│                                      │
│  [   Download receipt   ]            │
│  [   Email receipt      ]            │
│  [   Done               ]            │
└──────────────────────────────────────┘
```

---

### 5.5 File a grievance

```
┌── File a grievance ──────────────────┐
│ ‹ back                                │
│                                      │
│  Category                              │
│  ▸ 🚮 Sanitation & Waste              │
│  ▸ 💧 Water Supply                    │
│  ▸ 🛣 Roads & Infrastructure          │
│  ▸ 💡 Street Lighting                 │
│  ▸ 🏥 Public Health & Safety          │
│  ▸ 🏛 Property & Taxation             │
│  ▸ 🚧 Encroachment & Illegal          │
│  ▸ 🌳 Environment                     │
│  ▸ 🛎 Service Delivery                │
│  ▸ 🚨 Emergency                       │
└──────────────────────────────────────┘

           ↓ (Sanitation selected)

┌── Sanitation & Waste ────────────────┐
│  Sub-type                              │
│  ◯ Garbage not collected              │
│  ◯ Overflowing dustbin                │
│  ◯ Dead animal removal                │
│  ◯ Drain cleaning                     │
│  ◯ Other                              │
│                                      │
│  Add a photo (geotagged)              │
│  [📷 Take photo]  [📁 Choose file]   │
│                                      │
│  Address (auto-detected from photo) │
│  ┃ 22 Park Street, KMC, Ward 64      │
│  Edit ↑                              │
│                                      │
│  Description (optional)               │
│  ┃ Garbage not lifted for 3 days     │
│                                      │
│  Priority   ◯ Low  ◉ Medium  ◯ High   │
│  ⓘ High raises priority and 24-h SLA │
│                                      │
│  [    Submit grievance    ]          │
└──────────────────────────────────────┘

           ↓ (success)

┌─── Grievance docketed ✅ ────────────┐
│  GRV/KMC/2026/SAN/4421                │
│  SLA 48 hours                         │
│  Pending at: Sanitation Inspector,    │
│              Ward 64                  │
│                                      │
│  [ Track grievance ] [ Done ]         │
└──────────────────────────────────────┘
```

> **Resolution-confirm view (later).** When the grievance is marked resolved, the citizen sees a **Resolution photo** (geotagged) and two CTAs: `Confirm resolved` (closes) or `Dispute` (re-opens, escalates).

---

### 5.6 Sahayak chatbot (RAG + PII-redaction)

```
┌── Sahayak ─────────────────────────── ┐
│ ‹ back                       🌐 EN ▼  │
│                                      │
│  ─ "How do I get a duplicate         │
│     birth certificate?"               │
│                                      │
│  Sahayak (typing…)                    │
│                                      │
│  ┌── Sahayak ──────────────────────┐ │
│  │ You can request a duplicate      │ │
│  │ birth certificate via *Old Birth │ │
│  │ Record Search* under the         │ │
│  │ Information & RTI category.      │ │
│  │                                  │ │
│  │ Fee: ₹100 · SLA: 7 days          │ │
│  │ You'll need: approximate DOB,    │ │
│  │ parents' names, place of birth.  │ │
│  │                                  │ │
│  │ [ Open service ]                 │ │
│  │                                  │ │
│  │ Source: KMC Public Service       │ │
│  │ Charter, p.14 (citation)         │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ┌─────────────────────────────────┐ │
│  │ Type your question...    [Send] │ │
│  └─────────────────────────────────┘ │
│                                      │
│  ⓘ Sahayak doesn't see your mobile    │
│    or Aadhaar — your privacy is safe. │
└──────────────────────────────────────┘
```

**Sahayak-specific UI rules:**

1. Every Sahayak response **must** carry a **citation** (KB chunk title + page). No citation → no render. (Enforced in `apps/api`'s response validator.)
2. The PII-protection notice ("Sahayak doesn't see your mobile…") is permanent — _not_ dismissible. Trust signal.
3. Streamed via SSE — first token within 600 ms or fall back to _"Sahayak is taking longer than usual…"_ placeholder at 2 s.
4. **Refusal patterns** are server-side and hard-coded. The UI shows them as a regular message, never as an error.

---

## 6. Operator (admin) wireframes — sketch only

Detailed wireframes ship in **Phase 6**. For Sprint 0.2 we lock the _information density_ level and the _navigation pattern_.

```
┌────────────────────────────────────────────────────────────────────────┐
│ KMC Admin · Officer dashboard                                  Bappa S │
├──────────┬─────────────────────────────────────────────────────────────┤
│  Home    │  Today                                                       │
│  Apps    │   12 pending applications · 7 SLA-breached                  │
│  Grievs  │   3 grievances awaiting triage                                │
│  Search  │                                                                │
│  Reports │  ┌─ Pending applications ──────────────────────────────────┐ │
│  Catalog │  │ #00342 Birth cert  · pending 4 d · ‹‹ Approve ›› ‹ Return ›│ │
│  Tenant  │  │ #87122 Property tax · pending 1 d · payment received     │ │
│  Settings│  │ …                                                       │ │
│ ────────│  └────────────────────────────────────────────────────────┘ │
│  Help    │                                                                │
└──────────┴─────────────────────────────────────────────────────────────┘
```

**Density principles**: row height 40 px max, monospaced numerals, sticky filters, keyboard navigation (`j` / `k` to row, `a` to approve, `r` to return).

---

## 7. Accessibility checklist (Phase 2 acceptance gate)

- [ ] Every interactive element has a name (`aria-label` or visible text).
- [ ] Keyboard-only flow works for all 6 citizen scenarios above.
- [ ] Focus rings visible against all 8 brand colours.
- [ ] Touch targets ≥ 44 × 44 px on mobile.
- [ ] Form errors announced via `role="alert"`.
- [ ] Colour is **never** the sole carrier of meaning (e.g. status badges include both colour + icon + text).
- [ ] Dark mode toggle survives across page navigations and locale switch.
- [ ] Bengali and Hindi text rendered without missing-glyph boxes on Android < 10 (Noto fonts pre-loaded).
- [ ] Screen-reader audit (VoiceOver iOS + TalkBack Android + NVDA Windows) for every Phase-2 PR that ships a user-facing flow.
- [ ] WCAG 2.1 AA contrast verified by `@axe-core/playwright` in CI.

---

## 8. Implementation checklist for Phase 2

In order:

1. **Sprint 2.0** — Tokens + brand-CSS-var theming + font-family fallback chain wired.
2. **Sprint 2.1** — Atoms (`Button`, `Input`, `OTPInput`, `Badge`, `Icon`, `Card`).
3. **Sprint 2.2** — Form-related molecules (`FormField`, `FilePicker`, `DatePicker`).
4. **Sprint 2.3** — Organisms (`AppHeader`, `BottomNav`, `ServiceCard`, `ApplicationCard`).
5. **Sprint 2.4** — Templates + first end-to-end _Birth Certificate_ flow on the citizen-PWA, in all three languages.
6. **Sprint 2.5** — Storybook publication to `docs/storybook` (gh-pages or internal); a11y / contrast snapshots.

Each sprint ends with: lint + typecheck + unit tests + Storybook + a11y snapshots green in CI.

---

## 9. Open questions (deferred to Phase 2 kickoff)

1. **Dark mode default.** Operator surfaces (admin portals) may default to dark; citizen surfaces stay light. Do we expose a citizen toggle?
2. **Iconography overrides.** Should tenants be allowed to swap _category icons_ (e.g. KMC's water service uses a wave, HMC uses a Hooghly-river silhouette)? Probably no for v1; revisit in Phase 6.
3. **Landscape mobile.** RN app — do we lock to portrait? Probably yes for v1.
4. **Print stylesheet.** Receipts and certificates need print stylesheets distinct from screen styles. Whose budget — design or backend?

---

## Change log

| Date       | Change                                                             | Reviewer                                      |
| ---------- | ------------------------------------------------------------------ | --------------------------------------------- |
| 2026-05-06 | v0.1 — tokens, theming model, component inventory, six wireframes. | _pending design + product + sponsor sign-off_ |
