# Graph Report - graphify-out  (2026-11-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 842 nodes · 2096 edges · 25 communities (21 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 52 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5985611a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/index.ts
- Connect.tsx
- client.ts
- adapter.ts
- WhatsAppAdapter
- commands/registry.ts
- package.json
- src/config.ts
- app/config.ts
- compilerOptions
- web/package.json
- message/builder.ts
- LogLevel
- EnvReader
- compilerOptions
- LifecycleStage
- app/container.ts
- compilerOptions
- MessageAdapter
- HexoBot
- DIContainer
- BotStatus
- Logger
- vite-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `WhatsAppAdapter` - 42 edges
2. `Monitor` - 29 edges
3. `Connect()` - 27 edges
4. `compilerOptions` - 26 edges
5. `bootstrapContainer()` - 25 edges
6. `Logger` - 24 edges
7. `EventTransformer` - 21 edges
8. `PlatformId` - 21 edges
9. `Dashboard()` - 21 edges
10. `compilerOptions` - 21 edges

## Surprising Connections (you probably didn't know these)
- `TabsProps` --references--> `Route`  [EXTRACTED]
  web/src/components/Tabs.tsx → web/src/config.ts
- `bootstrapContainer()` --calls--> `CommandRegistry`  [EXTRACTED]
  src/app/container.ts → src/core/commands/registry.ts
- `HexoBot` --references--> `DIContainer`  [EXTRACTED]
  src/app/bot.ts → src/core/di/container.ts
- `bootstrapContainer()` --calls--> `WhatsAppAdapter`  [EXTRACTED]
  src/app/container.ts → src/infra/whatsapp/adapter.ts
- `WhatsAppAdapter` --references--> `ConnectionSnapshot`  [EXTRACTED]
  src/infra/whatsapp/adapter.ts → src/core/adapter/types.ts

## Import Cycles
- None detected.

## Communities (25 total, 4 thin omitted)

### Community 0 - "app/index.ts"
Cohesion: 0.07
Nodes (46): apiError(), asRecord(), isLogLevelName(), normalizeRecipient(), parseLimit(), parseMentions(), readString(), registerApiRoutes() (+38 more)

### Community 1 - "Connect.tsx"
Cohesion: 0.06
Nodes (72): react, connectWhatsApp(), disconnectWhatsApp(), LogQuery, sendMessage(), ConnectionStatus, ContextMention, LogLevelName (+64 more)

### Community 2 - "client.ts"
Cohesion: 0.07
Nodes (62): API_BASE, ApiError, apiUrl(), getHealth(), getLogs(), getMessages(), getPlatform(), getPlatforms() (+54 more)

### Community 3 - "adapter.ts"
Cohesion: 0.09
Nodes (43): @whiskeysockets/baileys, ContextBuilder, DefaultContextBuilder, ContextChannel, ContextMention, ContextUser, UniversalContext, SendOutcome (+35 more)

### Community 4 - "WhatsAppAdapter"
Cohesion: 0.08
Nodes (15): ConnectableAdapter, ConnectOptions, ContactInfo, ContactMessageParams, LocationMessageParams, MediaMessageParams, MessageResult, PollMessageParams (+7 more)

### Community 5 - "commands/registry.ts"
Cohesion: 0.07
Nodes (22): vitest, AccessEngine, AccessLevel, Admin, Moderator, Owner, User, meetsAccessLevel() (+14 more)

### Community 6 - "package.json"
Cohesion: 0.04
Nodes (43): dependencies, fastify, @fastify/cors, @fastify/static, @whiskeysockets/baileys, description, devDependencies, eslint (+35 more)

### Community 7 - "src/config.ts"
Cohesion: 0.11
Nodes (27): react-dom, App(), StreamBadge(), Tabs(), TabsProps, ThemeSwitch(), ThemeSwitchProps, ToastProvider() (+19 more)

### Community 8 - "app/config.ts"
Cohesion: 0.11
Nodes (25): findNextMeaningful(), loadBotConfig(), loadConfig(), loadLoggerConfig(), parseSimpleYaml(), parseValue(), resolveConfigPath(), YamlContainer (+17 more)

### Community 9 - "compilerOptions"
Cohesion: 0.06
Nodes (33): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+25 more)

### Community 10 - "web/package.json"
Cohesion: 0.06
Nodes (30): typescript, qrcode.react, @types/node, @types/react, @types/react-dom, vite, @vitejs/plugin-react, dependencies (+22 more)

### Community 11 - "message/builder.ts"
Cohesion: 0.08
Nodes (18): pingHandler(), BuildOptions, BuiltMessage, createMessageBuilder(), IMessageBuilder, loadedThemes, MessageBuilder, padToWidth() (+10 more)

### Community 12 - "LogLevel"
Cohesion: 0.18
Nodes (13): ConsoleLogger, LogLevel, Debug, Error, Fatal, Info, Warn, color() (+5 more)

### Community 13 - "EnvReader"
Cohesion: 0.11
Nodes (6): ALL_ENV_KEYS, EnvReader, EnvSchema, EnvValidationResult, OPTIONAL_ENV_KEYS, REQUIRED_ENV_KEYS

### Community 14 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, baseUrl, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+14 more)

### Community 15 - "LifecycleStage"
Cohesion: 0.19
Nodes (9): LifecycleManager, LifecycleHook, LifecycleStage, Initialized, Initializing, Started, Starting, Stopped (+1 more)

### Community 16 - "app/container.ts"
Cohesion: 0.24
Nodes (7): bootstrapContainer(), ServiceKeys, toLogLevel(), ConsoleLoggerFactory, isConnectableAdapter(), LogEntry, LoggerFactory

### Community 17 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noUnusedLocals, noUnusedParameters (+6 more)

### Community 19 - "HexoBot"
Cohesion: 0.29
Nodes (3): HexoBot, main(), Config

### Community 20 - "DIContainer"
Cohesion: 0.35
Nodes (5): DIContainer, DIContainer, ProviderFn, RegistrationOptions, ServiceKey

### Community 21 - "BotStatus"
Cohesion: 0.29
Nodes (7): BotStatus, Initialized, Initializing, Running, Starting, Stopped, Stopping

## Knowledge Gaps
- **28 isolated node(s):** `@types/node`, `@types/react`, `@types/react-dom`, `Debug`, `Error` (+23 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 277 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `typescript` connect `web/package.json` to `package.json`?**
  _High betweenness centrality (0.332) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `bootstrapContainer()` (e.g. with `.recordCommand()` and `.recordError()`) actually correct?**
  _`bootstrapContainer()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/node`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06712871287128713 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Connect.tsx` to `web/package.json`, `client.ts`, `src/config.ts`?**
  _High betweenness centrality (0.268) - this node is a cross-community bridge._
- **Should `Connect.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06016929764355983 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `commands/registry.ts` to `app/index.ts`, `adapter.ts`, `package.json`, `app/config.ts`, `LifecycleStage`?**
  _High betweenness centrality (0.140) - this node is a cross-community bridge._