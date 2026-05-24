# Portal hub (static)

Static landing page for **Unified Portal Option A** — served at `enagar.demosites.co.in` via Caddy `file_server`.

**Layout:** Desktop (768px+) fits one viewport when possible. **Mobile scrolls naturally** so all three portal cards remain reachable on small screens.

## Contents

| File               | Purpose                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `index.html`       | Hub layout — marquee hero, guide cards, three portal tiles                                |
| `tokens.css`       | Hallmark OKLCH design tokens (Tricolor Calm extended)                                     |
| `styles.css`       | Layout + components (imports `tokens.css`)                                                |
| `config.js`        | Link targets: **localhost** when served locally, **demosites.co.in** subdomains otherwise |
| `maintenance.json` | Optional banner (`enabled: true` + message)                                               |
| `main.js`          | Applies links + loads maintenance banner                                                  |

## Local preview

From repo root:

```powershell
npx --yes serve infrastructure/portal-hub -p 5500
```

Open `http://localhost:5500` — links point to `localhost:3000`, `:3002/login`, `:3003/login`.

Or from repo root: `pnpm dev:hub`

Ensure `pnpm dev:portals` is running if you want the targets to respond.

**`*.enagar.local` (optional):** open `http://enagar.enagar.local:5500` after editing your hosts file — see [`unified-portal-local-dev-phase6.md`](../../docs/runbooks/unified-portal-local-dev-phase6.md).

## Demo / VM deploy

1. Copy this folder to the VM (e.g. `C:\enagar\portal-hub`) or clone the repo and point Caddy at the path.
2. Caddy config: [`../ingress/Caddyfile.demosites`](../ingress/Caddyfile.demosites) — `enagar.demosites.co.in` → `file_server`.
3. On the demo host, links auto-resolve to:
   - `https://enagarcitizen.demosites.co.in`
   - `https://enagartenant.demosites.co.in/login`
   - `https://enagarstate.demosites.co.in/login`

No build step. No secrets in static assets.

## Maintenance banner

Edit `maintenance.json`:

```json
{
  "enabled": true,
  "title": "Scheduled maintenance",
  "message": "Citizen portal returns at 22:00 IST.",
  "severity": "info"
}
```

Set `severity` to `warning` for a stronger visual treatment. Redeploy or refresh — no app restart required.

## Related docs

- [unified-portal-option-a-plan.md](../../docs/runbooks/unified-portal-option-a-plan.md) — Phase 1
- [unified-portal-option-a-exit.md](../../docs/runbooks/unified-portal-option-a-exit.md) — sign-off checklist
