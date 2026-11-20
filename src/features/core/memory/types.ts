/** Memory service types and interfaces. */

/** TTL strategy for memory entries. */
export enum MemoryScope {
  Global = 'global',
  Local = 'local',
}

/** A single memory entry with optional TTL. */
export interface MemoryEntry {
  /** The stored value as a string. */
  value: string;
  /** Creation timestamp in ISO format. */
  createdAt: string;
  /** Expiration timestamp in ISO format (undefined = no expiry). */
  expiresAt?: string;
}

/** Memory service interface. */
export interface MemoryService {
  /** Get a value by key. Returns undefined if not found or expired. */
  get(key: string): string | undefined;

  /** Set a value with optional TTL. */
  set(key: string, value: string, ttlMs?: number): void;

  /** Delete a key. */
  delete(key: string): boolean;

  /** Clear all entries for a scope, or a single key. */
  clear(scope?: MemoryScope, key?: string): void;

  /** List all keys for a scope. */
  keys(scope?: MemoryScope): string[];
}
