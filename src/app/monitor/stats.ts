/** Per-platform counters and message history for the dashboard. */

import type {
  MessageRecord,
  PlatformId,
  PlatformStats,
} from './types.js';

const MESSAGE_CAPACITY = 200;

/** Tracks counters, connection state, and recent messages per platform. */
export class PlatformStatsTracker {
  private readonly stats = new Map<PlatformId, PlatformStats>();
  private readonly messages: MessageRecord[] = [];
  private readonly statsListeners = new Set<(stats: PlatformStats) => void>();
  private readonly messageListeners = new Set<(record: MessageRecord) => void>();

  constructor(private readonly messageCapacity: number = MESSAGE_CAPACITY) {}

  /** Get or lazily create stats for a platform. */
  ensure(platform: PlatformId): PlatformStats {
    const existing = this.stats.get(platform);
    if (existing) return existing;

    const created: PlatformStats = {
      platform,
      connected: false,
      messagesReceived: 0,
      messagesSent: 0,
      commandsExecuted: 0,
      errors: 0,
      startedAt: null,
      lastActivityAt: null,
    };
    this.stats.set(platform, created);
    return created;
  }

  /** Update connection state and the session start timestamp. */
  setConnected(platform: PlatformId, connected: boolean): void {
    const stats = this.ensure(platform);
    if (stats.connected === connected) return;

    stats.connected = connected;
    stats.startedAt = connected ? new Date().toISOString() : null;
    this.emitStats(stats);
  }

  /** Record an inbound or outbound message. */
  recordMessage(record: MessageRecord): void {
    const stats = this.ensure(record.platform);
    if (record.direction === 'in') {
      stats.messagesReceived += 1;
    } else if (record.success) {
      stats.messagesSent += 1;
    }
    stats.lastActivityAt = record.timestamp;

    this.messages.push(record);
    if (this.messages.length > this.messageCapacity) {
      this.messages.shift();
    }

    for (const listener of this.messageListeners) {
      try {
        listener({ ...record });
      } catch {
        // Subscriber failures are isolated from message tracking.
      }
    }
    this.emitStats(stats);
  }

  /** Record a dispatched command. */
  recordCommand(platform: PlatformId): void {
    const stats = this.ensure(platform);
    stats.commandsExecuted += 1;
    stats.lastActivityAt = new Date().toISOString();
    this.emitStats(stats);
  }

  /** Record a handled error. */
  recordError(platform: PlatformId): void {
    const stats = this.ensure(platform);
    stats.errors += 1;
    stats.lastActivityAt = new Date().toISOString();
    this.emitStats(stats);
  }

  /** Get a copy of a platform's stats. */
  get(platform: PlatformId): PlatformStats {
    return { ...this.ensure(platform) };
  }

  /** Get copies of all known platform stats. */
  getAll(): PlatformStats[] {
    return Array.from(this.stats.keys()).map((platform) => this.get(platform));
  }

  /** Recent messages, newest first, optionally filtered by platform. */
  getMessages(platform: PlatformId | undefined, limit: number): MessageRecord[] {
    return this.messages
      .filter((record) => platform === undefined || record.platform === platform)
      .slice(-Math.max(1, limit))
      .reverse()
      .map((record) => ({ ...record }));
  }

  /** Subscribe to stats updates. Returns an unsubscribe function. */
  onStats(listener: (stats: PlatformStats) => void): () => void {
    this.statsListeners.add(listener);
    return () => {
      this.statsListeners.delete(listener);
    };
  }

  /** Subscribe to message records. Returns an unsubscribe function. */
  onMessage(listener: (record: MessageRecord) => void): () => void {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  private emitStats(stats: PlatformStats): void {
    const snapshot = { ...stats };
    for (const listener of this.statsListeners) {
      try {
        listener(snapshot);
      } catch {
        // Subscriber failures are isolated from stats tracking.
      }
    }
  }
}
