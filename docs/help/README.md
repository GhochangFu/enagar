# Operator help (HTML)

Plain-English **operator manuals** (how-to guides) for staff who use the computer daily but are not IT developers.
Indexed, searchable, with illustrated screens (SVG diagrams; replace with photos if needed).

Link from **`OperatorAppFooter` → Operator help** in Tenant Admin and State Admin.

| Portal             | File                                                                 | Primary audience           |
| ------------------ | -------------------------------------------------------------------- | -------------------------- |
| Tenant Admin (ULB) | [operator-help-admin-tenant.html](./operator-help-admin-tenant.html) | `tenant_admin`, desk staff |
| State Admin        | [operator-help-admin-state.html](./operator-help-admin-state.html)   | State platform operators   |

## Features

- **Indexed** — sidebar table of contents with in-page anchors
- **Searchable** — filters sections client-side (`?q=workflow` supported)
- **Glossary** — linked terms at the end of each guide
- **Samples** — copy-paste JSON for forms, workflows, and onboarding payloads

Shared assets: [assets/operator-help.css](./assets/operator-help.css), [assets/operator-help.js](./assets/operator-help.js).

**Smart city (Sprint 8.2):** Tenant Admin operator help includes **Smart city services** — parking zones, EV tariffs, and water meter seeding under Operations.

## Wiring into apps (done)

| App            | Public path                                   | Footer prop                                                |
| -------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `admin-tenant` | `public/help/operator-help-admin-tenant.html` | `operatorHelpHref="/help/operator-help-admin-tenant.html"` |
| `admin-state`  | `public/help/operator-help-admin-state.html`  | `operatorHelpHref="/help/operator-help-admin-state.html"`  |

Source of truth for content edits: `docs/help/` — re-copy after updates:

```powershell
$src = "docs\help"
Copy-Item "$src\operator-help-admin-tenant.html" "apps\admin-tenant\public\help\" -Force
Copy-Item "$src\operator-help-admin-state.html" "apps\admin-state\public\help\" -Force
Copy-Item "$src\assets\*" "apps\admin-tenant\public\help\assets\" -Recurse -Force
Copy-Item "$src\assets\*" "apps\admin-state\public\help\assets\" -Recurse -Force
```

**Screenshots** are PNG captures from local dev (`localhost:3002` / `3003`) in `assets/screenshots/`. Re-capture after major UI changes:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/capture-operator-help-screenshots.ps1
```

Requires Keycloak dummy users (`bmc-tenant-admin-dummy`, `bmc-state-admin-dummy`, password `DummyDev_2026!ChangeMe`) and running API + portals.

`OperatorAppFooter` opens the guide in a new tab (`target="_blank"`).

## Screenshots

Figures use **wireframe placeholders**. Replace with production screenshots by swapping `<figure class="screenshot">` inner content or adding `img` tags under `docs/help/assets/screenshots/`.

## Related docs

- [workflow-designations.md](../workflow-designations.md) — designation workflows (tenant)
- [State-ui-plan1.md](../../State-ui-plan1.md) — State Admin UI map
- [sahayak-kb-service-help.md](./sahayak-kb-service-help.md) — citizen Sahayak KB (separate from operator help)
