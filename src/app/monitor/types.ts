/** Monitoring DTOs shared by the container, SSE stream, and REST API. */

import type {
  ConnectMethod,
  ConnectionSnapshot,
  ConnectionStatus,
} from '@core/adapter/types.js';

export type { ConnectMethod, ConnectionSnapshot, ConnectionStatus };

/** Platform identifier supported by the dashboard. */
export type PlatformId = 'whatsapp';

/** Log severity names used by the dashboard. */
export type LogLevelName = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** A single captured log line. */
export interface LogEntryDto {
  id: string;
  timestamp: string;
  level: LogLevelName;
  logger: string;
  message: string;
  context?: Record<string, unknown>;
}

/** Per-platform counters shown on the dashboard. */
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

/** Aggregated platform state for the dashboard. */
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

/** A captured inbound or outbound message. */
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

/** Payload accepted by Monitor.recordInbound(). */
export interface MessageInput {
  chatId: string;
  senderId: string;
  senderName?: string;
  text: string;
  success?: boolean;
}

/** Payload accepted by Monitor.recordOutbound(). */
export interface OutboundMessageInput extends MessageInput {
  /** Platform id of the sent message, when available. */
  id?: string;
}

/** Data pushed on the SSE `connection` event. */
export interface ConnectionEvent extends ConnectionSnapshot {
  platform: PlatformId;
}

/** A registered dashboard platform. */
export interface PlatformRegistration {
  id: PlatformId;
  name: string;
  enabled: boolean;
}

/** Log query options. */
export interface LogQuery {
  level?: LogLevelName;
  limit?: number;
}

/** Runtime guard for platform identifiers. */
export function isPlatformId(value: string): value is PlatformId {
  return value === 'whatsapp';
}
