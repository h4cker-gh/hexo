# HexoBot Web Dashboard

React + Vite frontend for the HexoBot WhatsApp bot. It implements the shared
API contract in [`../staging/api-contract.md`](../staging/api-contract.md) and
is served by the backend at `/` in production.

## Requirements

- Node.js ≥ 20.19 (Vite 7)
- The HexoBot backend on `http://127.0.0.1:3000` for live data

## Setup

```bash
cd web
npm install
```

## Development

```bash
npm run dev
```

Opens `http://localhost:5173`. Vite proxies `/api` (including the SSE stream) to
`http://127.0.0.1:3000`, so no CORS configuration is needed in dev.

## Build & preview

```bash
npm run build     # typecheck + production build into web/dist
npm run preview   # serve the production build on http://localhost:4173
npm run typecheck # TypeScript only, no emit
```

The backend serves `web/dist` at `/` in production, so the default build can be
copied/served as-is. If you preview without the backend, API calls will fail
and the dashboard shows its retry/error states.

## API base override

Requests are same-origin by default (Vite proxy in dev, backend in production).
To point the frontend at another API origin, create `web/.env.local`:

```bash
VITE_API_BASE=http://127.0.0.1:3000
```

The value must not include a trailing slash. SSE uses the same origin at
`/api/events`. When using an absolute origin, the backend's CORS settings must
allow the dev origin.

## Features

- **Dashboard** — WhatsApp status badge, counters, connected-since/uptime, last
  activity, a 30-minute messages-per-minute chart built from message events,
  recent messages (direction/chat/sender/text), and a live SSE log panel with
  level filter, pause/resume buffering, local clear, and auto-scroll.
- **Send message** — recipient (JID or phone digits), plain-text body, optional
  mentions, result toasts, and a local send history. Sending is disabled unless
  WhatsApp reports `connected`. Mentions without `@` are treated as phone
  numbers; full JIDs are forwarded with `name = jid` per the brief.
- **Connection** — QR linking (`qrcode.react`) and pairing-code linking. Shows
  the bot JID, uptime, disconnect, and a confirmation dialog for logout. The
  platform snapshot is re-fetched on every SSE `connection` event, and the whole
  REST snapshot is re-fetched after an SSE reconnect.

## Architecture notes

- No router library: tabs are backed by `#/dashboard`, `#/send`, `#/connect`
  and support keyboard arrow/Home/End navigation.
- `src/api/types.ts` mirrors the contract types exactly; no `any` in `src/`.
- `src/hooks/useDashboard.ts` owns REST + SSE state and merges events by id.
  `src/hooks/useEventStream.ts` owns the `EventSource`, capped exponential
  backoff (1 s → 30 s, plus jitter), and reconnect callbacks.
- Design tokens live at the top of `src/styles.css`. Themes: `dark` (default),
  `light`, and `h4cker`; the choice persists in `localStorage`.
- Limits (fetch sizes, retained lists, chart window) and navigation/branding are
  centralized in `src/config.ts`.

## Known contract assumptions

- On the `connection` event, `qr` is only kept while `status === 'qr'` and
  `pairingCode` only while `status === 'pairing'`; other optional fields are
  cleared on state transitions. `botJid` is retained until a new snapshot says
  otherwise.
- Log level filtering is done client-side using the contract's severity order
  (`debug < info < warn < error < fatal`); `/api/logs?level=` is supported by the
  client but the dashboard keeps the 100-entry live buffer and filters locally.
- Command support is not implemented in the backend yet, so the Send view states
  that messages are delivered as plain text.
