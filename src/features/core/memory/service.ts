/** In-memory storage with scoped keys and optional TTL expiry. */

import type { MemoryEntry, MemoryService, MemoryScope } from './types.js';
import { MemoryScope as Scope } from './types.js';

/** Namespace separator for scoped keys. */
const SEPARATOR = ':';

/** Build a fully namespaced key based on scope. */
function namespaceKey(scope: MemoryScope, key: string): string {
  return `${scope}${SEPARATOR}${key}`;
}

/** Memory service: in-memory Map with scoped storage and TTL expiry. */
export class MemoryServiceImpl implements MemoryService {
  private readonly store = new Map<string, MemoryEntry>();

  private getFullKey(key: string): string {
    return namespaceKey(Scope.Global, key);
  }

  get(key: string): string | undefined {
    const entry = this.store.get(this.getFullKey(key));
    if (!entry) return undefined;
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      this.store.delete(this.getFullKey(key));
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlMs?: number): void {
    const fullKey = this.getFullKey(key);
    const now = new Date();
    const entry: MemoryEntry = {
      value,
      createdAt: now.toISOString(),
    };
    if (ttlMs !== undefined && ttlMs > 0) {
      entry.expiresAt = new Date(now.getTime() + ttlMs).toISOString();
    }
    this.store.set(fullKey, entry);
  }

  delete(key: string): boolean {
    return this.store.delete(this.getFullKey(key));
  }

  clear(scope?: MemoryScope, key?: string): void {
    if (scope && key) {
      // Clear a specific key within a scope
      const prefix = namespaceKey(scope, key);
      for (const k of this.store.keys()) {
        if (k === prefix || k.startsWith(prefix + SEPARATOR)) {
          this.store.delete(k);
        }
      }
    } else if (scope) {
      // Clear all entries in a scope
      const prefix = namespaceKey(scope, '');
      for (const k of this.store.keys()) {
        if (k.startsWith(prefix)) {
          this.store.delete(k);
        }
      }
    } else {
      // Clear everything
      this.store.clear();
    }
  }

  keys(scope?: MemoryScope): string[] {
    const prefix = scope ? namespaceKey(scope, '') : '';
    const result: string[] = [];
    const now = new Date();
    for (const [key, entry] of this.store) {
      if (!prefix || key.startsWith(prefix)) {
        // Skip expired
        if (entry.expiresAt && new Date(entry.expiresAt) < now) {
          this.store.delete(key);
          continue;
        }
        result.push(key);
      }
    }
    return result;
  }
}
