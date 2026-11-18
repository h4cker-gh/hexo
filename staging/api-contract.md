# HexoBot Dashboard — Shared Contract v1

This file is the single source of truth for the backend/frontend split. Both
agents must implement exactly this contract. If something is ambiguous, prefer
the simplest behavior described here and note it in the final report.

## Stack decisions (fixed)

- Backend HTTP: **Fastify 5** + `@fastify/cors` + `@fastify/static`.
- Frontend: **Vite 7 + React 19 + TypeScript** in `web/`.
- Real-time: **SSE** (`text/event-stream`). No WebSocket dependency.
- Default server: `127.0.0.1:3000`.
- Frontend dev server: `http://localhost:5173`, proxies `/api` to the backend.
- Production: backend serves `web/dist` at `/`.

## Shared domain types

These mirror `src/core/context/types.ts` and the API DTOs.

```ts
export type PlatformId = 'whatsapp';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr'
  | 'pairing'
  | 'connected'
  | 'error';

export type ConnectMethod = 'qr' | 'pairing-code';

/** A mention resolved from an incoming message. */
export interface ContextMention {
  /** Platform user identifier (WhatsApp JID). */
  jid: string;
  /** Display name used in the normalized text, e.g. "clara". */
  name: string;
  /** Digits only, when known. Used to rebuild @tokens when sending. */
  phoneNumber?: string;
}

export interface ConnectionSnapshot {
  status: ConnectionStatus;
  /** Raw QR payload when status === 'qr'. */
  qr?: string;
  /** Pairing code when status === 'pairing'. */
  pairingCode?: string;
  error?: string;
  /** Bot's own JID once connected. */
  botJid?: string;
  /** ISO timestamp of the last change. */
  updatedAt: string;
}

export interface PlatformStats {
  platform: PlatformId;
  connected: boolean;
  messagesReceived: number;
  messagesSent: number;
  commandsExecuted: number;
  errors: number;
  /** ISO timestamp when the current connection opened. */
  startedAt: string | null;
  /** ISO timestamp of the last inbound/outbound message or command. */
  lastActivityAt: string | null;
}

export interface PlatformSummary {
  id: PlatformId;
  name: string;
  enabled: boolean;
  status: ConnectionStatus;
  qr?: string;
  pairingCode?: string;
  error?: string;
  botJid?: string;
  stats: PlatformStats;
}

export type LogLevelName = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntryDto {
  id: string;
  timestamp: string;
  level: LogLevelName;
  logger: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface MessageRecord {
  id: string;
  timestamp: string;
  platform: PlatformId;
  direction: 'in' | 'out';
  /** Chat/channel id (WhatsApp remoteJid / group JID). */
  chatId: string;
  /** Sender id. Not the chat id. */
  senderId: string;
  senderName?: string;
  text: string;
  success: boolean;
}

export interface SendMessageRequest {
  /** JID or phone number (digits). Groups must use a full @g.us JID. */
  to: string;
  content: string;
  mentions?: ContextMention[];
}

export interface SendMessageResponse {
  id: string;
  success: boolean;
  error?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
```

## REST API

Base URL: `/api`. All bodies are JSON. Errors use `ApiErrorBody` with an
appropriate HTTP status (400 validation, 404 unknown platform, 409 invalid
connection state, 500 unexpected).

### `GET /api/health`

```json
{ "ok": true, "uptimeMs": 12345, "version": "0.1.0" }
```

### `GET /api/platforms`

Returns `PlatformSummary[]` (currently one entry: WhatsApp).

### `GET /api/platforms/:platform`

Returns a single `PlatformSummary`. `404` if unknown.

### `GET /api/logs?level=&limit=100`

Returns `LogEntryDto[]`, newest first. `level` is optional and filters to that
level **and above** (debug < info < warn < error < fatal). `limit` defaults to
100, max 500.

### `GET /api/messages?platform=&limit=50`

Returns `MessageRecord[]`, newest first. `limit` defaults to 50, max 200.

### `POST /api/platforms/whatsapp/connect`

Body:

```json
{ "method": "qr" }
```

or

```json
{ "method": "pairing-code", "phoneNumber": "5511999999999" }
```

Behavior:

- `qr`: starts the socket and returns `{ "status": "connecting" }`. The QR
  payload is delivered through SSE and is also present in
  `GET /api/platforms/whatsapp` as `qr` while `status === "qr"`.
- `pairing-code`: starts the socket and requests a pairing code. Returns
  `{ "status": "connecting" }`. The code is delivered through SSE
  (`connection` event, `pairingCode`) and is also present in
  `GET /api/platforms/whatsapp` once available.
- If already connected, return `{ "status": "connected" }`.
- `phoneNumber` must be digits only (E.164 without `+`). Validate and reject
  otherwise with 400.

### `POST /api/platforms/whatsapp/disconnect`

Body (optional):

```json
{ "logout": false }
```

- `logout: false` (default): close the socket and keep credentials. The adapter
  may auto-reconnect later; the dashboard shows `disconnected`.
- `logout: true`: log out of WhatsApp and delete the stored session.

Returns `{ "ok": true }`.

### `POST /api/platforms/:platform/send`

Body: `SendMessageRequest`. Returns `SendMessageResponse`.

- `to` may be a full JID (`...@s.whatsapp.net`, `...@g.us`) or digits. Digits
  are normalized to `<digits>@s.whatsapp.net`.
- `mentions` is the already-resolved mention list. The adapter rebuilds the
  platform mention tokens (see “Mention contract”).
- A successful send increments `messagesSent` and emits a `message` SSE event
  with `direction: "out"`.

