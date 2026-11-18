/** In-memory ring buffer for dashboard log entries. */

import { randomUUID } from 'node:crypto';
import type { LogEntryDto, LogLevelName, LogQuery } from './types.js';

const LEVEL_RANK: Record<LogLevelName, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const DEFAULT_CAPACITY = 500;
const DEFAULT_LIMIT = 100;

/** Bounded, newest-first log store with change notifications. */
export class LogStore {
  private readonly entries: LogEntryDto[] = [];
  private readonly listeners = new Set<(entry: LogEntryDto) => void>();

  constructor(private readonly capacity: number = DEFAULT_CAPACITY) {}

  /** Append a log entry, evicting the oldest when full. */
  add(entry: LogEntryDto): void {
    this.entries.push(entry);
    if (this.entries.length > this.capacity) {
      this.entries.shift();
    }

    const snapshot = { ...entry };
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A broken subscriber must not break logging.
      }
    }
  }

  /** Convenience creation helper used by the console logger sink. */
  append(entry: Omit<LogEntryDto, 'id' | 'timestamp'>): LogEntryDto {
    const record: LogEntryDto = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.add(record);
    return record;
  }

  /** Query entries newest first, filtered to the requested level and above. */
  query(query: LogQuery = {}): LogEntryDto[] {
    const limit = clamp(query.limit ?? DEFAULT_LIMIT, 1, this.capacity);
    const minRank = query.level ? LEVEL_RANK[query.level] : 0;

    return this.entries
      .filter((entry) => LEVEL_RANK[entry.level] >= minRank)
      .slice(-limit)
      .reverse()
      .map((entry) => ({ ...entry }));
  }

  /** Subscribe to new entries. Returns an unsubscribe function. */
  onEntry(listener: (entry: LogEntryDto) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Current number of retained entries. */
  size(): number {
    return this.entries.length;
  }
}

/** Clamp a numeric value into an inclusive range. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}
