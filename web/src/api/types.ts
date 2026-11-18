/**
 * Mirrors the shared API contract (staging/api-contract.md v1).
 * Keep this file in sync with the contract rather than inventing fields.
 */

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

/** REST responses that are not part of the domain type list above. */
export interface HealthResponse {
  ok: boolean;
  uptimeMs: number;
  version: string;
}

export interface ConnectResponse {
  status: ConnectionStatus;
}

export interface DisconnectResponse {
  ok: boolean;
}

/** `connection` SSE event: `{ platform, ...ConnectionSnapshot }`. */
export interface ConnectionEvent extends ConnectionSnapshot {
  platform: PlatformId;
}

export interface PingEvent {
  t: number;
}