## SSE — `GET /api/events`

Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
`Connection: keep-alive`. Heartbeat every 15 s.

On connect, the server immediately emits:

```
event: snapshot
data: PlatformSummary[]
```

Then:

| event        | data                                                            |
| ------------ | --------------------------------------------------------------- |
| `snapshot`   | `PlatformSummary[]` (full replacement)                          |
| `connection` | `{ platform, ...ConnectionSnapshot }`                           |
| `stats`      | `PlatformStats`                                                 |
| `log`        | `LogEntryDto`                                                   |
| `message`    | `MessageRecord`                                                 |
| `ping`       | `{ "t": 1700000000000 }`                                        |

The frontend must tolerate missed events: on reconnect it re-fetches
`/api/platforms`, `/api/messages`, and `/api/logs`, and also re-fetches
`/api/platforms/whatsapp` whenever it sees a `connection` event.

## WhatsApp identity contract (backend)

These rules fix the current conflation of `remoteJid` with the sender.

- `message.key.remoteJid` is the **chat id**:
  - group: `<group>@g.us`
  - DM: the counterpart JID (may be a LID in LID-addressed chats)
- `context.channel.id` = `remoteJid` (chat id).
- `context.channel.type` = `"group"` or `"dm"`.
- `context.channel.name` = group subject when known.
- `context.user.id` = **sender JID**, resolved with this precedence:
  - group: `key.participantPn` → `key.participant` → `key.participantLid` →
    `key.senderPn` → `key.senderLid`
  - DM: `key.senderPn` → `key.senderLid` → `remoteJid`
  - own message (`fromMe` true, or resolved sender === bot JID):
    `key.participant` → `key.senderLid` → `key.senderPn` → bot JID
- `context.user.senderPN` = digits-only phone number when the sender is a PN
  (primarily DM; also set it when known in groups).
- `context.channel.participantPN` = the sender's digits-only phone number in a
  group.
- `context.user.displayName` = `message.pushName` → group participant name →
  `undefined`.
- Own messages are **ignored** (`fromMe` or sender === bot JID): log at debug
  and return. Never dispatch them to commands.
- Strip device suffixes (`123:4@s.whatsapp.net` → `123@s.whatsapp.net`) when
  deriving numeric tokens.

### Mention normalization (incoming)

Inputs: raw text, `contextInfo.mentionedJid` (when present), and group metadata
(fetched on demand for groups).

- Build a participant index from `GroupMetadata.participants`:
  - `lid` = digits of `participant.lid` (or `participant.id` when it ends in
    `@lid`)
  - `pn` = digits of `participant.jid` (or `participant.id` when it ends in
    `@s.whatsapp.net`)
  - canonical `jid` = `participant.jid ?? participant.id`
  - `name` = `participant.name ?? participant.notify ?? participant.verifiedName`
    → fall back to `pn` digits.
- Collect mention tokens from both `mentionedJid` and `@(\d+)` occurrences in
  the text (union, deduplicated).
- Resolve each token by `lid` first, then `pn`, then `id`. Replace the matched
  `@<token>` in the text with `@<name>`.
- Emit `ContextMention[]` with `{ jid: canonicalJid, name, phoneNumber: pn }`.
- Unresolved tokens are left untouched and are not added to mentions.
- DM: no group metadata; map `mentionedJid` entries directly to
  `{ jid, name: digits }` and only rewrite tokens that are present in
  `mentionedJid`.

### Mention reconstruction (outgoing)

For `sendText` / `reply`, given `content` and `ContextMention[]`:

- For every mention whose `name` appears in the text as `@<name>`, replace it
  with `@<phoneNumber ?? digits(jid)>`.
- Send `mentionedJid: mentions.map(m => m.jid)`.
- If no mention name matches, send the text unchanged but still forward
  `mentionedJid`.

## File ownership (avoid overlap)

Backend agent owns:

- `src/core/context/types.ts`, `src/core/context/builder.ts`,
  `src/core/context/index.ts`
- `src/core/adapter/types.ts`, `src/core/adapter/index.ts`
- `src/core/config/schema.ts`
- `src/infra/whatsapp/**`
- `src/app/logger.ts`, `src/app/container.ts`, `src/app/config.ts`,
  `src/app/index.ts`, `src/app/main.ts` (new)
- `src/app/monitor/**` (new), `src/app/api/**` (new)
- `src/tests/**` (new tests only; do not weaken existing tests)
- root `package.json`, `package-lock.json`, `tsup.config.ts`,
  `hexobot.config.yml`, `README.md`, `ARCHITECTURE.md`, `TODO.md`

Frontend agent owns:

- `web/**` (new): `package.json`, `vite.config.ts`, `tsconfig.json`,
  `index.html`, `src/**`, `README.md`

Do **not** edit files outside your ownership list. The backend agent is the only
one allowed to touch root `package.json`; the frontend agent owns
`web/package.json`.

## Hard constraints

- TypeScript strict, `noUncheckedIndexedAccess`, `noUnusedLocals`,
  `noUnusedParameters`.
- **No `any`** anywhere in `src/` (architectural test enforces this).
- Relative imports in `src/` use `.js` extensions; prefer aliases
  (`@core/…`, `@shared/…`, `@infra/…`, `@app/…`).
- Do not break the existing 50 tests. Run `npx tsc --noEmit` and `npm test`.
- Keep files focused and under ~300 lines where practical.
- Validate the incoming `phoneNumber` for pairing code: digits only.
- The backend must degrade gracefully when `web/dist` is absent (dev mode).
