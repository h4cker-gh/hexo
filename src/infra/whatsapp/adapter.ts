/** WhatsApp adapter — Baileys implementation of the messaging contracts. */

import {
  makeWASocket,
  Browsers,
  DisconnectReason,
  type ConnectionState,
  type GroupMetadata,
  type WAMediaUpload,
  type WASocket,
} from '@whiskeysockets/baileys';
import type {
  ConnectMethod,
  ConnectOptions,
  ConnectableAdapter,
  ConnectionSnapshot,
  ContactMessageParams,
  LocationMessageParams,
  MediaMessageParams,
  MessageAdapter,
  MessageResult,
  PollMessageParams,
  ReplyMessageParams,
  TextMessageParams,
} from '@core/adapter/types.js';
import type { ContextBuilder } from '@core/context/builder.js';
import type { UniversalContext } from '@core/context/types.js';
import type { Logger } from '@core/logger/types.js';
import { SessionManager } from './session-manager.js';
import { EventTransformer } from './event-transformer.js';
import { attachOutgoingMentions } from './message-normalizer.js';
import { normalizeJid } from './types.js';

/** Silences Baileys internal logging — only error/fatal pass through. */
function makeBaileysQuietLogger(adapterLogger: Logger) {
  return {
    level: 'silent' as const,
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (msg: unknown, ...data: unknown[]) => {
      const msgStr = typeof msg === 'string' ? msg : (typeof msg === 'object' && msg !== null && 'message' in msg ? String((msg as { message: unknown }).message) : JSON.stringify(msg));
      const ctx = data.length > 0 ? { baileys: data.map((d) => (typeof d === 'object' && d !== null ? JSON.stringify(d) : String(d))) } : undefined;
      adapterLogger.error(`Baileys: ${msgStr}`, ctx);
    },
    fatal: (msg: unknown, ...data: unknown[]) => {
      const msgStr = typeof msg === 'string' ? msg : (typeof msg === 'object' && msg !== null && 'message' in msg ? String((msg as { message: unknown }).message) : JSON.stringify(msg));
      const ctx = data.length > 0 ? { baileys: data.map((d) => (typeof d === 'object' && d !== null ? JSON.stringify(d) : String(d))) } : undefined;
      adapterLogger.fatal(`Baileys: ${msgStr}`, ctx);
    },
    child: () => makeBaileysQuietLogger(adapterLogger),
  };
}

/** Configuration for the WhatsApp adapter. */
export interface WhatsAppAdapterConfig {
  /** Directory for session data. */
  sessionDir: string;
  /** Whether credentials should be persisted. */
  saveCreds: boolean;
  /** Auto-reconnect on disconnect. */
  autoReconnect: boolean;
  /** Max reconnection attempts. */
  maxReconnectAttempts: number;
  /** Delay between reconnection attempts in ms. */
  reconnectDelayMs: number;
  /** Print the QR code to the terminal (off by default; use the dashboard). */
  printQRInTerminal: boolean;
  /** Phone number (E.164) for auto-pairing code instead of QR. */
  pairingPhone: string;
  /** Logger instance. */
  logger: Logger;
}

/** Minimal shape of a sent-message result used to extract the platform id. */
type SendOutcome = { key?: { id?: string | null } | null } | undefined;

/** Extract a Boom/HTTP status code from a disconnect error. */
function getDisconnectStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('output' in error)) return undefined;
  const output = (error as { output?: { statusCode?: unknown } }).output;
  return output && typeof output.statusCode === 'number' ? output.statusCode : undefined;
}

/** Extract a human-readable error message from an unknown value. */
function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return undefined;
}

/**
 * WhatsApp adapter using Baileys.
 *
 * Implements both MessageAdapter and ConnectableAdapter. Core code never
 * depends on Baileys — this adapter is the only bridge.
 */
export class WhatsAppAdapter implements MessageAdapter, ConnectableAdapter {
  private socket: WASocket | null = null;
  private sessionManager: SessionManager | null = null;
  private eventTransformer: EventTransformer | null = null;
  private initPromise: Promise<void> | null = null;
  private connecting: Promise<void> | null = null;
  private shuttingDown = false;
  private manualDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMethod: ConnectMethod = 'qr';
  private lastPhoneNumber: string | undefined;
  private pairingRequested = false;
  private snapshot: ConnectionSnapshot;
  private readonly listeners = new Set<(snapshot: ConnectionSnapshot) => void>();

