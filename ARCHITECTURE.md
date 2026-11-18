# Architecture

## Core Contracts

### Commands

Commands are defined with structured metadata and return structured results. They never format messages directly — that's the adapter's job.

```typescript
// Definition
interface CommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  minArgs: number;
  maxArgs: number;
  accessLevel: AccessLevel;
  enabled: boolean;
  config?: Record<string, unknown>;
  handler: (context: UniversalContext, args: string[]) => Promise<CommandResult>;
}

// Result types — adapters decide how to render
type CommandResult =
  | { type: 'text'; content: string }
  | { type: 'rich'; content: Record<string, unknown> }
  | { type: 'error'; message: string; code: string }
  | { type: 'redirect'; target: string };
```

### Universal Context

Represents a normalized interaction. Platform-specific data goes into `raw` and typed fields (`user.id`, `channel.id`) are extracted by the adapter.

```typescript
interface UniversalContext {
  id: string;
  timestamp: Date;
  user: { id: string; displayName?: string; senderPN?: string; metadata: Record<string, unknown> };
  channel: { id: string; name?: string; type: string; participantPN?: string; metadata: Record<string, unknown> };
  input: string;
  parsedArgs: string[];
  platform: string;
  raw?: unknown;
  variables: Map<string, unknown>;
  mentions: ContextMention[];
}
```

### WhatsApp Identity

`remoteJid` identifies the chat, never the sender.

- `channel.id` = `remoteJid`; `channel.type` = `group` or `dm`; `channel.name` = group subject.
- `user.id` = resolved sender JID:
  - group: participantPn → participant → participantLid → senderPn → senderLid
  - DM: senderPn → senderLid → remoteJid
  - own: participant → senderLid → senderPn → bot JID
- `user.senderPN` and `channel.participantPN` hold digits-only phone numbers.
- Own messages (`fromMe` or sender === bot JID) are logged at debug and never dispatched.
- Device suffixes (`123:4@s.whatsapp.net`) are stripped from numeric tokens.

Group metadata is fetched on demand via `socket.groupMetadata` and cached; fetch failures degrade to DM-style mention resolution.

### Mention Normalization

`@infra/whatsapp/message-normalizer.ts` holds pure functions:

- `buildParticipantIndex(metadata)` indexes participants by LID, PN, and id.
- `normalizeIncomingMentions(...)` resolves tokens from `contextInfo.mentionedJid` and `@digits`, rewriting `@token` to `@name`.
- `attachOutgoingMentions(...)` rebuilds `@phoneNumber` tokens and forwards `mentionedJid`.

### Session and Connection

`SessionManager` wraps Baileys' official `useMultiFileAuthState`, persisting credentials and signal keys. The adapter exposes a `ConnectionSnapshot` (`disconnected`, `connecting`, `qr`, `pairing`, `connected`, `error`) and emits changes through `onConnectionChange`. Init auto-connects only when stored credentials are registered; otherwise the API stays ready for a QR or pairing-code request.


### Logger

Interface-only. Core never knows about console, file, or structured logging. The app layer provides `ConsoleLogger`.

```typescript
interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  fatal(message: string, context?: Record<string, unknown>): void;
}
```

### DI Container

Lightweight, in-memory, no external dependencies. Supports singleton and transient lifetimes.

```typescript
class DIContainer {
  register<T>(key: ServiceKey, factory: () => T, options?: { singleton?: boolean }): void;
  resolve<T>(key: ServiceKey): T;
  has(key: ServiceKey): boolean;
  clear(): void;
}
```

### Lifecycle

Stage-based hooks with priority ordering. Used for initialization, startup, and shutdown sequences.

```typescript
enum LifecycleStage { Initializing, Initialized, Starting, Started, Stopping, Stopped }

interface LifecycleHook {
  stage: LifecycleStage;
  priority: number;
  execute(context: Record<string, unknown>): Promise<void>;
}
```

### Feature Registry

Features can be enabled/disabled with optional dependencies. A feature is only enabled when itself enabled AND all dependencies are enabled.

### Access Control

```typescript
enum AccessLevel { User = 0, Moderator = 10, Admin = 20, Owner = 30 }
```

Higher values grant more privilege. Commands specify their required level; the registry checks it before dispatch.

## Application Layers

### `@app/monitor`

- `LogStore`: 500-entry ring buffer, level-and-above filtering, subscriber fan-out.
- `PlatformStatsTracker`: per-platform counters plus 200-message history.
- `Monitor`: facade for registration, connection snapshots, inbound/outbound/command/error recording, and newest-first queries.

The container registers the log store before the logger so `ConsoleLogger` can emit structured entries without coupling the logger core to the dashboard.

### `@app/api`

- `createApiServer(deps)` builds Fastify without listening; `startApiServer` binds `config.server.host/port`.
- REST routes mirror the dashboard contract; errors use `{ error: { code, message } }`.
- SSE (`/api/events`) sends `snapshot`, `connection`, `stats`, `log`, `message`, and 15-second `ping` events with manual CORS headers.
- When `web/dist` exists it is served statically with an SPA fallback; otherwise `GET /` returns a development hint.

## Config System

All configuration is validated against Zod schemas at load time. Invalid config throws with a descriptive error listing all violations.

```
hexobot.config.yml
  ├── bot (name, prefix, agent, adminJids)
  ├── logger (level, format)
  ├── server (enabled, host, port, corsOrigins)
  ├── whatsapp (sessionDir, reconnect, printQRInTerminal, …)
  └── features:
        <feature-name>:
          enabled: boolean
          config: object
```

## Module Dependencies

```
@shared   → (nothing from project)
@core     → @shared
@app      → @core, @shared, @infra, @features
@features → @core, @shared
@infra    → @core, @shared
```

Violations are caught by architectural tests (`npm run test:arch`).

## Error Handling

All errors extend `HexoError` with a structured `code` for programmatic handling.

```typescript
class HexoError extends Error {
  code: string;       // e.g. 'UNKNOWN_COMMAND', 'DUPLICATE_REGISTRATION'
  context: object;    // Additional structured data
}
```
