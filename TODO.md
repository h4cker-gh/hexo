# TODO — HexoBot 3.0

## Phase 1: Foundation ✅
- [x] Project config (package.json, tsconfig, vitest, tsup)
- [x] Directory structure (src/core, src/shared, src/app, src/infra, src/features)
- [x] Path aliases (@core, @shared, @infra, @features, @app)
- [x] Shared utilities (HexoError, validators)
- [x] Core contracts (config, commands, context, logger, access, di, features, lifecycle)
- [x] DI container (hand-rolled, no external deps)
- [x] Config loader & Zod validation
- [x] Console logger implementation
- [x] HexoBot class (lifecycle: init → start → stop)
- [x] Architectural tests (module boundaries, no `any`, no hardcoded prefixes, barrel exports)
- [x] Documentation (README.md, ARCHITECTURE.md)
- [x] Test fixtures

## Phase 2: WhatsApp Adapter ✅
- [x] Verify Baileys v6.7.24 types (LID, JID, message structure)
- [x] Implement WhatsApp adapter (SocketConfig, message handler)
- [x] Implement Baileys → UniversalContext converter
- [x] Implement sender identity mapping (LID/PN ↔ JID, chat vs sender)
- [x] Group metadata extraction (on-demand fetch + cache)
- [x] WhatsApp auth session management (useMultiFileAuthState)
- [x] WhatsApp config section in schema
- [x] Mention normalization (incoming rewrite, outgoing reconstruction)
- [x] Connection snapshots, QR and pairing-code flows, reconnect backoff

## Phase 3: Dashboard ✅
- [x] Fastify REST API (health, platforms, logs, messages, send, connect, disconnect)
- [x] SSE stream (snapshot, connection, stats, log, message, ping)
- [x] Monitor ring buffers (500 logs, 200 messages)
- [x] Structured logger sink
- [x] Static serving for web/dist with SPA fallback
- [x] Server config + entrypoint with graceful shutdown
- [ ] Dashboard frontend (web/, owned by frontend agent)

## Phase 4: Command System 🔲
- [ ] Implement ping command
- [ ] Implement help command
- [ ] Implement admin-only commands
- [ ] Command prefix parsing
- [ ] Multi-word command support
- [ ] Command result → platform message formatting (in adapter, not core)

## Phase 5: Platform Integration 🔲
- [ ] Message routing through CommandRegistry (wired; commands pending)
- [ ] Group command handling
- [ ] Admin detection from config adminJids

## Phase 6: Features & Extensibility 🔲
- [ ] Feature module system
- [ ] Config-driven feature toggle
- [ ] Plugin registration API
- [ ] Additional platform adapters (Telegram, Discord)

## Phase 7: Production 🔲
- [ ] Structured logging (JSON format)
- [x] Health check endpoint
- [ ] Docker support
- [ ] CI/CD pipeline
- [ ] Performance benchmarks