  private readonly contextBuilder: ContextBuilder;
  private readonly onContext: (context: UniversalContext) => void | Promise<void>;
  private onContextOverride: ((context: UniversalContext) => void | Promise<void>) | null = null;

  constructor(
    private readonly config: WhatsAppAdapterConfig,
    contextBuilder: ContextBuilder,
    onContext: (context: UniversalContext) => void | Promise<void>,
  ) {
    this.contextBuilder = contextBuilder;
    this.onContext = onContext;
    this.snapshot = { status: 'disconnected', updatedAt: new Date().toISOString() };
  }

  /** Replace the onContext callback after construction. */
  setOnContext(
    onContext: (context: UniversalContext) => void | Promise<void>,
  ): void {
    this.onContextOverride = onContext;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /** Load auth state and auto-connect when credentials are registered. */
  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit();
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    const logger = this.config.logger;
    logger.info('Initializing WhatsApp adapter');

    this.sessionManager = new SessionManager({
      sessionDir: this.config.sessionDir,
      saveCreds: this.config.saveCreds,
      logger,
    });

    try {
      await this.sessionManager.init();
    } catch (error) {
      const message = getErrorMessage(error) ?? 'Failed to load WhatsApp session';
      logger.error('Failed to load WhatsApp session', { error: message });
      this.updateSnapshot({ status: 'error', error: message });
      return;
    }

    this.eventTransformer = new EventTransformer({
      botJid: '',
      contextBuilder: this.contextBuilder,
      logger,
      groupMetadataProvider: (groupId) => this.fetchGroupMetadata(groupId),
      onContext: (context) =>
        (this.onContextOverride ?? this.onContext)(context),
    });

    if (this.sessionManager.isRegistered()) {
      try {
        await this.connect('qr');
      } catch (error) {
        logger.error('Auto-connect failed', { error: getErrorMessage(error) });
      }
    } else if (this.config.pairingPhone) {
      this.updateSnapshot({ status: 'pairing' });
      try {
        await this.connect('pairing-code', { phoneNumber: this.config.pairingPhone });
      } catch (error) {
        logger.error('Pairing code request failed', { error: getErrorMessage(error) });
        this.updateSnapshot({ status: 'error', error: getErrorMessage(error) ?? 'Pairing failed' });
      }
    } else {
      this.updateSnapshot({ status: 'disconnected' });
    }
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.manualDisconnect = true;
    this.clearReconnectTimer();

    const socket = this.socket;
    this.socket = null;
    if (socket) {
      try {
        socket.end(undefined);
      } catch {
        // Socket may already be closed
      }
    }

    this.eventTransformer = null;
    this.updateSnapshot({ status: 'disconnected' });
    this.config.logger.info('WhatsApp adapter shut down');
  }

  isConnected(): boolean {
    return this.socket !== null && this.snapshot.status === 'connected';
  }

  // ─── Connection ─────────────────────────────────────────────────────────

  async connect(method: ConnectMethod, options: ConnectOptions = {}): Promise<void> {
    if (!this.sessionManager) {
      throw new Error('WhatsApp adapter is not initialized');
    }

    // Re-create the auth state after a logout cleared it.
    await this.sessionManager.init();

    const active = this.snapshot.status === 'connecting'
      || this.snapshot.status === 'qr'
      || this.snapshot.status === 'pairing'
      || this.snapshot.status === 'connected';
    if (active) return;
    if (this.connecting) return this.connecting;

    this.lastMethod = method;
    this.lastPhoneNumber = options.phoneNumber;
    this.manualDisconnect = false;
    this.pairingRequested = false;
    this.clearReconnectTimer();
    this.updateSnapshot({ status: 'connecting' });

    this.connecting = this.createSocket();
    try {
      await this.connecting;
    } catch (error) {
      const message = getErrorMessage(error) ?? 'Failed to create WhatsApp socket';
      this.config.logger.error('Failed to connect to WhatsApp', { error: message });
      this.updateSnapshot({ status: 'error', error: message });
      throw error;
    } finally {
      this.connecting = null;
    }
  }

