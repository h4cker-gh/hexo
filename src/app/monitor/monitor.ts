/** Dashboard monitoring facade — platform state, stats, logs, and messages. */

import { randomUUID } from 'node:crypto';
import { LogStore } from './log-store.js';
import { PlatformStatsTracker } from './stats.js';
import type {
  ConnectionEvent,
  ConnectionSnapshot,
  LogEntryDto,
  LogQuery,
  MessageInput,
  MessageRecord,
  OutboundMessageInput,
  PlatformId,
  PlatformRegistration,
  PlatformStats,
  PlatformSummary,
} from './types.js';

/** Coordinates log capture, counters, and connection state for the dashboard. */
export class Monitor {
  private readonly platforms = new Map<PlatformId, PlatformRegistration>();
  private readonly connections = new Map<PlatformId, ConnectionSnapshot>();
  private readonly connectionListeners = new Set<(event: ConnectionEvent) => void>();

  constructor(
    private readonly logStore: LogStore,
    private readonly tracker: PlatformStatsTracker = new PlatformStatsTracker(),
  ) {}

  /** Register a platform so it appears in dashboard summaries. */
  registerPlatform(registration: PlatformRegistration): void {
    if (!this.platforms.has(registration.id)) {
      this.platforms.set(registration.id, { ...registration });
    }
  }

  /** Store a connection snapshot and broadcast the change. */
  updateConnection(platform: PlatformId, snapshot: ConnectionSnapshot): void {
    this.connections.set(platform, { ...snapshot });
    this.tracker.setConnected(platform, snapshot.status === 'connected');

    const event: ConnectionEvent = { platform, ...snapshot };
    for (const listener of this.connectionListeners) {
      try {
        listener(event);
      } catch {
        // Subscriber failures are isolated from connection tracking.
      }
    }
  }

  /** Record an inbound message. */
  recordInbound(platform: PlatformId, input: MessageInput): MessageRecord {
    const record = this.buildRecord(platform, 'in', input, randomUUID());
    this.tracker.recordMessage(record);
    return record;
  }

  /** Record an outbound message. */
  recordOutbound(platform: PlatformId, input: OutboundMessageInput): MessageRecord {
    const record = this.buildRecord(platform, 'out', input, input.id ?? randomUUID());
    this.tracker.recordMessage(record);
    return record;
  }

  /** Record a dispatched command. */
  recordCommand(platform: PlatformId): void {
    this.tracker.recordCommand(platform);
  }

  /** Record a handled error. */
  recordError(platform: PlatformId): void {
    this.tracker.recordError(platform);
  }

  /** All registered platform summaries. */
  getPlatformSummaries(): PlatformSummary[] {
    return Array.from(this.platforms.values()).map((registration) =>
      this.buildSummary(registration),
    );
  }

  /** A single platform summary, or undefined when unknown. */
  getPlatform(platform: PlatformId): PlatformSummary | undefined {
    const registration = this.platforms.get(platform);
    return registration ? this.buildSummary(registration) : undefined;
  }

  /** Captured logs, newest first. */
  getLogs(query: LogQuery = {}): LogEntryDto[] {
    return this.logStore.query(query);
  }

  /** Recent messages, newest first. */
  getMessages(platform: PlatformId | undefined, limit: number): MessageRecord[] {
    return this.tracker.getMessages(platform, limit);
  }

  /** Subscribe to log entries. */
  onLog(listener: (entry: LogEntryDto) => void): () => void {
    return this.logStore.onEntry(listener);
  }

  /** Subscribe to stats updates. */
  onStats(listener: (stats: PlatformStats) => void): () => void {
    return this.tracker.onStats(listener);
  }

  /** Subscribe to message records. */
  onMessage(listener: (record: MessageRecord) => void): () => void {
    return this.tracker.onMessage(listener);
  }

  /** Subscribe to connection changes. */
  onConnection(listener: (event: ConnectionEvent) => void): () => void {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private buildSummary(registration: PlatformRegistration): PlatformSummary {
    const connection = this.connections.get(registration.id);
    return {
      id: registration.id,
      name: registration.name,
      enabled: registration.enabled,
      status: connection?.status ?? 'disconnected',
      ...(connection?.qr ? { qr: connection.qr } : {}),
      ...(connection?.pairingCode ? { pairingCode: connection.pairingCode } : {}),
      ...(connection?.error ? { error: connection.error } : {}),
      ...(connection?.botJid ? { botJid: connection.botJid } : {}),
      stats: this.tracker.get(registration.id),
    };
  }

  private buildRecord(
    platform: PlatformId,
    direction: 'in' | 'out',
    input: MessageInput,
    id: string,
  ): MessageRecord {
    return {
      id,
      timestamp: new Date().toISOString(),
      platform,
      direction,
      chatId: input.chatId,
      senderId: input.senderId,
      ...(input.senderName ? { senderName: input.senderName } : {}),
      text: input.text,
      success: input.success ?? true,
    };
  }
}
