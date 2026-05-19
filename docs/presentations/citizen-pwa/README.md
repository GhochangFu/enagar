# Citizen PWA — interactive presentation

Reveal.js deck for **Phase UX Sprints 6.15–6.16**, with live screenshots from the dev stack.

## Open the deck

From the repo root:

```bash
npx --yes serve docs/presentations/citizen-pwa -p 8787
```

Then open [http://localhost:8787](http://localhost:8787) (serving over HTTP helps speaker view and fonts).

Or open `index.html` directly in Chrome/Edge.

## Controls

| Key   | Action                    |
| ----- | ------------------------- |
| → / ← | Next / previous slide     |
| F     | Fullscreen                |
| Esc   | Slide overview            |
| S     | Speaker view (needs HTTP) |

## Refresh screenshots

Prereqs: `pnpm --filter @enagar/citizen-pwa dev` on **http://localhost:3000**, API on **:3001**, `DEV_AUTH_ENABLED`, OTP **`12345`**.

```powershell
.\docs\presentations\citizen-pwa\scripts\capture-screenshots.ps1
```

Uses [agent-browser](https://www.npmjs.com/package/agent-browser). On Windows, use **localhost** (not `127.0.0.1`) so OTP calls reach the API.

## Skill used

Deck structure follows the **revealjs-presenter** agent skill (`npx skills add https://github.com/jwynia/agent-skills --skill revealjs-presenter`).