  async disconnect(options: { logout?: boolean } = {}): Promise<void> {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.pairingRequested = false;

    const socket = this.socket;
    this.socket = null;

    if (options.logout) {
      if (socket) {
        try {
          await socket.logout();
        } catch (error) {
          this.config.logger.warn('WhatsApp logout request failed', {
            error: getErrorMessage(error),
          });
        }
      }
      try {
        await this.sessionManager?.clear();
      } catch (error) {
        this.config.logger.error('Failed to clear WhatsApp session', {
          error: getErrorMessage(error),
        });
      }
    } else if (socket) {
      try {
        socket.end(undefined);
      } catch {
        // Socket may already be closed
      }
    }

    this.updateSnapshot({ status: 'disconnected' });
    this.config.logger.info('WhatsApp disconnected', { logout: options.logout === true });
  }

  getConnectionSnapshot(): ConnectionSnapshot {
    return { ...this.snapshot };
  }

  onConnectionChange(listener: (snapshot: ConnectionSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ─── Send Methods ───────────────────────────────────────────────────────

  async sendText(params: TextMessageParams): Promise<MessageResult> {
    const { text, mentionedJid } = attachOutgoingMentions(params.content, params.mentions ?? []);
    return this.sendMessage((socket) =>
      socket.sendMessage(params.to, { text, mentions: mentionedJid }),
    );
  }

  async reply(params: ReplyMessageParams): Promise<MessageResult> {
    // No WAMessage cache is retained, so replies are sent as plain text with
    // mentions instead of fabricating a quoted message.
    const { text, mentionedJid } = attachOutgoingMentions(params.content, params.mentions ?? []);
    return this.sendMessage((socket) =>
      socket.sendMessage(params.to, { text, mentions: mentionedJid }),
    );
  }

  async sendImage(params: MediaMessageParams): Promise<MessageResult> {
    return this.sendMessage((socket) =>
      socket.sendMessage(params.to, {
        image: params.media as WAMediaUpload,
        caption: params.caption,
        mimetype: params.mimeType,
      }),
    );
  }

  async sendVideo(params: MediaMessageParams): Promise<MessageResult> {
    return this.sendMessage((socket) =>
      socket.sendMessage(params.to, {
        video: params.media as WAMediaUpload,
        caption: params.caption,
        mimetype: params.mimeType,
      }),
    );
  }

  async sendAudio(params: MediaMessageParams): Promise<MessageResult> {
    return this.sendMessage((socket) =>
      socket.sendMessage(params.to, {
        audio: params.media as WAMediaUpload,
        mimetype: params.mimeType,
        ptt: false,
      }),
    );
  }

  async sendSticker(params: MediaMessageParams): Promise<MessageResult> {
    return this.sendMessage((socket) =>
      socket.sendMessage(params.to, {
        sticker: params.media as WAMediaUpload,
        mimetype: params.mimeType,
      }),
    );
  }

  async sendDocument(params: MediaMessageParams): Promise<MessageResult> {
    return this.sendMessage((socket) =>
      socket.sendMessage(params.to, {
        document: params.media as WAMediaUpload,
        mimetype: params.mimeType,
        fileName: params.filename,
        caption: params.caption,
      }),
    );
  }

  async sendPoll(params: PollMessageParams): Promise<MessageResult> {
    return this.sendMessage((socket) =>
      socket.sendMessage(params.to, {
        poll: {
          name: params.name,
          values: params.options.map((option) => option.label),
          selectableCount: params.maxVotes ?? 0,
        },
      }),
    );
  }

  async sendLocation(params: LocationMessageParams): Promise<MessageResult> {
    return this.sendMessage((socket) =>
      socket.sendMessage(params.to, {
        location: {
          degreesLatitude: params.latitude,
          degreesLongitude: params.longitude,
          name: params.name,
        },
      }),
    );
  }

  async sendContact(params: ContactMessageParams): Promise<MessageResult> {
    return this.sendMessage((socket) =>
      socket.sendMessage(params.to, {
        contacts: {
          contacts: params.contacts.map((contact) => ({
            vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${contact.name || 'Unknown'}\nTEL;type=CELL:${contact.phoneNumber}\nEND:VCARD`,
          })),
        },
      }),
    );
  }

  // ─── Private ────────────────────────────────────────────────────────────

  private async sendMessage(fn: (socket: WASocket) => Promise<SendOutcome>): Promise<MessageResult> {
    const socket = this.socket;
    if (!socket || !this.isConnected()) {
      return {
        id: crypto.randomUUID(),
        success: false,
        error: 'Adapter not connected',
      };
    }

    try {
      const sent = await fn(socket);
      const result: MessageResult = {
        id: sent?.key?.id ?? crypto.randomUUID(),
        success: true,
      };
      this.config.logger.info('Message sent successfully', { messageId: result.id });
      return result;
    } catch (error) {
      const message = getErrorMessage(error) ?? 'Unknown error';
      this.config.logger.error('Failed to send message', { error: message });
      return {
        id: crypto.randomUUID(),
        success: false,
        error: message,
      };
    }
  }

  private async createSocket(): Promise<void> {
    if (!this.sessionManager) {
      throw new Error('WhatsApp adapter is not initialized');
    }

    const previous = this.socket;
    this.socket = null;
    if (previous) {
      try {
        previous.end(undefined);
      } catch {
        // Socket may already be closed
      }
    }

    const { version } = await SessionManager.getBaileysVersion();
    if (this.manualDisconnect || this.shuttingDown) {
      return;
    }

    const socket = makeWASocket({
      version,
      auth: this.sessionManager.getState(),
      printQRInTerminal: this.config.printQRInTerminal,
      browser: Browsers.macOS('Desktop'),
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: true,
      emitOwnEvents: false,
      syncFullHistory: false,
      logger: makeBaileysQuietLogger(this.config.logger),
    });

    this.socket = socket;
    this.wireSocket(socket);
    this.config.logger.info('WhatsApp socket created');
  }

  private wireSocket(socket: WASocket): void {
    socket.ev.process(async (events) => {
      if (this.socket !== socket) return;

      try {
        if (events['creds.update']) {
          await this.sessionManager?.saveCreds();
        }

        const connection = events['connection.update'];
        if (connection) {
          await this.handleConnectionUpdate(socket, connection);
        }

        const upserts = events['messages.upsert'];
        if (upserts && this.eventTransformer) {
          // Do not block connection/credential processing on command execution.
          void this.eventTransformer.handleMessages(upserts.messages).catch((error: unknown) => {
            this.config.logger.error('Failed to process WhatsApp messages', {
              error: getErrorMessage(error),
            });
          });
        }

        const receipts = events['message-receipt.update'];
        if (receipts) {
          this.eventTransformer?.handleReceipts(receipts);
        }

        const groupUpserts = events['groups.upsert'];
        if (groupUpserts) {
          for (const group of groupUpserts) {
            this.eventTransformer?.handleGroupMetadata(group.id, group);
          }
        }

        const groupUpdates = events['groups.update'];
        if (groupUpdates) {
          for (const update of groupUpdates) {
            if (update.id) this.eventTransformer?.handleGroupUpdate(update.id, update);
          }
        }
      } catch (error) {
        this.config.logger.error('Failed to process WhatsApp event', {
          error: getErrorMessage(error),
        });
      }
    });
  }

  private async handleConnectionUpdate(
    socket: WASocket,
    update: Partial<ConnectionState>,
  ): Promise<void> {
    if (this.socket !== socket) return;

    if (update.connection === 'open') {
      this.handleOpen(socket);
      return;
    }

    if (update.connection === 'close') {
      await this.handleClose(socket, update);
      return;
    }

    if (update.qr) {
      await this.handleQr(socket, update.qr);
    }
  }

  private handleOpen(socket: WASocket): void {
    if (this.manualDisconnect || this.shuttingDown) {
      try {
        socket.end(undefined);
      } catch {
        // Socket may already be closed
      }
      return;
    }

    const raw = this.sessionManager?.getState().creds.me?.id ?? socket.user?.id;
    const botJid = raw ? normalizeJid(raw) : undefined;

    this.reconnectAttempts = 0;
    this.pairingRequested = false;
    this.eventTransformer?.setBotJid(botJid ?? '');
    this.updateSnapshot({
      status: 'connected',
      ...(botJid ? { botJid } : {}),
    });
    this.config.logger.info('WhatsApp connection opened', { botJid });
  }

  private async handleQr(socket: WASocket, qr: string): Promise<void> {
    if (this.manualDisconnect || this.shuttingDown) return;

    // Once a pairing code was requested, keep the pairing snapshot instead of
    // letting QR refreshes overwrite the code shown in the dashboard.
    if (this.lastMethod === 'pairing-code' && this.pairingRequested) {
      return;
    }

    this.updateSnapshot({ status: 'qr', qr });

    if (
      this.lastMethod !== 'pairing-code'
      || !this.lastPhoneNumber
      || this.pairingRequested
    ) {
      return;
    }

    this.pairingRequested = true;
    const phoneNumber = this.lastPhoneNumber;
    try {
      const pairingCode = await socket.requestPairingCode(phoneNumber);
      if (this.socket === socket) {
        this.updateSnapshot({ status: 'pairing', pairingCode });
      }
    } catch (error) {
      const message = getErrorMessage(error) ?? 'Failed to request pairing code';
      this.config.logger.error('Failed to request pairing code', { error: message });
      if (this.socket === socket) {
        this.updateSnapshot({ status: 'error', error: message, qr });
      }
    }
  }

  private async handleClose(
    socket: WASocket,
    update: Partial<ConnectionState>,
  ): Promise<void> {
    if (this.socket === socket) {
      this.socket = null;
    }
    this.eventTransformer?.setBotJid('');

    if (this.manualDisconnect || this.shuttingDown) {
      this.updateSnapshot({ status: 'disconnected' });
      return;
    }

    const statusCode = getDisconnectStatusCode(update.lastDisconnect?.error);
    const error = getErrorMessage(update.lastDisconnect?.error);

    if (statusCode === DisconnectReason.loggedOut) {
      await this.sessionManager?.clear().catch((clearError: unknown) => {
        this.config.logger.error('Failed to clear WhatsApp session', {
          error: getErrorMessage(clearError),
        });
      });
      this.updateSnapshot({
        status: 'disconnected',
        ...(error ? { error } : {}),
      });
      this.config.logger.warn('WhatsApp logged out; session cleared');
      return;
    }

    if (statusCode === 402 || statusCode === 406) {
      this.updateSnapshot({
        status: 'error',
        error: error ?? `WhatsApp connection rejected (${statusCode})`,
      });
      this.config.logger.error('WhatsApp connection closed, not reconnecting', {
        statusCode,
        error,
      });
      return;
    }

    if (this.shouldReconnect()) {
      this.reconnectAttempts += 1;
      const delay = this.config.reconnectDelayMs;
      this.updateSnapshot({
        status: 'connecting',
        ...(error ? { error } : {}),
      });
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.manualDisconnect = false;
        this.pairingRequested = false;
        void this.createSocket().catch((connectError: unknown) => {
          const message = getErrorMessage(connectError) ?? 'Reconnect failed';
          this.config.logger.error('WhatsApp reconnect failed', { error: message });
          this.updateSnapshot({ status: 'error', error: message });
        });
      }, delay);
      this.config.logger.warn('WhatsApp connection closed, reconnecting', {
        attempt: this.reconnectAttempts,
        delay,
        statusCode,
      });
      return;
    }

    this.updateSnapshot({
      status: 'error',
      error: error ?? 'WhatsApp connection closed',
    });
    this.config.logger.error('WhatsApp connection closed, not reconnecting', {
      statusCode,
      error,
    });
  }

  private shouldReconnect(): boolean {
    if (!this.config.autoReconnect) return false;
    return this.reconnectAttempts < this.config.maxReconnectAttempts;
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async fetchGroupMetadata(groupId: string): Promise<GroupMetadata> {
    const socket = this.socket;
    if (!socket) {
      throw new Error('WhatsApp socket is not available');
    }
    return socket.groupMetadata(groupId);
  }

  private updateSnapshot(next: Omit<ConnectionSnapshot, 'updatedAt'>): void {
    this.snapshot = { ...next, updatedAt: new Date().toISOString() };
    for (const listener of this.listeners) {
      try {
        listener({ ...this.snapshot });
      } catch (error) {
        this.config.logger.error('WhatsApp connection listener failed', {
          error: getErrorMessage(error),
        });
      }
    }
  }
}
