# @enagar/tenant-theme

Runtime per-tenant theming. Sets `--brand-rgb`, `--brand-fg-rgb`, swaps logo, and reorders font preferences (so a Bengali-default ULB renders Noto Sans Bengali first) — all without a rebuild. The Tailwind preset in `@enagar/config/tailwind/base` already maps `bg-brand` / `text-brand` to these vars.

## Status

Sprint 1.4 implementation is wired to the citizen PWA and accepts the `Tenant` shape from `@enagar/types`.
